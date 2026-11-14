mod ffmpeg_engine;

use ffmpeg_engine::{ExportRequest, FfmpegResult, FreezeResult, MediaProbe};
use tauri::AppHandle;

#[tauri::command]
fn probe_media(app: AppHandle, path: String) -> Result<MediaProbe, String> {
    ffmpeg_engine::probe_media(&app, &path)
}

#[tauri::command]
async fn create_preview_proxy(app: AppHandle, path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ffmpeg_engine::create_preview_proxy(&app, &path)
    })
    .await
    .map_err(|e| format!("proxy task failed: {e}"))?
}

#[tauri::command]
fn preview_thumb_path(preview_path: String) -> Option<String> {
    ffmpeg_engine::preview_thumb_path(&preview_path)
}

#[tauri::command]
fn get_projects_dir() -> Result<String, String> {
    ffmpeg_engine::projects_dir().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn get_app_workdir() -> Result<String, String> {
    ffmpeg_engine::exe_workdir().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
async fn export_timeline(app: AppHandle, request: ExportRequest) -> Result<FfmpegResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ffmpeg_engine::export_timeline(&app, request)
    })
    .await
    .map_err(|e| format!("export task failed: {e}"))?
}

#[tauri::command]
async fn extract_audio(app: AppHandle, request: ExportRequest) -> Result<FfmpegResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut req = request;
        req.audio_extract_only = true;
        ffmpeg_engine::export_timeline(&app, req)
    })
    .await
    .map_err(|e| format!("extract task failed: {e}"))?
}

#[tauri::command]
fn split_hint(playhead: f64, clip_start: f64, clip_in: f64, clip_out: f64) -> Result<(f64, f64), String> {
    if playhead <= clip_start {
        return Err("Playhead is before the clip.".into());
    }
    let local = playhead - clip_start;
    let split_src = clip_in + local;
    if split_src <= clip_in || split_src >= clip_out {
        return Err("Playhead is outside the clip range.".into());
    }
    Ok((split_src, split_src))
}

#[tauri::command]
async fn create_freeze_clip(
    app: AppHandle,
    path: String,
    time: f64,
    duration: f64,
    fps: f64,
) -> Result<FreezeResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ffmpeg_engine::create_freeze_clip(&app, &path, time, duration, fps)
    })
    .await
    .map_err(|e| format!("freeze task failed: {e}"))?
}

#[tauri::command]
async fn extract_media_audio(
    app: AppHandle,
    path: String,
    in_point: f64,
    out_point: f64,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ffmpeg_engine::extract_media_audio(&app, &path, in_point, out_point)
    })
    .await
    .map_err(|e| format!("extract audio task failed: {e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            probe_media,
            create_preview_proxy,
            preview_thumb_path,
            get_projects_dir,
            get_app_workdir,
            export_timeline,
            extract_audio,
            split_hint,
            create_freeze_clip,
            extract_media_audio
        ])
        .run(tauri::generate_context!())
        .expect("error while running NovaBlend Studio");
}
