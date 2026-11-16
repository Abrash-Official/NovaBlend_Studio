import { convertFileSrc } from "@tauri-apps/api/core";

const cache = new Map<string, Float32Array>();
const inflight = new Map<string, Promise<Float32Array>>();

/** Deterministic soft noise when decode fails (still looks like a waveform). */
function fallbackPeaks(seed: string, bars: number): Float32Array {
  const out = new Float32Array(bars);
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = 0; i < bars; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const n = (h >>> 0) / 0xffffffff;
    const envelope = 0.35 + 0.65 * Math.sin((i / bars) * Math.PI);
    out[i] = Math.min(1, 0.18 + n * 0.82 * envelope);
  }
  return out;
}

function downsample(channel: Float32Array, bars: number): Float32Array {
  const out = new Float32Array(bars);
  const block = Math.max(1, Math.floor(channel.length / bars));
  for (let i = 0; i < bars; i++) {
    const start = i * block;
    const end = Math.min(channel.length, start + block);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(channel[j]);
      if (v > peak) peak = v;
    }
    out[i] = peak;
  }
  // Normalize
  let max = 0.0001;
  for (let i = 0; i < bars; i++) max = Math.max(max, out[i]);
  for (let i = 0; i < bars; i++) out[i] = Math.min(1, out[i] / max);
  return out;
}

/** Peak envelope for timeline drawing. Cached per path. */
export async function getWaveformPeaks(
  path: string,
  bars = 256,
): Promise<Float32Array> {
  if (!path) return fallbackPeaks("empty", bars);
  const key = `${path}::${bars}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    try {
      const url = convertFileSrc(path);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const raw = await res.arrayBuffer();
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      try {
        const decoded = await ctx.decodeAudioData(raw.slice(0));
        const ch = decoded.getChannelData(0);
        const peaks = downsample(ch, bars);
        cache.set(key, peaks);
        return peaks;
      } finally {
        void ctx.close();
      }
    } catch {
      const peaks = fallbackPeaks(path, bars);
      cache.set(key, peaks);
      return peaks;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, job);
  return job;
}

/** Slice peaks for a clip's in/out window against full media duration. */
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
