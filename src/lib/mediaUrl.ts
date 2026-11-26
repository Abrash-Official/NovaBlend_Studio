import { convertFileSrc, invoke } from "@tauri-apps/api/core";

const urlCache = new Map<string, string>();

/**
 * Prefer the local HTTP range server for multi-GB video streaming.
 * Falls back to Tauri asset:// if the server isn't up yet.
 */
export async function resolveMediaUrl(path: string): Promise<string> {
  if (!path) return "";
  const hit = urlCache.get(path);
  if (hit) return hit;
  try {
    const url = await invoke<string>("resolve_media_url", { path });
    urlCache.set(path, url);
    return url;
  } catch {
    const fallback = convertFileSrc(path);
    urlCache.set(path, fallback);
    return fallback;
  }
}

/** Sync-ish helper when a URL was already resolved / for thumbs. */
export function mediaUrlCachedOrAsset(path: string): string {
  return urlCache.get(path) || convertFileSrc(path);
}

/** Probe whether WebView2 can natively decode this file (HEVC hardware). */
export async function canNativeDecode(
  path: string,
  timeoutMs = 1500,
): Promise<boolean> {
  const url = await resolveMediaUrl(path);
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    video.onloadeddata = () => {
      finish(video.videoWidth > 0 && video.videoHeight > 0);
    };
    video.onerror = () => finish(false);
    video.src = url;
  });
}
