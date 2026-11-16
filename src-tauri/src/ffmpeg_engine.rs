use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::AppHandle;

fn default_volume() -> f64 {
    1.0
}
fn default_blend() -> String {
    "normal".into()
}

fn default_mask_shape() -> String {
    "box".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Keyframe {
    pub time: f64,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipEffects {
    pub brightness: f64,
    pub contrast: f64,
    pub saturation: f64,
    #[serde(default)]
    pub sharpness: f64,
    #[serde(default)]
    pub temperature: f64,
    #[serde(default)]
    pub tint: f64,
    #[serde(default)]
    pub vignette_amount: f64,
    #[serde(default)]
    pub soft_blur: f64,
    #[serde(default)]
    pub pos_x: f64,
    #[serde(default)]
    pub pos_y: f64,
    #[serde(default = "default_volume")]
    pub volume: f64,
    #[serde(default)]
    pub audio_fade_in: f64,
    #[serde(default)]
    pub audio_fade_out: f64,
    #[serde(default)]
    pub audio_enhance: bool,
    #[serde(default = "default_blend")]
    pub blend_mode: String,
    pub scale: f64,
    pub rotation: f64,
    pub opacity: f64,
    pub mirror_h: bool,
    pub mirror_v: bool,
    pub reverse: bool,
    pub speed: f64,
    pub crop_x: f64,
    pub crop_y: f64,
    pub crop_w: f64,
    pub crop_h: f64,
    pub mask_enabled: bool,
    pub mask_feather: f64,
    #[serde(default = "default_mask_shape")]
    pub mask_shape: String,
    pub motion_blur: f64,
    pub effect: String,
    #[serde(default)]
    pub fade_in: f64,
    #[serde(default)]
    pub fade_out: f64,
    pub pip_x: f64,
    pub pip_y: f64,
    pub scale_keyframes: Vec<Keyframe>,
    pub opacity_keyframes: Vec<Keyframe>,
}

impl Default for ClipEffects {
    fn default() -> Self {
        Self {
            brightness: 0.0,
            contrast: 1.0,
            saturation: 1.0,
            sharpness: 0.0,
            temperature: 0.0,
            tint: 0.0,
            vignette_amount: 0.0,
            soft_blur: 0.0,
            pos_x: 0.0,
            pos_y: 0.0,
            volume: 1.0,
            audio_fade_in: 0.0,
            audio_fade_out: 0.0,
            audio_enhance: false,
            blend_mode: "normal".into(),
            scale: 1.0,
            rotation: 0.0,
            opacity: 1.0,
            mirror_h: false,
            mirror_v: false,
            reverse: false,
            speed: 1.0,
            crop_x: 0.0,
            crop_y: 0.0,
            crop_w: 1.0,
            crop_h: 1.0,
            mask_enabled: false,
            mask_feather: 0.0,
            mask_shape: "box".into(),
            motion_blur: 0.0,
            effect: "none".into(),
            fade_in: 0.0,
            fade_out: 0.0,
            pip_x: 0.05,
            pip_y: 0.05,
            scale_keyframes: vec![],
            opacity_keyframes: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextStyle {
    #[serde(default = "default_text_content")]
    pub content: String,
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_font_size")]
    pub font_size: f64,
    #[serde(default = "default_white")]
    pub color: String,
    #[serde(default = "default_black")]
    pub stroke_color: String,
    #[serde(default)]
    pub stroke_width: f64,
    #[serde(default = "default_shadow_color")]
    pub shadow_color: String,
    #[serde(default = "default_shadow_blur")]
    pub shadow_blur: f64,
    #[serde(default = "default_shadow_x")]
    pub shadow_offset_x: f64,
    #[serde(default = "default_shadow_y")]
    pub shadow_offset_y: f64,
    #[serde(default = "default_black")]
    pub background_color: String,
    #[serde(default)]
    pub background_opacity: f64,
    #[serde(default = "default_half")]
    pub x: f64,
    #[serde(default = "default_half")]
    pub y: f64,
    #[serde(default)]
    pub rotation: f64,
    #[serde(default = "default_align")]
    pub align: String,
    #[serde(default)]
    pub bold: bool,
    #[serde(default)]
    pub italic: bool,
    #[serde(default)]
    pub letter_spacing: f64,
    #[serde(default = "default_line_height")]
    pub line_height: f64,
    #[serde(default = "default_one")]
    pub opacity: f64,
}

fn default_text_content() -> String {
    "Text".into()
}
fn default_font_family() -> String {
    "Segoe UI".into()
}
fn default_font_size() -> f64 {
    72.0
}
fn default_white() -> String {
    "#ffffff".into()
}
fn default_black() -> String {
    "#000000".into()
}
fn default_shadow_color() -> String {
    "rgba(0,0,0,0.65)".into()
}
fn default_shadow_blur() -> f64 {
    10.0
}
fn default_shadow_x() -> f64 {
    2.0
}
fn default_shadow_y() -> f64 {
    3.0
}
fn default_half() -> f64 {
    0.5
}
fn default_align() -> String {
    "center".into()
}
fn default_line_height() -> f64 {
    1.25
}
fn default_one() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineClip {
    pub id: String,
    pub media_path: String,
    pub track_index: usize,
    pub track_kind: String,
    #[serde(default)]
    pub has_audio: bool,
    pub start: f64,
    pub duration: f64,
    pub in_point: f64,
    pub out_point: f64,
    pub effects: ClipEffects,
    #[serde(default)]
    pub text: Option<TextStyle>,
    #[serde(default)]
    pub is_still: bool,
    #[serde(default)]
    pub still_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FreezeResult {
    pub video_path: String,
    pub still_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    pub clips: Vec<TimelineClip>,
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub background_blur: bool,
    pub audio_extract_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProbe {
    pub path: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub has_video: bool,
    pub has_audio: bool,
    pub codec: String,
    pub fps: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegResult {
    pub success: bool,
    pub message: String,
    pub output_path: Option<String>,
}

fn resolve_ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
    // 1) Resource / sidecar locations used by Tauri bundling
    if let Ok(dir) = app.path_resolver_resource_dir() {
        let candidates = [
            dir.join("ffmpeg.exe"),
            dir.join("ffmpeg-x86_64-pc-windows-msvc.exe"),
            dir.join("binaries").join("ffmpeg-x86_64-pc-windows-msvc.exe"),
        ];
        for c in candidates {
            if c.exists() {
                return Ok(c);
            }
        }
    }

    // 2) Next to the running executable (dev + release)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let candidates = [
                parent.join("ffmpeg.exe"),
                parent.join("ffmpeg-x86_64-pc-windows-msvc.exe"),
            ];
            for c in candidates {
                if c.exists() {
                    return Ok(c);
                }
            }
        }
    }

    // 3) Dev-time binaries folder relative to CARGO_MANIFEST_DIR
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join("ffmpeg-x86_64-pc-windows-msvc.exe");
    if dev.exists() {
        return Ok(dev);
    }

    Err("Bundled ffmpeg.exe not found. Ensure externalBin sidecar is present.".into())
}

trait PathResolverExt {
    fn path_resolver_resource_dir(&self) -> Result<PathBuf, String>;
}

impl PathResolverExt for AppHandle {
    fn path_resolver_resource_dir(&self) -> Result<PathBuf, String> {
        use tauri::Manager;
        self.path()
            .resource_dir()
            .map_err(|e| format!("resource_dir: {e}"))
    }
}

pub fn probe_media(app: &AppHandle, path: &str) -> Result<MediaProbe, String> {
    let ffmpeg = resolve_ffmpeg_path(app)?;
    let output = Command::new(&ffmpeg)
        .args(["-hide_banner", "-i", path])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run ffmpeg probe: {e}"))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    parse_probe(path, &stderr)
}

fn parse_probe(path: &str, stderr: &str) -> Result<MediaProbe, String> {
    let mut duration = 0.0_f64;
    let mut width = 0_u32;
    let mut height = 0_u32;
    let mut has_video = false;
    let mut has_audio = false;
    let mut codec = String::from("unknown");
    let mut fps = 30.0_f64;

    for line in stderr.lines() {
        if line.contains("Duration:") {
            if let Some(seg) = line.split("Duration:").nth(1) {
                let time = seg.split(',').next().unwrap_or("").trim();
                duration = parse_timecode(time);
            }
        }
        if line.contains("Video:") {
            has_video = true;
            if let Some(after) = line.split("Video:").nth(1) {
                codec = after
                    .split(',')
                    .next()
                    .unwrap_or("unknown")
                    .trim()
                    .to_string();
                // resolution like 1920x1080
                for token in after.split(',') {
                    let t = token.trim();
                    if let Some((w, h)) = t.split_once('x') {
                        if let (Ok(ww), Ok(hh)) = (
                            w.split_whitespace().last().unwrap_or("").parse::<u32>(),
                            h.split_whitespace()
                                .next()
                                .unwrap_or("")
                                .parse::<u32>(),
                        ) {
                            if ww > 0 && hh > 0 {
                                width = ww;
                                height = hh;
                            }
                        }
                    }
                    if t.contains("fps") {
                        if let Some(f) = t.split_whitespace().next() {
                            if let Ok(v) = f.parse::<f64>() {
                                fps = v;
                            }
                        }
                    }
                }
            }
        }
        if line.contains("Audio:") {
            has_audio = true;
        }
    }

    if duration <= 0.0 && !has_video && !has_audio {
        return Err(format!("Could not probe media: {path}\n{stderr}"));
    }

    Ok(MediaProbe {
        path: path.to_string(),
        duration,
        width,
        height,
        has_video,
        has_audio,
        codec,
        fps,
    })
}

fn parse_timecode(tc: &str) -> f64 {
    let parts: Vec<&str> = tc.split(':').collect();
    if parts.len() != 3 {
        return 0.0;
    }
    let h: f64 = parts[0].parse().unwrap_or(0.0);
    let m: f64 = parts[1].parse().unwrap_or(0.0);
    let s: f64 = parts[2].parse().unwrap_or(0.0);
    h * 3600.0 + m * 60.0 + s
}

fn lerp_keyframes(keys: &[Keyframe], t: f64, fallback: f64) -> f64 {
    if keys.is_empty() {
        return fallback;
    }
    let mut sorted = keys.to_vec();
    sorted.sort_by(|a, b| a.time.partial_cmp(&b.time).unwrap_or(std::cmp::Ordering::Equal));
    if t <= sorted[0].time {
        return sorted[0].value;
    }
    if t >= sorted[sorted.len() - 1].time {
        return sorted[sorted.len() - 1].value;
    }
    for w in sorted.windows(2) {
        if t >= w[0].time && t <= w[1].time {
            let span = (w[1].time - w[0].time).max(1e-6);
            let u = (t - w[0].time) / span;
            return w[0].value + (w[1].value - w[0].value) * u;
        }
    }
    fallback
}

fn effect_filters(fx: &ClipEffects, clip_duration: f64) -> Vec<String> {
    let mut filters = Vec::new();

    // Crop (normalized → relative)
    let cw = fx.crop_w.clamp(0.05, 1.0);
    let ch = fx.crop_h.clamp(0.05, 1.0);
    let cx = fx.crop_x.clamp(0.0, 1.0 - cw);
    let cy = fx.crop_y.clamp(0.0, 1.0 - ch);
    if (cw - 1.0).abs() > 0.001 || (ch - 1.0).abs() > 0.001 || cx > 0.001 || cy > 0.001 {
        filters.push(format!(
            "crop=iw*{cw}:ih*{ch}:iw*{cx}:ih*{cy}"
        ));
    }

    if fx.mirror_h {
        filters.push("hflip".into());
    }
    if fx.mirror_v {
        filters.push("vflip".into());
    }
    if fx.rotation.abs() > 0.01 {
        filters.push(format!(
            "rotate={}:c=black@0:ow=rotw(iw):oh=roth(ih)",
            fx.rotation.to_radians()
        ));
    }

    let mid_t = clip_duration * 0.5;
    let scale = lerp_keyframes(&fx.scale_keyframes, mid_t, fx.scale).max(0.05);
    if (scale - 1.0).abs() > 0.001 {
        filters.push(format!("scale=iw*{scale}:ih*{scale}"));
    }

    let opacity = lerp_keyframes(&fx.opacity_keyframes, mid_t, fx.opacity).clamp(0.0, 1.0);

    // Color adjustments
    let eq = format!(
        "eq=brightness={}:contrast={}:saturation={}",
        fx.brightness.clamp(-1.0, 1.0),
        fx.contrast.clamp(0.0, 3.0),
        fx.saturation.clamp(0.0, 3.0)
    );
    filters.push(eq);

    match fx.effect.as_str() {
        "grayscale" => filters.push("hue=s=0".into()),
        "sepia" => filters.push(
            "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131".into(),
        ),
        "vignette" => filters.push("vignette=PI/4".into()),
        "sharpen" => filters.push("unsharp=5:5:1.0:5:5:0.0".into()),
        "teal_orange" => {
            filters.push("eq=contrast=1.15:saturation=1.35:brightness=0.03".into());
            filters.push("colorbalance=rs=0.12:gs=-0.04:bs=-0.1:rm=0.08:bm=-0.06".into());
        }
        "cyberpunk" => {
            filters.push("eq=contrast=1.25:saturation=1.55:brightness=0.04".into());
            filters.push("hue=h=200:s=1.2".into());
        }
        "noir" => {
            filters.push("hue=s=0".into());
            filters.push("eq=contrast=1.4:brightness=-0.02".into());
        }
        "warm_glow" => {
            filters.push("eq=brightness=0.06:saturation=1.2".into());
            filters.push(
                "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131".into(),
            );
        }
        "cold_blue" => {
            filters.push("eq=contrast=1.1:saturation=1.15".into());
            filters.push("hue=h=190:s=1.1".into());
        }
        "vhs" => {
            filters.push("eq=contrast=1.2:saturation=0.85:brightness=0.02".into());
            filters.push("noise=alls=8:allf=t".into());
        }
        "bloom" => {
            filters.push("eq=brightness=0.08:contrast=0.95:saturation=1.1".into());
            filters.push("gblur=sigma=0.6".into());
        }
        "high_sat" => filters.push("eq=contrast=1.15:saturation=1.8:brightness=0.03".into()),
        _ => {}
    }

    // Tunable filter knobs (from FX layer / clip)
    if fx.sharpness > 0.02 {
        let amt = fx.sharpness.clamp(0.0, 2.0);
        filters.push(format!("unsharp=5:5:{amt}:5:5:0.0"));
    }
    if fx.temperature.abs() > 0.02 || fx.tint.abs() > 0.02 {
        let t = fx.temperature.clamp(-1.0, 1.0);
        let n = fx.tint.clamp(-1.0, 1.0);
        filters.push(format!(
            "colorbalance=rs={:.3}:gs={:.3}:bs={:.3}:rm={:.3}:gm={:.3}:bm={:.3}",
            t * 0.28,
            n * 0.14,
            -t * 0.28,
            t * 0.16,
            n * 0.1,
            -t * 0.16
        ));
    }
    if fx.vignette_amount > 0.02 {
        let a = fx.vignette_amount.clamp(0.05, 1.0);
        filters.push(format!("vignette={}", std::f64::consts::PI / 4.0 * a));
    }
    if fx.soft_blur > 0.05 {
        filters.push(format!("gblur=sigma={}", fx.soft_blur.clamp(0.05, 12.0)));
    }

    if fx.fade_in > 0.02 {
        filters.push(format!("fade=t=in:st=0:d={}", fx.fade_in));
    }
    if fx.fade_out > 0.02 && clip_duration > fx.fade_out {
        let st = (clip_duration - fx.fade_out).max(0.0);
        filters.push(format!("fade=t=out:st={st}:d={}", fx.fade_out));
    }

    if fx.motion_blur > 0.01 {
        let t = (fx.motion_blur.clamp(0.0, 1.0) * 20.0).max(1.0);
        filters.push(format!("tmix=frames={t}:weights=1"));
    }

    if fx.mask_enabled {
        let feather = fx.mask_feather.clamp(0.0, 50.0);
        let x = fx.crop_x.clamp(0.0, 0.45);
        let y = fx.crop_y.clamp(0.0, 0.45);
        let w = fx.crop_w.clamp(0.1, 1.0);
        let h = fx.crop_h.clamp(0.1, 1.0);
        if fx.mask_shape == "circle" {
            // Elliptical alpha window using crop rect as bounds
            filters.push(format!(
                "format=rgba,geq=lum='p(X,Y)':a='if(lte(pow((X-W*({x}+{w}/2))/(W*{w}/2),2)+pow((Y-H*({y}+{h}/2))/(H*{h}/2),2),1),255,0)'"
            ));
        } else {
            filters.push(format!(
                "format=rgba,geq=lum='p(X,Y)':a='if(between(X,W*{x},W*({x}+{w}))*between(Y,H*{y},H*({y}+{h})),255,0)'"
            ));
        }
        if feather > 0.5 {
            filters.push(format!("gblur=sigma={}", (feather * 0.35).max(0.5)));
        }
    }

    if opacity < 0.999 {
        filters.push("format=rgba".into());
        filters.push(format!("colorchannelmixer=aa={opacity}"));
    }

    if fx.reverse {
        filters.push("reverse".into());
    }

    let speed = fx.speed.clamp(0.1, 8.0);
    if (speed - 1.0).abs() > 0.001 {
        filters.push(format!("setpts=PTS/{speed}"));
    }

    filters
}

fn audio_filters(fx: &ClipEffects) -> Vec<String> {
    let mut filters = Vec::new();
    let speed = fx.speed.clamp(0.5, 2.0);
    if (speed - 1.0).abs() > 0.001 {
        filters.push(format!("atempo={speed}"));
    }
    if fx.reverse {
        filters.push("areverse".into());
    }
    let vol = fx.volume.clamp(0.0, 2.0);
    if (vol - 1.0).abs() > 0.01 {
        filters.push(format!("volume={vol}"));
    }
    if fx.audio_fade_in > 0.02 {
        filters.push(format!("afade=t=in:st=0:d={}", fx.audio_fade_in));
    }
    if fx.audio_fade_out > 0.02 {
        filters.push(format!("afade=t=out:d={}", fx.audio_fade_out));
    }
    filters
}

fn escape_drawtext(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace(':', "\\:")
        .replace('\'', "\\'")
        .replace('%', "%%")
        .replace('\n', "\\n")
        .replace('\r', "")
}

fn css_color_to_ffmpeg(color: &str) -> String {
    let c = color.trim();
    if let Some(rest) = c.strip_prefix('#') {
        if rest.len() >= 6 {
            return format!("0x{}", &rest[..6]);
        }
        if rest.len() == 3 {
            let r = rest.chars().nth(0).unwrap();
            let g = rest.chars().nth(1).unwrap();
            let b = rest.chars().nth(2).unwrap();
            return format!("0x{r}{r}{g}{g}{b}{b}");
        }
    }
    if let Some(inner) = c
        .strip_prefix("rgba(")
        .or_else(|| c.strip_prefix("rgb("))
        .and_then(|s| s.strip_suffix(')'))
    {
        let parts: Vec<&str> = inner.split(',').map(|p| p.trim()).collect();
        if parts.len() >= 3 {
            let r: u32 = parts[0].parse().unwrap_or(0);
            let g: u32 = parts[1].parse().unwrap_or(0);
            let b: u32 = parts[2].parse().unwrap_or(0);
            if parts.len() >= 4 {
                let a: f64 = parts[3].parse().unwrap_or(1.0);
                return format!("0x{:02X}{:02X}{:02X}@{}", r, g, b, a.clamp(0.0, 1.0));
            }
            return format!("0x{:02X}{:02X}{:02X}", r, g, b);
        }
    }
    "white".into()
}

fn resolve_fontfile(family: &str) -> Option<String> {
    let fonts = PathBuf::from(r"C:\Windows\Fonts");
    let key = family.to_lowercase();
    let candidates: &[&str] = match key.as_str() {
        "arial" => &["arial.ttf", "arialbd.ttf"],
        "georgia" => &["georgia.ttf"],
        "impact" => &["impact.ttf"],
        "verdana" => &["verdana.ttf"],
        "trebuchet ms" => &["trebuc.ttf"],
        "times new roman" => &["times.ttf"],
        "consolas" => &["consola.ttf"],
        "comic sans ms" => &["comic.ttf"],
        "courier new" => &["cour.ttf"],
        _ => &["segoeui.ttf", "arial.ttf", "tahoma.ttf"],
    };
    for name in candidates {
        let p = fonts.join(name);
        if p.exists() {
            // FFmpeg on Windows wants escaped drive path: C\:/Windows/Fonts/arial.ttf
            let s = p.to_string_lossy().replace('\\', "/");
            return Some(s.replace(':', "\\:"));
        }
    }
    None
}

fn build_drawtext_filter(text: &TextStyle, w: u32, h: u32, enable_start: f64, enable_end: f64) -> String {
    let content = escape_drawtext(&text.content);
    let fontsize = text.font_size.max(8.0).round() as i32;
    let fontcolor = css_color_to_ffmpeg(&text.color);
    let bordercolor = css_color_to_ffmpeg(&text.stroke_color);
    let borderw = text.stroke_width.max(0.0).round() as i32;
    let shadowx = text.shadow_offset_x.round() as i32;
    let shadowy = text.shadow_offset_y.round() as i32;
    let shadowcolor = css_color_to_ffmpeg(&text.shadow_color);
    let alpha = text.opacity.clamp(0.05, 1.0);
    let tx = text.x.clamp(0.0, 1.0);
    let ty = text.y.clamp(0.0, 1.0);

    let x_expr = match text.align.as_str() {
        "left" => format!("W*{tx}"),
        "right" => format!("W*{tx}-text_w"),
        _ => format!("W*{tx}-text_w/2"),
    };
    let y_expr = format!("H*{ty}-text_h/2");

    let mut parts = Vec::new();
    if let Some(fontfile) = resolve_fontfile(&text.font_family) {
        parts.push(format!("fontfile={fontfile}"));
    }
    parts.push(format!("text='{content}'"));
    parts.push(format!("fontsize={fontsize}"));
    parts.push(format!("fontcolor={fontcolor}@{alpha}"));
    if borderw > 0 {
        parts.push(format!("borderw={borderw}"));
        parts.push(format!("bordercolor={bordercolor}"));
    }
    if shadowx != 0 || shadowy != 0 || text.shadow_blur > 0.0 {
        parts.push(format!("shadowx={shadowx}"));
        parts.push(format!("shadowy={shadowy}"));
        parts.push(format!("shadowcolor={shadowcolor}"));
    }
    if text.background_opacity > 0.05 {
        let boxcolor = css_color_to_ffmpeg(&text.background_color);
        parts.push("box=1".into());
        parts.push(format!(
            "boxcolor={}@{}",
            boxcolor,
            text.background_opacity.clamp(0.0, 1.0)
        ));
        parts.push("boxborderw=8".into());
    }
    parts.push(format!("x={x_expr}"));
    parts.push(format!("y={y_expr}"));
    parts.push(format!(
        "enable='between(t,{start},{end})'",
        start = enable_start,
        end = enable_end
    ));

    let _ = (w, h);
    format!("drawtext={}", parts.join(":"))
}

pub fn export_timeline(app: &AppHandle, req: ExportRequest) -> Result<FfmpegResult, String> {
    if req.clips.is_empty() {
        return Err("Timeline is empty.".into());
    }

    let ffmpeg = resolve_ffmpeg_path(app)?;
    let w = req.width.max(16);
    let h = req.height.max(16);
    let fps = if req.fps <= 0.0 { 30.0 } else { req.fps };

    // Sort clips by track then start
    let mut clips = req.clips.clone();
    clips.sort_by(|a, b| {
        a.track_index
            .cmp(&b.track_index)
            .then(a.start.partial_cmp(&b.start).unwrap_or(std::cmp::Ordering::Equal))
    });

    let mut args: Vec<String> = vec!["-y".into(), "-hide_banner".into()];

    // Unique media inputs (skip text / empty paths). Stills use looped jpg.
    let mut input_map: Vec<(String, bool)> = Vec::new();
    for c in &clips {
        if c.track_kind == "text" {
            continue;
        }
        let path = if c.is_still {
            c.still_path
                .clone()
                .filter(|p| !p.trim().is_empty())
                .unwrap_or_else(|| c.media_path.clone())
        } else {
            c.media_path.clone()
        };
        if path.trim().is_empty() {
            continue;
        }
        if !input_map.iter().any(|(p, _)| p == &path) {
            input_map.push((path, c.is_still));
        }
    }
    for (p, is_still) in &input_map {
        if *is_still {
            args.extend(["-loop".into(), "1".into(), "-t".into(), "600".into()]);
        }
        args.push("-i".into());
        args.push(p.clone());
    }

    if req.audio_extract_only {
        // Extract first clip audio
        let c = &clips[0];
        let idx = input_map
            .iter()
            .position(|(p, _)| p == &c.media_path)
            .unwrap_or(0);
        let dur = (c.out_point - c.in_point).abs().max(0.05);
        args.extend([
            "-map".into(),
            format!("{idx}:a:0?"),
            "-ss".into(),
            format!("{}", c.in_point),
            "-t".into(),
            format!("{dur}"),
            "-vn".into(),
            "-acodec".into(),
            "libmp3lame".into(),
            "-q:a".into(),
            "2".into(),
            req.output_path.clone(),
        ]);
        return run_ffmpeg(app, &ffmpeg, &args, &req.output_path, "libmp3lame", dur, false);
    }

    // Build filter_complex
    let mut filter_parts: Vec<String> = Vec::new();
    let mut video_labels: Vec<(String, f64, f64, usize, ClipEffects)> = Vec::new();
    let mut audio_labels: Vec<(String, f64)> = Vec::new();

    // Base canvas
    filter_parts.push(format!(
        "color=c=black:s={w}x{h}:d=36000:r={fps}[base]"
    ));

    for (ci, clip) in clips.iter().enumerate() {
        if clip.track_kind == "text" {
            continue;
        }
        let input_path = if clip.is_still {
            clip.still_path
                .clone()
                .filter(|p| !p.trim().is_empty())
                .unwrap_or_else(|| clip.media_path.clone())
        } else {
            clip.media_path.clone()
        };
        let in_idx = input_map
            .iter()
            .position(|(p, _)| p == &input_path)
            .unwrap_or(0);
        let trim_dur = (clip.out_point - clip.in_point).abs().max(0.05);
        let speed = clip.effects.speed.clamp(0.1, 8.0);
        let out_dur = if clip.is_still {
            clip.duration.max(0.05)
        } else {
            trim_dur / speed
        };

        if clip.track_kind == "audio" || clip.track_kind == "video" {
            // video branch for video tracks
            if clip.track_kind == "video" {
                let mut chain = if clip.is_still {
                    vec![
                        format!("[{in_idx}:v]"),
                        format!("trim=duration={out_dur}"),
                        "setpts=PTS-STARTPTS".into(),
                    ]
                } else {
                    vec![
                        format!("[{in_idx}:v]"),
                        format!("trim=start={}:duration={}", clip.in_point, trim_dur),
                        "setpts=PTS-STARTPTS".into(),
                    ]
                };
                chain.extend(effect_filters(&clip.effects, out_dur));
                // Fit into canvas while preserving aspect, then pad — used for main track
                if clip.track_index == 0 {
                    if req.background_blur {
                        // Prepare blurred background fill + foreground fit
                        let vlabel = format!("v{ci}");
                        let fg = format!("fg{ci}");
                        let bg = format!("bg{ci}");
                        let composed = format!("vc{ci}");
                        // Split path: scale cover blur + scale contain overlay
                        filter_parts.push(format!(
                            "{}{}[{vlabel}]",
                            chain[0],
                            chain[1..].join(",")
                        ));
                        filter_parts.push(format!(
                            "[{vlabel}]split=2[{fg}raw][{bg}raw]"
                        ));
                        filter_parts.push(format!(
                            "[{bg}raw]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},gblur=sigma=20[{bg}]"
                        ));
                        filter_parts.push(format!(
                            "[{fg}raw]scale={w}:{h}:force_original_aspect_ratio=decrease[{fg}]"
                        ));
                        filter_parts.push(format!(
                            "[{bg}][{fg}]overlay=(W-w)/2:(H-h)/2[{composed}]"
                        ));
                        video_labels.push((
                            composed,
                            clip.start,
                            out_dur,
                            clip.track_index,
                            clip.effects.clone(),
                        ));
                    } else {
                        chain.push(format!(
                            "scale={w}:{h}:force_original_aspect_ratio=decrease"
                        ));
                        chain.push(format!("pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black"));
                        chain.push("setsar=1".into());
                        chain.push("format=rgba".into());
                        let label = format!("v{ci}");
                        filter_parts.push(format!(
                            "{}{}[{label}]",
                            chain[0],
                            chain[1..].join(",")
                        ));
                        video_labels.push((
                            label,
                            clip.start,
                            out_dur,
                            clip.track_index,
                            clip.effects.clone(),
                        ));
                    }
                } else {
                    // Overlay / PiP track
                    let pip_w = ((w as f64) * 0.35 * clip.effects.scale.max(0.1)) as u32;
                    chain.push(format!("scale={pip_w}:-2"));
                    chain.push("format=rgba".into());
                    let label = format!("v{ci}");
                    filter_parts.push(format!(
                        "{}{}[{label}]",
                        chain[0],
                        chain[1..].join(",")
                    ));
                    video_labels.push((
                        label,
                        clip.start,
                        out_dur,
                        clip.track_index,
                        clip.effects.clone(),
                    ));
                }
            }

            // Embedded audio from video clips + dedicated audio-track clips.
            // Only when the source actually has an audio stream (not freeze stills).
            if !clip.is_still
                && clip.has_audio
                && (clip.track_kind == "audio" || clip.track_kind == "video")
            {
                let mut a_chain = vec![
                    format!("[{in_idx}:a]"),
                    format!("atrim=start={}:duration={}", clip.in_point, trim_dur),
                    "asetpts=PTS-STARTPTS".into(),
                ];
                a_chain.extend(audio_filters(&clip.effects));
                let alabel = format!("a{ci}");
                filter_parts.push(format!(
                    "{}{}[{alabel}]",
                    a_chain[0],
                    a_chain[1..].join(",")
                ));
                audio_labels.push((alabel, clip.start));
            }
        }
    }

    // Overlay videos onto base in track order
    let mut current = "base".to_string();
    // Enable timeline for delayed overlays
    for (i, (label, start, _dur, track, fx)) in video_labels.iter().enumerate() {
        let next = format!("ov{i}");
        let x = if *track == 0 {
            "(W-w)/2".to_string()
        } else {
            format!("W*{}", fx.pip_x.clamp(0.0, 0.9))
        };
        let y = if *track == 0 {
            "(H-h)/2".to_string()
        } else {
            format!("H*{}", fx.pip_y.clamp(0.0, 0.9))
        };
        filter_parts.push(format!(
            "[{current}][{label}]overlay=x={x}:y={y}:enable='between(t,{start},{end})'[{next}]",
            end = start + _dur
        ));
        current = next;
    }

    // Text overlays (drawtext) after video layers
    let text_clips: Vec<&TimelineClip> = clips
        .iter()
        .filter(|c| c.track_kind == "text" || c.text.is_some())
        .collect();
    for (ti, clip) in text_clips.iter().enumerate() {
        let Some(text) = clip.text.as_ref() else {
            continue;
        };
        if text.content.trim().is_empty() {
            continue;
        }
        let speed = clip.effects.speed.clamp(0.1, 8.0);
        let out_dur = (clip.out_point - clip.in_point).abs().max(0.05) / speed;
        let start = clip.start;
        let end = start + out_dur;
        let next = format!("tx{ti}");

        if text.rotation.abs() < 0.5 {
            let dt = build_drawtext_filter(text, w, h, start, end);
            filter_parts.push(format!("[{current}]{dt}[{next}]"));
            current = next;
        } else {
            // Transparent layer → drawtext → rotate → overlay (timed)
            let rad = text.rotation.to_radians();
            let layer = format!("tl{ti}");
            let rotated = format!("tlr{ti}");
            let mut dt_static = build_drawtext_filter(text, w, h, 0.0, 1.0e6);
            if let Some(idx) = dt_static.find(":enable=") {
                dt_static.truncate(idx);
            }
            filter_parts.push(format!(
                "color=c=black@0.0:s={w}x{h}:d={out_dur}:r={fps},format=rgba,{dt_static}[{layer}]"
            ));
            filter_parts.push(format!(
                "[{layer}]rotate={rad}:c=none:ow=rotw(iw):oh=roth(ih),format=rgba[{rotated}]"
            ));
            filter_parts.push(format!(
                "[{current}][{rotated}]overlay=(W-w)/2:(H-h)/2:enable='between(t,{start},{end})'[{next}]"
            ));
            current = next;
        }
    }

    let final_v = current;

    // Mix audio
    let final_a = if audio_labels.is_empty() {
        filter_parts.push("anullsrc=r=48000:cl=stereo:d=36000[aout]".into());
        "aout".to_string()
    } else if audio_labels.len() == 1 {
        let (label, start) = &audio_labels[0];
        filter_parts.push(format!(
            "[{label}]adelay={ms}|{ms}[aout]",
            ms = (*start * 1000.0).round() as i64
        ));
        "aout".to_string()
    } else {
        let mut mix_inputs = String::new();
        for (i, (label, start)) in audio_labels.iter().enumerate() {
            let delayed = format!("ad{i}");
            filter_parts.push(format!(
                "[{label}]adelay={ms}|{ms}[{delayed}]",
                ms = (*start * 1000.0).round() as i64
            ));
            mix_inputs.push_str(&format!("[{delayed}]"));
        }
        filter_parts.push(format!(
            "{mix_inputs}amix=inputs={}:dropout_transition=0:normalize=0[aout]",
            audio_labels.len()
        ));
        "aout".to_string()
    };

    // Total duration from timeline end
    let total_dur = clips
        .iter()
        .map(|c| {
            let speed = c.effects.speed.clamp(0.1, 8.0);
            c.start + (c.out_point - c.in_point).abs() / speed
        })
        .fold(0.0_f64, f64::max)
        .max(0.1);

    let filter_complex = filter_parts.join(";");
    args.push("-filter_complex".into());
    args.push(filter_complex);
    args.extend([
        "-map".into(),
        format!("[{final_v}]"),
        "-map".into(),
        format!("[{final_a}]"),
        "-t".into(),
        format!("{total_dur}"),
        "-r".into(),
        format!("{fps}"),
        "-pix_fmt".into(),
        "yuv420p".into(),
        "-c:a".into(),
        "aac".into(),
        "-b:a".into(),
        "192k".into(),
        "-movflags".into(),
        "+faststart".into(),
    ]);

    // Prefer NVENC, automatically fall back to libx264 if GPU encode fails.
    let mut nvenc_args = args.clone();
    nvenc_args.extend([
        "-c:v".into(),
        "h264_nvenc".into(),
        "-preset".into(),
        "p4".into(),
        "-rc".into(),
        "vbr".into(),
        "-cq".into(),
        "23".into(),
        "-b:v".into(),
        "0".into(),
        req.output_path.clone(),
    ]);

    emit_export_progress(app, 1.0, total_dur, "Starting NVENC export…");
    match run_ffmpeg(
        app,
        &ffmpeg,
        &nvenc_args,
        &req.output_path,
        "h264_nvenc",
        total_dur,
        true,
    ) {
        Ok(ok) => {
            emit_export_progress(app, 100.0, 0.0, "Export complete");
            Ok(ok)
        }
        Err(nvenc_err) => {
            emit_export_progress(app, 2.0, total_dur, "NVENC failed — trying CPU…");
            let mut cpu_args = args;
            cpu_args.extend([
                "-c:v".into(),
                "libx264".into(),
                "-preset".into(),
                "veryfast".into(),
                "-crf".into(),
                "20".into(),
                req.output_path.clone(),
            ]);
            match run_ffmpeg(
                app,
                &ffmpeg,
                &cpu_args,
                &req.output_path,
                "libx264",
                total_dur,
                true,
            ) {
                Ok(ok) => {
                    emit_export_progress(app, 100.0, 0.0, "Export complete (CPU)");
                    Ok(FfmpegResult {
                        success: true,
                        message: format!(
                            "Export completed with libx264 (NVENC unavailable). {}",
                            ok.message
                        ),
                        output_path: ok.output_path,
                    })
                }
                Err(cpu_err) => Err(format!(
                    "Export failed.\n\nNVENC attempt:\n{}\n\nCPU (libx264) attempt:\n{}",
                    summarize_ffmpeg_error(&nvenc_err),
                    summarize_ffmpeg_error(&cpu_err)
                )),
            }
        }
    }
}

fn summarize_ffmpeg_error(err: &str) -> String {
    let lines: Vec<&str> = err.lines().collect();
    if lines.len() <= 12 {
        return err.to_string();
    }
    // Keep the most useful tail (actual error) plus a short head.
    let head = lines.iter().take(4).cloned().collect::<Vec<_>>().join("\n");
    let tail = lines
        .iter()
        .rev()
        .take(8)
        .cloned()
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n");
    format!("{head}\n…\n{tail}")
}

fn emit_export_progress(app: &AppHandle, percent: f64, eta: f64, message: &str) {
    use tauri::Emitter;
    let _ = app.emit(
        "export-progress",
        ExportProgressEvent {
            percent: percent.clamp(0.0, 100.0),
            eta_seconds: eta.max(0.0),
            message: message.to_string(),
        },
    );
}

fn run_ffmpeg(
    app: &AppHandle,
    ffmpeg: &Path,
    args: &[String],
    output: &str,
    encoder: &str,
    duration: f64,
    with_progress: bool,
) -> Result<FfmpegResult, String> {
    if !with_progress {
        let output_proc = Command::new(ffmpeg)
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .map_err(|e| format!("Failed to spawn ffmpeg: {e}"))?;
        let stderr = String::from_utf8_lossy(&output_proc.stderr).to_string();
        if !output_proc.status.success() {
            return Err(stderr);
        }
        return Ok(FfmpegResult {
            success: true,
            message: format!("Export completed with {encoder}."),
            output_path: Some(output.to_string()),
        });
    }

    use std::io::{BufRead, BufReader};
    use std::time::Instant;

    let mut prog_args = args.to_vec();
    prog_args.push("-progress".into());
    prog_args.push("pipe:1".into());
    prog_args.push("-nostats".into());

    let mut child = Command::new(ffmpeg)
        .args(&prog_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "ffmpeg stdout missing".to_string())?;
    let mut stderr_pipe = child.stderr.take();
    let started = Instant::now();
    let mut last_emit = Instant::now();
    let mut out_time_us: f64 = 0.0;

    for line in BufReader::new(stdout).lines().flatten() {
        if let Some(v) = line.strip_prefix("out_time_ms=") {
            if let Ok(us) = v.trim().parse::<f64>() {
                out_time_us = us;
            }
        } else if let Some(v) = line.strip_prefix("out_time_us=") {
            if let Ok(us) = v.trim().parse::<f64>() {
                out_time_us = us;
            }
        } else if let Some(v) = line.strip_prefix("out_time=") {
            let parts: Vec<&str> = v.trim().split(':').collect();
            if parts.len() == 3 {
                let h: f64 = parts[0].parse().unwrap_or(0.0);
                let m: f64 = parts[1].parse().unwrap_or(0.0);
                let s: f64 = parts[2].parse().unwrap_or(0.0);
                out_time_us = (h * 3600.0 + m * 60.0 + s) * 1_000_000.0;
            }
        } else if line.starts_with("progress=") && duration > 0.05 && last_emit.elapsed().as_millis() > 350
        {
            let done = (out_time_us / 1_000_000.0).max(0.0).min(duration);
            let percent = ((done / duration) * 100.0).clamp(0.0, 99.0);
            let elapsed = started.elapsed().as_secs_f64().max(0.001);
            let rate = done / elapsed;
            let remaining = if rate > 0.05 {
                ((duration - done) / rate).max(0.0)
            } else {
                0.0
            };
            let eta_label = if remaining >= 60.0 {
                format!(
                    "~{m}m {s}s left",
                    m = (remaining / 60.0).floor() as i64,
                    s = (remaining % 60.0).ceil() as i64
                )
            } else {
                format!("~{:.0}s left", remaining)
            };
            emit_export_progress(
                app,
                percent,
                remaining,
                &format!("{encoder}: {percent:.1}% · {eta_label}"),
            );
            last_emit = Instant::now();
        }
    }

    emit_export_progress(app, 99.5, 0.0, &format!("{encoder}: finalizing…"));
    let status = child
        .wait()
        .map_err(|e| format!("ffmpeg wait failed: {e}"))?;
    if !status.success() {
        let mut err = String::new();
        if let Some(ref mut s) = stderr_pipe {
            let _ = std::io::Read::read_to_string(s, &mut err);
        }
        return Err(if err.trim().is_empty() {
            format!("{encoder} encode failed")
        } else {
            err
        });
    }

    Ok(FfmpegResult {
        success: true,
        message: format!("Export completed with {encoder}."),
        output_path: Some(output.to_string()),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewProgressEvent {
    pub source_path: String,
    pub percent: f64,
    pub eta_seconds: f64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgressEvent {
    pub percent: f64,
    pub eta_seconds: f64,
    pub message: String,
}

/// Folder next to the running .exe (target/debug or target/release).
pub fn exe_workdir() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| format!("current_exe: {e}"))?;
    exe.parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "Could not resolve application folder".into())
}

pub fn projects_dir() -> Result<PathBuf, String> {
    let dir = exe_workdir()?.join("projects");
    std::fs::create_dir_all(&dir).map_err(|e| format!("projects dir: {e}"))?;
    Ok(dir)
}

pub fn proxies_dir() -> Result<PathBuf, String> {
    let dir = exe_workdir()?.join("proxies");
    std::fs::create_dir_all(&dir).map_err(|e| format!("proxies dir: {e}"))?;
    Ok(dir)
}

fn emit_progress(app: &AppHandle, source: &str, percent: f64, eta: f64, message: &str) {
    use tauri::Emitter;
    let _ = app.emit(
        "preview-progress",
        PreviewProgressEvent {
            source_path: source.to_string(),
            percent: percent.clamp(0.0, 100.0),
            eta_seconds: eta.max(0.0),
            message: message.to_string(),
        },
    );
}

fn run_ffmpeg_with_progress(
    app: &AppHandle,
    ffmpeg: &Path,
    mut args: Vec<String>,
    source: &str,
    duration: f64,
) -> Result<(), String> {
    use std::io::{BufRead, BufReader};
    use std::time::Instant;

    args.push("-progress".into());
    args.push("pipe:1".into());
    args.push("-nostats".into());

    let mut child = Command::new(ffmpeg)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("proxy ffmpeg spawn: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "ffmpeg stdout missing".to_string())?;
    let mut stderr_pipe = child.stderr.take();
    let started = Instant::now();
    let mut last_emit = Instant::now();
    let reader = BufReader::new(stdout);
    // FFmpeg names this out_time_ms but the value is MICROSECONDS.
    let mut out_time_us: f64 = 0.0;

    for line in reader.lines().flatten() {
        if let Some(v) = line.strip_prefix("out_time_ms=") {
            if let Ok(us) = v.trim().parse::<f64>() {
                out_time_us = us;
            }
        } else if let Some(v) = line.strip_prefix("out_time_us=") {
            if let Ok(us) = v.trim().parse::<f64>() {
                out_time_us = us;
            }
        } else if let Some(v) = line.strip_prefix("out_time=") {
            // Format: HH:MM:SS.microseconds
            let parts: Vec<&str> = v.trim().split(':').collect();
            if parts.len() == 3 {
                let h: f64 = parts[0].parse().unwrap_or(0.0);
                let m: f64 = parts[1].parse().unwrap_or(0.0);
                let s: f64 = parts[2].parse().unwrap_or(0.0);
                out_time_us = (h * 3600.0 + m * 60.0 + s) * 1_000_000.0;
            }
        } else if line.starts_with("progress=") {
            if duration > 0.05 && last_emit.elapsed().as_millis() > 400 {
                let done = (out_time_us / 1_000_000.0).max(0.0).min(duration);
                let percent = ((done / duration) * 100.0).clamp(0.0, 99.0);
                let elapsed = started.elapsed().as_secs_f64().max(0.001);
                let rate = done / elapsed;
                let remaining = if rate > 0.05 {
                    ((duration - done) / rate).max(0.0)
                } else if percent < 1.0 {
                    duration
                } else {
                    0.0
                };
                let eta_label = if remaining >= 60.0 {
                    format!(
                        "~{m}m {s}s left",
                        m = (remaining / 60.0).floor() as i64,
                        s = (remaining % 60.0).ceil() as i64
                    )
                } else {
                    format!("~{:.0}s left", remaining)
                };
                emit_progress(
                    app,
                    source,
                    percent,
                    remaining,
                    &format!("{percent:.1}% · {eta_label}"),
                );
                last_emit = Instant::now();
            }
        }
    }

    emit_progress(app, source, 99.5, 0.0, "Finalizing preview file…");

    let status = child
        .wait()
        .map_err(|e| format!("proxy ffmpeg wait: {e}"))?;
    if !status.success() {
        let mut err = String::new();
        if let Some(ref mut s) = stderr_pipe {
            let _ = std::io::Read::read_to_string(s, &mut err);
        }
        return Err(if err.trim().is_empty() {
            "ffmpeg proxy encode failed".into()
        } else {
            err
        });
    }
    Ok(())
}

/// Build an H.264 preview proxy so WebView2 can play codecs like HEVC.
/// Proxies live next to the .exe under `proxies/`.
pub fn create_preview_proxy(app: &AppHandle, path: &str) -> Result<String, String> {
    let probe = probe_media(app, path)?;
    if !probe.has_video {
        return Ok(path.to_string());
    }

    let codec = probe.codec.to_lowercase();
    let browser_friendly = codec.contains("h264")
        || codec.contains("avc")
        || codec.contains("vp8")
        || codec.contains("vp9")
        || codec.contains("av01")
        || codec.contains("av1");

    if browser_friendly {
        emit_progress(app, path, 100.0, 0.0, "Ready");
        return Ok(path.to_string());
    }

    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    if let Ok(m) = std::fs::metadata(path) {
        m.len().hash(&mut hasher);
        if let Ok(modified) = m.modified() {
            if let Ok(dur) = modified.duration_since(std::time::UNIX_EPOCH) {
                dur.as_secs().hash(&mut hasher);
            }
        }
    }
    let token = format!("{:x}", hasher.finish());

    let dir = proxies_dir()?;
    let out = dir.join(format!("{token}_preview.mp4"));
    let thumb = dir.join(format!("{token}_thumb.jpg"));
    if out.exists() && out.metadata().map(|m| m.len() > 1024).unwrap_or(false) {
        emit_progress(app, path, 100.0, 0.0, "Ready (cached)");
        return Ok(out.to_string_lossy().to_string());
    }

    let ffmpeg = resolve_ffmpeg_path(app)?;
    let out_str = out.to_string_lossy().to_string();
    emit_progress(app, path, 1.0, probe.duration, "Starting preview encode…");

    let nvenc_args = vec![
        "-y".into(),
        "-hide_banner".into(),
        "-hwaccel".into(),
        "auto".into(),
        "-i".into(),
        path.to_string(),
        "-vf".into(),
        "scale=-2:540".into(),
        "-c:v".into(),
        "h264_nvenc".into(),
        "-preset".into(),
        "p1".into(),
        "-rc".into(),
        "constqp".into(),
        "-qp".into(),
        "28".into(),
        "-c:a".into(),
        "aac".into(),
        "-b:a".into(),
        "96k".into(),
        "-ac".into(),
        "2".into(),
        "-movflags".into(),
        "+faststart".into(),
        out_str.clone(),
    ];

    if let Err(nvenc_err) =
        run_ffmpeg_with_progress(app, &ffmpeg, nvenc_args, path, probe.duration.max(0.1))
    {
        let _ = std::fs::remove_file(&out);
        emit_progress(app, path, 2.0, probe.duration, "NVENC failed, trying CPU…");
        let cpu_args = vec![
            "-y".into(),
            "-hide_banner".into(),
            "-i".into(),
            path.to_string(),
            "-vf".into(),
            "scale=-2:540".into(),
            "-c:v".into(),
            "libx264".into(),
            "-preset".into(),
            "ultrafast".into(),
            "-crf".into(),
            "28".into(),
            "-c:a".into(),
            "aac".into(),
            "-b:a".into(),
            "96k".into(),
            "-ac".into(),
            "2".into(),
            "-movflags".into(),
            "+faststart".into(),
            out_str.clone(),
        ];
        if let Err(cpu_err) =
            run_ffmpeg_with_progress(app, &ffmpeg, cpu_args, path, probe.duration.max(0.1))
        {
            let _ = std::fs::remove_file(&out);
            return Err(format!("Preview proxy failed:\n{cpu_err}\n(NVENC: {nvenc_err})"));
        }
    }

    let _ = Command::new(&ffmpeg)
        .args([
            "-y",
            "-hide_banner",
            "-ss",
            "0.5",
            "-i",
            &out_str,
            "-frames:v",
            "1",
            "-q:v",
            "4",
            &thumb.to_string_lossy(),
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    emit_progress(app, path, 100.0, 0.0, "Ready");
    Ok(out_str)
}

pub fn preview_thumb_path(preview_path: &str) -> Option<String> {
    let name = Path::new(preview_path).file_stem()?.to_string_lossy();
    if !name.ends_with("_preview") {
        return None;
    }
    let token = name.trim_end_matches("_preview");
    let thumb = proxies_dir().ok()?.join(format!("{token}_thumb.jpg"));
    if thumb.exists() {
        Some(thumb.to_string_lossy().to_string())
    } else {
        None
    }
}

/// Grab one frame at `time` and build a short preview video + still jpg (extendable).
pub fn create_freeze_clip(
    app: &AppHandle,
    source: &str,
    time: f64,
    duration: f64,
    fps: f64,
) -> Result<FreezeResult, String> {
    let ffmpeg = resolve_ffmpeg_path(app)?;
    let dir = proxies_dir()?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let still = dir.join(format!("freeze_{stamp}.jpg"));
    let out = dir.join(format!("freeze_{stamp}.mp4"));
    let t = time.max(0.0);
    let dur = duration.clamp(0.2, 30.0);
    let rate = if fps <= 0.0 { 30.0 } else { fps };

    let still_str = still.to_string_lossy().to_string();
    let out_str = out.to_string_lossy().to_string();
    let ss = format!("{t:.3}");
    let dur_s = format!("{dur:.3}");
    let rate_s = format!("{rate}");

    // 1) Still frame
    let status = Command::new(&ffmpeg)
        .args([
            "-y",
            "-hide_banner",
            "-ss",
            &ss,
            "-i",
            source,
            "-frames:v",
            "1",
            "-q:v",
            "2",
            &still_str,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .status()
        .map_err(|e| format!("freeze still spawn: {e}"))?;
    if !status.success() || !still.exists() {
        return Err("Could not capture freeze frame from this clip.".into());
    }

    // 2) Short H.264 preview (browser); timeline length can exceed this via isStill
    let status2 = Command::new(&ffmpeg)
        .args([
            "-y",
            "-hide_banner",
            "-loop",
            "1",
            "-i",
            &still_str,
            "-t",
            &dur_s,
            "-r",
            &rate_s,
            "-vf",
            "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-an",
            &out_str,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .status()
        .map_err(|e| format!("freeze encode spawn: {e}"))?;
    if !status2.success() || !out.exists() {
        return Err("Could not build freeze clip.".into());
    }

    Ok(FreezeResult {
        video_path: out_str,
        still_path: still_str,
    })
}

/// Extract audio from a media file into the proxies folder (no Save dialog).
pub fn extract_media_audio(
    app: &AppHandle,
    source: &str,
    in_point: f64,
    out_point: f64,
) -> Result<String, String> {
    let ffmpeg = resolve_ffmpeg_path(app)?;
    let dir = proxies_dir()?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let out = dir.join(format!("audio_{stamp}.mp3"));
    let out_str = out.to_string_lossy().to_string();
    let start = in_point.max(0.0);
    let dur = (out_point - in_point).abs().max(0.05);
    let ss = format!("{start:.3}");
    let t = format!("{dur:.3}");

    let status = Command::new(&ffmpeg)
        .args([
            "-y",
            "-hide_banner",
            "-ss",
            &ss,
            "-i",
            source,
            "-t",
            &t,
            "-vn",
            "-acodec",
            "libmp3lame",
            "-q:a",
            "2",
            &out_str,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .status()
        .map_err(|e| format!("extract audio spawn: {e}"))?;
    if !status.success() || !out.exists() {
        return Err("Could not extract audio from this clip.".into());
    }
    Ok(out_str)
}
