import { convertFileSrc, invoke } from "@tauri-apps/api/core";

/** path → bucket → asset URL */
const frameCache = new Map<string, Map<number, string>>();
const inflight = new Map<string, Promise<string | null>>();

/** CapCut-like media gaps (seconds) while zooming out. */
const MEDIA_GAPS = [0.5, 1, 2, 4, 8, 16, 30, 60, 120, 300];

export type FilmPlan = {
  times: number[];
  cellW: number;
  offsets: number[];
};

/**
 * CapCut filmstrip: each cell has a FIXED pixel width (gap × zoom), never stretched
 * across the whole clip. Only cells intersecting the viewport are returned.
 */
export function planFilmstrip(
  widthPx: number,
  zoomPxPerSec: number,
  inPoint: number,
  outPoint: number,
  visiblePx?: { start: number; end: number },
): FilmPlan {
  const span = Math.max(0.05, outPoint - inPoint);
  const z = Math.max(0.05, zoomPxPerSec);
  const minCellPx = 48;

  let gap = MEDIA_GAPS[MEDIA_GAPS.length - 1];
  for (const g of MEDIA_GAPS) {
    if (g * z >= minCellPx) {
      gap = g;
      break;
    }
  }

  // Natural CapCut cell width = seconds × px/sec (readable thumbs, no smear)
  const cellW = Math.max(minCellPx, gap * z);
  const totalCells = Math.max(1, Math.ceil(span / gap));

  const v0 = visiblePx ? visiblePx.start - cellW : 0;
  const v1 = visiblePx
    ? visiblePx.end + cellW
    : Math.min(widthPx, cellW * 48);

  const times: number[] = [];
  const offsets: number[] = [];
  const maxVisible = 48;

  for (let i = 0; i < totalCells; i++) {
    const x0 = i * cellW;
    if (x0 > widthPx) break;
    if (x0 + cellW < v0 || x0 > v1) continue;
    times.push(inPoint + Math.min(span - 0.01, (i + 0.5) * gap));
    offsets.push(x0);
    if (times.length >= maxVisible) break;
  }

  if (!times.length && totalCells > 0) {
    const mid = visiblePx
      ? (visiblePx.start + visiblePx.end) / 2
      : cellW / 2;
    const i = Math.min(totalCells - 1, Math.max(0, Math.floor(mid / cellW)));
    times.push(inPoint + Math.min(span - 0.01, (i + 0.5) * gap));
    offsets.push(i * cellW);
  }

  return { times, cellW, offsets };
}

/** FFmpeg JPEG film frame (HEVC-safe). */
export async function captureFilmFrame(
  path: string,
  time: number,
): Promise<string | null> {
  if (!path) return null;
  const bucket = Math.round(time * 2) / 2;
  const pathCache = frameCache.get(path) ?? new Map<number, string>();
  if (!frameCache.has(path)) frameCache.set(path, pathCache);
  const hit = pathCache.get(bucket);
  if (hit) return hit;

  const key = `${path}::${bucket.toFixed(1)}`;
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    try {
      const file = await invoke<string>("extract_film_frame", {
        path,
        time: bucket,
      });
      const url = convertFileSrc(file);
      pathCache.set(bucket, url);
      return url;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, job);
  return job;
}

export function filmCellCount(widthPx: number, cellW = 56): number {
  return Math.max(1, Math.min(48, Math.ceil(widthPx / cellW)));
}
