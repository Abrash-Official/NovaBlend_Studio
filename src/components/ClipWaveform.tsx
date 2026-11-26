import { useEffect, useMemo, useRef, useState } from "react";
import {
  getWaveformWindow,
  WAVE_BUCKETS_PER_WINDOW,
  WAVE_WINDOW_SEC,
} from "../lib/waveform";

type Props = {
  path: string;
  width: number;
  height: number;
  mode?: "fill" | "overlay";
  color?: string;
  peakColor?: string;
  inPoint?: number;
  outPoint?: number;
  mediaDuration?: number;
  amplitude?: number;
  className?: string;
  clipLeftPx?: number;
  scrollLeft?: number;
  viewportWidth?: number;
  zoom?: number;
};

type Chunk = { start: number; peaks: Float32Array };

/** CapCut-style dense bars across the visible window (~2.2px each). */
function densePeaks(
  chunks: Chunk[],
  mediaStart: number,
  mediaEnd: number,
  barCount: number,
): Float32Array {
  const out = new Float32Array(barCount);
  const span = Math.max(0.05, mediaEnd - mediaStart);
  const sorted = [...chunks].sort((a, b) => a.start - b.start);
  for (let i = 0; i < barCount; i++) {
    const t = mediaStart + ((i + 0.5) / barCount) * span;
    let peak = 0.06;
    for (const c of sorted) {
      if (t >= c.start && t < c.start + WAVE_WINDOW_SEC && c.peaks.length) {
        const u = (t - c.start) / WAVE_WINDOW_SEC;
        const idx = Math.min(
          c.peaks.length - 1,
          Math.max(0, Math.floor(u * c.peaks.length)),
        );
        peak = Math.max(0.04, c.peaks[idx]);
        break;
      }
    }
    out[i] = peak;
  }
  return out;
}

export function ClipWaveform({
  path,
  width,
  height,
  mode = "fill",
  color = "rgba(96, 170, 255, 0.95)",
  peakColor = "rgba(255, 140, 70, 0.95)",
  inPoint = 0,
  outPoint,
  mediaDuration,
  amplitude = 1,
  className,
  clipLeftPx = 0,
  scrollLeft = 0,
  viewportWidth = 800,
  zoom = 40,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [chunks, setChunks] = useState<Chunk[]>([]);

  const out = outPoint ?? mediaDuration ?? inPoint + 1;

  const view = useMemo(() => {
    const localStart = Math.max(0, scrollLeft - clipLeftPx);
    const localEnd = localStart + Math.max(120, viewportWidth);
    const drawW = Math.min(width, Math.max(120, viewportWidth + 80));
    const mediaStart = inPoint + localStart / Math.max(0.05, zoom);
    const mediaEnd = inPoint + localEnd / Math.max(0.05, zoom);
    return {
      localStart,
      drawW,
      mediaStart: Math.max(inPoint, Math.min(out, mediaStart) - 0.5),
      mediaEnd: Math.max(inPoint, Math.min(out, mediaEnd) + 0.5),
    };
  }, [scrollLeft, clipLeftPx, viewportWidth, width, inPoint, out, zoom]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setVisible(e.isIntersecting);
      },
      { root: null, rootMargin: "80px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!path || width < 8 || !visible) return;
    let cancelled = false;

    const win = WAVE_WINDOW_SEC;
    const starts: number[] = [];
    for (
      let t = Math.floor(view.mediaStart / win) * win;
      t < view.mediaEnd;
      t += win
    ) {
      if (t + 0.01 >= inPoint && t < out) starts.push(Math.max(inPoint, t));
    }
    if (!starts.length) starts.push(Math.max(inPoint, view.mediaStart));
    const limited = starts.slice(0, 3);

    // More buckets for denser CapCut look in each FFmpeg window
    const buckets = Math.max(
      WAVE_BUCKETS_PER_WINDOW,
      Math.min(400, Math.round((win * zoom) / 2.2)),
    );

    void (async () => {
      for (const start of limited) {
        if (cancelled) return;
        const dur = Math.min(win, out - start);
        try {
          const peaks = await getWaveformWindow(path, start, dur, buckets);
          if (cancelled) return;
          setChunks((prev) => {
            const next = prev.filter((c) => Math.abs(c.start - start) > 0.01);
            next.push({ start, peaks });
            return next;
          });
        } catch {
          /* ignore */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [path, width, visible, inPoint, out, view.mediaStart, view.mediaEnd, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || view.drawW < 4 || height < 4) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(view.drawW * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${view.drawW}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.drawW, height);

    const barCount = Math.max(
      32,
      Math.min(520, Math.round(view.drawW / 2.2)),
    );
    const peaks = densePeaks(
      chunks,
      view.mediaStart,
      view.mediaEnd,
      barCount,
    );
    const volScale = Math.max(0.05, Math.min(2.2, amplitude));
    const gap = 0.55;
    const barW = Math.max(1.15, view.drawW / barCount - gap);
    const mid = height / 2;
    let hasReal = chunks.some((c) => c.peaks.length > 0);

    if (!hasReal) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = mode === "overlay" ? "rgba(255,255,255,0.35)" : color;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.72);
      ctx.lineTo(view.drawW, height * 0.72);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    if (mode === "fill") {
      // CapCut: mountains growing UP from the bottom
      const maxH = height * 0.94;
      const tipH = Math.max(1.5, height * 0.1);
      for (let i = 0; i < barCount; i++) {
        const amp = Math.max(0.05, Math.min(1.25, peaks[i] * volScale));
        const h = Math.max(2, Math.min(maxH, amp * maxH));
        const x = (i / barCount) * view.drawW + gap / 2;
        const y = height - h;
        ctx.globalAlpha = 0.78 + Math.min(1, amp) * 0.22;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, barW, h);
        if (amp > 0.55) {
          ctx.globalAlpha = 0.5 + Math.min(1, (amp - 0.55) / 0.45) * 0.45;
          ctx.fillStyle = peakColor;
          ctx.fillRect(x, y, barW, Math.min(tipH, h * 0.22));
        }
      }
    } else {
      // Overlay on video: mirrored bars through center
      const maxH = height * 0.9;
      for (let i = 0; i < barCount; i++) {
        const amp = Math.max(0.05, peaks[i] * volScale);
        const h = Math.min(maxH, amp * maxH);
        const x = (i / barCount) * view.drawW;
        ctx.globalAlpha = 0.28 + Math.min(1, amp) * 0.55;
        ctx.fillStyle = color;
        ctx.fillRect(x, mid - h / 2, Math.max(1, barW), Math.max(1, h));
      }
    }
    ctx.globalAlpha = 1;
  }, [
    chunks,
    view,
    height,
    mode,
    color,
    peakColor,
    amplitude,
  ]);

  if (!path || width < 8) return null;

  return (
    <div
      ref={hostRef}
      style={{
        position: "absolute",
        left: Math.max(0, view.localStart),
        width: view.drawW,
        height,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          display: "block",
          width: view.drawW,
          height,
          pointerEvents: "none",
          background: "transparent",
        }}
      />
    </div>
  );
}
