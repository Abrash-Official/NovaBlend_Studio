import { useEffect, useRef, useState } from "react";
import { getWaveformPeaks, slicePeaks } from "../lib/waveform";

type Props = {
  path: string;
  width: number;
  height: number;
  /** "fill" = CapCut-style audio bars; "overlay" = faint wave on video clip */
  mode?: "fill" | "overlay";
  color?: string;
  /** CapCut peak tip color (loud parts) */
  peakColor?: string;
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
  color = "rgba(96, 170, 255, 0.95)",
  peakColor = "rgba(255, 140, 70, 0.95)",
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
    // Dense CapCut-like bars (~2–3px each)
    const bars = Math.max(64, Math.min(520, Math.round(width / 2.2)));
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
    const volScale = Math.max(0.05, Math.min(2.2, amplitude));

    if (mode === "fill") {
      // CapCut: bars grow UP from the bottom like mountains (not mirrored)
      const gap = 0.55;
      const barW = Math.max(1.2, width / n - gap);
      const maxH = height * 0.92;
      const tipH = Math.max(1.5, height * 0.08);
      const floor = height; // baseline at bottom edge

      for (let i = 0; i < n; i++) {
        const amp = Math.max(0.04, Math.min(1.2, slice[i] * volScale));
        const h = Math.max(2, Math.min(maxH, amp * maxH));
        const x = (i / n) * width + gap / 2;
        const y = floor - h;

        ctx.globalAlpha = 0.75 + Math.min(1, amp) * 0.25;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, barW, h);

        // Orange tip on loud peaks (top of the mountain)
        if (amp > 0.58) {
          const tip = Math.min(tipH, h * 0.2);
          ctx.globalAlpha = 0.55 + Math.min(1, (amp - 0.58) / 0.42) * 0.45;
          ctx.fillStyle = peakColor;
          ctx.fillRect(x, y, barW, tip);
        }
      }
    } else {
      const gap = 0.5;
      const barW = Math.max(1, width / n - gap);
      const maxH = height * 0.9;
      ctx.fillStyle = color;
      for (let i = 0; i < n; i++) {
        const amp = Math.max(0.04, slice[i] * volScale);
        const h = Math.min(maxH, amp * maxH);
        const x = (i / n) * width;
        const y = mid - h / 2;
        ctx.globalAlpha = 0.3 + Math.min(1, amp) * 0.5;
        ctx.fillRect(x, y, Math.max(1, barW), Math.max(1, h));
      }
    }
    ctx.globalAlpha = 1;
  }, [
    peaks,
    width,
    height,
    mode,
    color,
    peakColor,
    inPoint,
    outPoint,
    mediaDuration,
    amplitude,
  ]);

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
