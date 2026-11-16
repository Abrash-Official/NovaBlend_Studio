import { useEffect, useRef, useState } from "react";
import { getWaveformPeaks, slicePeaks } from "../lib/waveform";

type Props = {
  path: string;
  width: number;
  height: number;
  /** "fill" = audio track bars; "overlay" = faint wave on video clip */
  mode?: "fill" | "overlay";
  color?: string;
  inPoint?: number;
  outPoint?: number;
  mediaDuration?: number;
  /** Live volume scale (1 = unity). Wave height follows this. */
  amplitude?: number;
  className?: string;
};

export function ClipWaveform({
  path,
  width,
  height,
  mode = "fill",
  color = "rgba(220, 235, 255, 0.92)",
  inPoint = 0,
  outPoint,
  mediaDuration,
  amplitude = 1,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);

  useEffect(() => {
    let alive = true;
    if (!path || width < 8 || height < 6) {
      setPeaks(null);
      return;
    }
    const bars = Math.max(48, Math.min(400, Math.round(width * 1.4)));
    void getWaveformPeaks(path, bars).then((p) => {
      if (alive) setPeaks(p);
    });
    return () => {
      alive = false;
    };
  }, [path, width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || width < 4 || height < 4) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const out = outPoint ?? mediaDuration ?? 1;
    const mediaDur = mediaDuration ?? Math.max(out, 0.05);
    const slice = slicePeaks(peaks, inPoint, out, mediaDur);
    const n = slice.length;
    if (!n) return;

    const mid = height / 2;
    const gap = mode === "overlay" ? 0.5 : 0.8;
    const barW = Math.max(1, width / n - gap);

    const volScale = Math.max(0.05, Math.min(2.2, amplitude));
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const amp = Math.max(0.04, slice[i] * volScale);
      const maxH = height * (mode === "overlay" ? 0.9 : 0.92);
      const h = Math.min(maxH, amp * maxH);
      const x = (i / n) * width;
      const y = mid - h / 2;
      if (mode === "fill") {
        ctx.globalAlpha = 0.5 + Math.min(1, amp) * 0.5;
        ctx.fillRect(x, y, barW, Math.max(1, h));
        if (amp > 0.85) {
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = "rgba(255, 170, 110, 0.85)";
          ctx.fillRect(x, y, barW, Math.max(1, h * 0.18));
          ctx.fillStyle = color;
        }
      } else {
        ctx.globalAlpha = 0.3 + Math.min(1, amp) * 0.5;
        ctx.fillRect(x, y, Math.max(1, barW), Math.max(1, h));
      }
    }
    ctx.globalAlpha = 1;
  }, [peaks, width, height, mode, color, inPoint, outPoint, mediaDuration, amplitude]);

  if (!path || width < 8) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: "block",
        width,
        height,
        pointerEvents: "none",
      }}
    />
  );
}
