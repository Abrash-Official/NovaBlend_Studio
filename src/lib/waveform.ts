import { invoke } from "@tauri-apps/api/core";

const cache = new Map<string, Float32Array>();
const inflight = new Map<string, Promise<Float32Array>>();

export const WAVE_WINDOW_SEC = 60;
export const WAVE_BUCKETS_PER_WINDOW = 120;

function cacheKey(
  path: string,
  start: number,
  duration: number,
  buckets: number,
) {
  return `${path}|${start.toFixed(2)}|${duration.toFixed(2)}|${buckets}`;
}

/** Windowed FFmpeg peaks — never fetches multi-GB files into WebAudio. */
export async function getWaveformWindow(
  path: string,
  startSec: number,
  durationSec: number,
  buckets = WAVE_BUCKETS_PER_WINDOW,
): Promise<Float32Array> {
  if (!path) return new Float32Array(buckets);
  const key = cacheKey(path, startSec, durationSec, buckets);
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    try {
      const raw = await invoke<number[]>("get_waveform_window", {
        path,
        startSec,
        durationSec,
        buckets,
      });
      const peaks = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) peaks[i] = raw[i];
      cache.set(key, peaks);
      return peaks;
    } catch {
      return new Float32Array(buckets);
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, job);
  return job;
}

/** @deprecated Prefer getWaveformWindow — kept for any leftover callers. */
export async function getWaveformPeaks(
  path: string,
  bars = 256,
): Promise<Float32Array> {
  return getWaveformWindow(path, 0, WAVE_WINDOW_SEC, bars);
}

export function slicePeaks(
  peaks: Float32Array,
  inPoint: number,
  outPoint: number,
  mediaDuration: number,
): Float32Array {
  if (!peaks.length || mediaDuration <= 0.01) return peaks;
  const a = Math.max(0, Math.min(1, inPoint / mediaDuration));
  const b = Math.max(a + 0.001, Math.min(1, outPoint / mediaDuration));
  const start = Math.floor(a * peaks.length);
  const end = Math.max(start + 1, Math.ceil(b * peaks.length));
  return peaks.subarray(start, end);
}
