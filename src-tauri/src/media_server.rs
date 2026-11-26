//! Zero-copy localhost HTTP byte-range media server for WebView2 `<video>` streaming.
//! Never loads whole multi-GB files into memory — streams via `File::seek` + 256 KiB chunks.

use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

const CHUNK: usize = 256 * 1024;

static PORT: AtomicU16 = AtomicU16::new(0);
static REGISTRY: OnceLock<Mutex<HashMap<String, PathBuf>>> = OnceLock::new();

fn registry() -> &'static Mutex<HashMap<String, PathBuf>> {
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

fn content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "mp4" | "m4v" => "video/mp4",
        "mov" | "qt" => "video/quicktime",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "avi" => "video/x-msvideo",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "aac" | "m4a" => "audio/aac",
        "flac" => "audio/flac",
        "ogg" | "oga" => "audio/ogg",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        _ => "application/octet-stream",
    }
}

fn token_for(path: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    path.hash(&mut h);
    format!("{:x}", h.finish())
}

/// Register a local media path and return its streaming URL.
pub fn resolve_url(path: &str) -> Result<String, String> {
    let p = PathBuf::from(path);
    if !p.is_file() {
        return Err(format!("Media file not found: {path}"));
    }
    let token = token_for(path);
    registry()
        .lock()
        .map_err(|_| "media registry lock poisoned".to_string())?
        .insert(token.clone(), p);
    let port = PORT.load(Ordering::SeqCst);
    if port == 0 {
        return Err("Media server not started".into());
    }
    Ok(format!("http://127.0.0.1:{port}/m/{token}"))
}

pub fn base_url() -> Result<String, String> {
    let port = PORT.load(Ordering::SeqCst);
    if port == 0 {
        return Err("Media server not started".into());
    }
    Ok(format!("http://127.0.0.1:{port}"))
}

fn add_cors<R: std::io::Read>(res: &mut Response<R>) {
    if let Ok(h) = Header::from_bytes("Access-Control-Allow-Origin", "*") {
        res.add_header(h);
    }
    if let Ok(h) = Header::from_bytes("Access-Control-Allow-Headers", "Range, Content-Type") {
        res.add_header(h);
    }
    if let Ok(h) = Header::from_bytes(
        "Access-Control-Expose-Headers",
        "Content-Range, Accept-Ranges, Content-Length",
    ) {
        res.add_header(h);
    }
}

fn parse_range(header: Option<&str>, file_len: u64) -> Option<(u64, u64)> {
    let raw = header?.trim();
    let spec = raw.strip_prefix("bytes=")?;
    let (a, b) = spec.split_once('-')?;
    if a.is_empty() {
        // suffix: bytes=-N
        let n: u64 = b.parse().ok()?;
        let start = file_len.saturating_sub(n);
        return Some((start, file_len.saturating_sub(1)));
    }
    let start: u64 = a.parse().ok()?;
    let end: u64 = if b.is_empty() {
        file_len.saturating_sub(1)
    } else {
        b.parse().ok()?
    };
    if start >= file_len || start > end {
        return None;
    }
    Some((start, end.min(file_len.saturating_sub(1))))
}

fn handle(req: Request) {
    if req.method() == &Method::Options {
        let mut res = Response::from_data(Vec::<u8>::new()).with_status_code(StatusCode(204));
        add_cors(&mut res);
        let _ = req.respond(res);
        return;
    }

    let url = req.url().to_string();
    if !url.starts_with("/m/") {
        let mut res = Response::from_string("not found").with_status_code(StatusCode(404));
        add_cors(&mut res);
        let _ = req.respond(res);
        return;
    }
    let token = url.trim_start_matches("/m/").split('?').next().unwrap_or("");
    let path = {
        let map = match registry().lock() {
            Ok(m) => m,
            Err(_) => {
                let mut res = Response::from_string("lock").with_status_code(StatusCode(500));
                add_cors(&mut res);
                let _ = req.respond(res);
                return;
            }
        };
        match map.get(token) {
            Some(p) => p.clone(),
            None => {
                let mut res = Response::from_string("unknown").with_status_code(StatusCode(404));
                add_cors(&mut res);
                let _ = req.respond(res);
                return;
            }
        }
    };

    let mut file = match File::open(&path) {
        Ok(f) => f,
        Err(_) => {
            let mut res = Response::from_string("io").with_status_code(StatusCode(404));
            add_cors(&mut res);
            let _ = req.respond(res);
            return;
        }
    };
    let file_len = match file.metadata() {
        Ok(m) => m.len(),
        Err(_) => 0,
    };
    let ctype = content_type(&path);
    let range_hdr = req
        .headers()
        .iter()
        .find(|h| h.field.equiv("Range"))
        .map(|h| h.value.as_str().to_string());

    if let Some((start, end)) = parse_range(range_hdr.as_deref(), file_len) {
        let len = end - start + 1;
        if file.seek(SeekFrom::Start(start)).is_err() {
            let mut res = Response::from_string("seek").with_status_code(StatusCode(500));
            add_cors(&mut res);
            let _ = req.respond(res);
            return;
        }
        // Cap single response to 8 MiB so huge Range requests never blow RAM
        let serve_end = start + (len.min(8 * 1024 * 1024) - 1).min(end - start);
        let serve_len = serve_end - start + 1;
        let mut buf = vec![0u8; CHUNK];
        let mut body = Vec::with_capacity(serve_len as usize);
        let mut remaining = serve_len;
        while remaining > 0 {
            let n = remaining.min(CHUNK as u64) as usize;
            match file.read(&mut buf[..n]) {
                Ok(0) => break,
                Ok(got) => {
                    body.extend_from_slice(&buf[..got]);
                    remaining -= got as u64;
                }
                Err(_) => break,
            }
        }
        let actual_end = start + body.len() as u64 - 1;
        let mut res = Response::from_data(body).with_status_code(StatusCode(206));
        if let Ok(h) = Header::from_bytes("Content-Type", ctype) {
            res.add_header(h);
        }
        if let Ok(h) = Header::from_bytes("Accept-Ranges", "bytes") {
            res.add_header(h);
        }
        if let Ok(h) = Header::from_bytes(
            "Content-Range",
            format!("bytes {start}-{actual_end}/{file_len}"),
        ) {
            res.add_header(h);
        }
        add_cors(&mut res);
        let _ = req.respond(res);
        return;
    }

    if file_len > 32 * 1024 * 1024 {
        let end = (1024 * 1024 - 1).min(file_len.saturating_sub(1));
        let mut body = vec![0u8; (end + 1) as usize];
        let _ = file.read_exact(&mut body);
        let mut res = Response::from_data(body).with_status_code(StatusCode(206));
        if let Ok(h) = Header::from_bytes("Content-Type", ctype) {
            res.add_header(h);
        }
        if let Ok(h) = Header::from_bytes("Accept-Ranges", "bytes") {
            res.add_header(h);
        }
        if let Ok(h) = Header::from_bytes(
            "Content-Range",
            format!("bytes 0-{end}/{file_len}"),
        ) {
            res.add_header(h);
        }
        add_cors(&mut res);
        let _ = req.respond(res);
        return;
    }

    let mut body = Vec::with_capacity(file_len as usize);
    let _ = file.read_to_end(&mut body);
    let mut res = Response::from_data(body);
    if let Ok(h) = Header::from_bytes("Content-Type", ctype) {
        res.add_header(h);
    }
    if let Ok(h) = Header::from_bytes("Accept-Ranges", "bytes") {
        res.add_header(h);
    }
    add_cors(&mut res);
    let _ = req.respond(res);
}

/// Bind `127.0.0.1:0` and serve forever on a background thread.
pub fn start() -> Result<u16, String> {
    if PORT.load(Ordering::SeqCst) != 0 {
        return Ok(PORT.load(Ordering::SeqCst));
    }
    let server = Server::http("127.0.0.1:0").map_err(|e| format!("media server bind: {e}"))?;
    let port = server
        .server_addr()
        .to_ip()
        .map(|a: SocketAddr| a.port())
        .ok_or_else(|| "media server: no port".to_string())?;
    PORT.store(port, Ordering::SeqCst);
    thread::Builder::new()
        .name("novablend-media".into())
        .spawn(move || {
            for req in server.incoming_requests() {
                handle(req);
            }
        })
        .map_err(|e| format!("media server thread: {e}"))?;
    eprintln!("[NovaBlend] media range server on http://127.0.0.1:{port}");
    Ok(port)
}
