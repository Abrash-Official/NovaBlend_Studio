import { convertFileSrc } from "@tauri-apps/api/core";

/** Bucketed frame cache: path → bucketSec → dataURL */
const frameCache = new Map<string, Map<number, string>>();
const inflight = new Map<string, Promise<string | null>>();

/** One shared decoder per media path (serialized) so filmstrip doesn't fight preview. */
const pathVideos = new Map<string, HTMLVideoElement>();
const pathQueues = new Map<string, Promise<unknown>>();

function bucketKey(path: string, time: number, bucket = 0.25) {
  const t = Math.max(0, Math.round(time / bucket) * bucket);
  return `${path}::${t.toFixed(2)}`;
}

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    const onErr = () => {
      cleanup();
      reject(new Error("video load failed"));
    };
    const onReady = () => {
      cleanup();
      resolve(video);
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onErr);
    };
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onErr);
    video.src = src;
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = Math.max(
      0,
      Math.min(time, Math.max(0, (video.duration || time) - 0.04)),
    );
    if (Math.abs(video.currentTime - target) < 0.04 && video.readyState >= 2) {
      resolve();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
      resolve();
    };
    const onErr = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
      reject(new Error("seek failed"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onErr);
    try {
      video.currentTime = target;
    } catch {
      onErr();
    }
  });
}

async function videoForPath(path: string): Promise<HTMLVideoElement> {
  const existing = pathVideos.get(path);
  if (existing && existing.dataset.src && existing.readyState >= 1) {
    return existing;
  }
  const src = convertFileSrc(path);
  const video = await loadVideo(src);
  video.dataset.src = src;
  pathVideos.set(path, video);
  return video;
}

function enqueuePath<T>(path: string, job: () => Promise<T>): Promise<T> {
  const prev = pathQueues.get(path) ?? Promise.resolve();
  const next = prev.then(job, job);
  pathQueues.set(
    path,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

/** Capture one frame as a data URL (cached). */
export async function captureFilmFrame(
  path: string,
  time: number,
): Promise<string | null> {
  if (!path) return null;
  const pathCache = frameCache.get(path) ?? new Map<number, string>();
  if (!frameCache.has(path)) frameCache.set(path, pathCache);
  const bucket = Math.round(time / 0.25) * 0.25;
  const hit = pathCache.get(bucket);
  if (hit) return hit;

  const key = bucketKey(path, time);
  const existing = inflight.get(key);
  if (existing) return existing;

  const job = enqueuePath(path, async () => {
    try {
      const cached = pathCache.get(bucket);
      if (cached) return cached;
      const video = await videoForPath(path);
      await seek(video, bucket);
      const w = Math.max(1, video.videoWidth || 160);
      const h = Math.max(1, video.videoHeight || 90);
      const maxW = 120;
      const scale = Math.min(1, maxW / w);
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx || !video.videoWidth) return null;
      ctx.drawImage(video, 0, 0, cw, ch);
      const url = canvas.toDataURL("image/jpeg", 0.72);
      pathCache.set(bucket, url);
      return url;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  });

  inflight.set(key, job);
  return job;
}

export function filmCellCount(widthPx: number, cellW = 56): number {
  return Math.max(1, Math.ceil(widthPx / cellW));
}
