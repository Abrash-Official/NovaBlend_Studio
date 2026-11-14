import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../store/editorStore";

function lerp(
  keys: { time: number; value: number }[],
  t: number,
  fallback: number,
) {
  if (!keys.length) return fallback;
  const sorted = [...keys].sort((a, b) => a.time - b.time);
  if (t <= sorted[0].time) return sorted[0].value;
  if (t >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.time && t <= b.time) {
      const u = (t - a.time) / Math.max(1e-6, b.time - a.time);
      return a.value + (b.value - a.value) * u;
    }
  }
  return fallback;
}

function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function contentEnd() {
  const clips = useEditorStore.getState().clips;
  if (!clips.length) return 10;
  return Math.max(
    0.1,
    clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0),
  );
}

export function PreviewPlayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [previewError, setPreviewError] = useState<string | null>(null);
  const {
    clips,
    playhead,
    setPlayhead,
    isPlaying,
    setPlaying,
    projectWidth,
    projectHeight,
  } = useEditorStore();

  const activeVideoClips = useMemo(
    () =>
      clips
        .filter(
          (c) =>
            c.trackKind === "video" &&
            playhead >= c.start &&
            playhead < c.start + c.duration,
        )
        .sort((a, b) => a.trackIndex - b.trackIndex),
    [clips, playhead],
  );

  const dur = contentEnd();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      const s = useEditorStore.getState();
      s.setPlaying(!s.isPlaying);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Drive playhead from wall clock, stop at last clip end (no padded black tail)
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const state = useEditorStore.getState();
      const end = contentEnd();
      const next = state.playhead + dt;
      if (next >= end) {
        state.setPlaying(false);
        state.setPlayhead(end - 0.01);
        return;
      }
      state.setPlayhead(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    const ensureVideo = (clipId: string, src: string) => {
      let video = videoRefs.current.get(clipId);
      if (!video || video.dataset.src !== src) {
        video = document.createElement("video");
        video.dataset.src = src;
        video.playsInline = true;
        video.preload = "auto";
        video.crossOrigin = "anonymous";
        const url = convertFileSrc(src);
        video.src = url;
        video.onerror = () => {
          setPreviewError(`Cannot decode preview: ${src.split(/[/\\]/).pop()}`);
        };
        video.onloadeddata = () => {
          setPreviewError(null);
        };
        videoRefs.current.set(clipId, video);
        void video.load();
      }
      return video;
    };

    const paint = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const state = useEditorStore.getState();
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const W = canvas.width;
          const H = canvas.height;
          const ph = state.playhead;
          const active = state.clips
            .filter(
              (c) =>
                c.trackKind === "video" &&
                ph >= c.start &&
                ph < c.start + c.duration,
            )
            .sort((a, b) => a.trackIndex - b.trackIndex);

          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, W, H);

          if (active.length === 0) {
            ctx.fillStyle = "#8a96a8";
            ctx.font = "16px Segoe UI";
            ctx.textAlign = "center";
            ctx.fillText("No clip at playhead — scrub back onto a clip", W / 2, H / 2);
          }

          const audibleId =
            active.find((c) => c.trackIndex === 0)?.id ?? active[0]?.id ?? null;

          for (const [id, video] of videoRefs.current) {
            if (!active.some((c) => c.id === id)) {
              if (!video.paused) video.pause();
              video.muted = true;
            }
          }

          for (const clip of active) {
            const src = clip.previewPath || clip.mediaPath;
            const video = ensureVideo(clip.id, src);
            video.muted = clip.id !== audibleId;

            const local = Math.min(
              clip.outPoint - 0.04,
              Math.max(
                clip.inPoint,
                (ph - clip.start) * (clip.effects.speed || 1) + clip.inPoint,
              ),
            );

            // While playing, avoid constant seeks (they cause black frames).
            // Only correct drift. While paused, snap to the scrubbed frame.
            const drift = Math.abs((video.currentTime || 0) - local);
            if (!state.isPlaying) {
              if (drift > 0.04 && video.readyState >= 1) {
                try {
                  video.currentTime = local;
                } catch {
                  /* ignore */
                }
              }
            } else if (drift > 0.35 && video.readyState >= 1) {
              try {
                video.currentTime = local;
              } catch {
                /* ignore */
              }
            }

            if (state.isPlaying) {
              if (video.paused) void video.play().catch(() => undefined);
            } else if (!video.paused) {
              video.pause();
            }

            if (video.readyState < 2 || !video.videoWidth) {
              ctx.fillStyle = "#8a96a8";
              ctx.font = "14px Segoe UI";
              ctx.textAlign = "center";
              ctx.fillText("Loading frame…", W / 2, H / 2);
              continue;
            }

            const fx = clip.effects;
            const scale = lerp(fx.scaleKeyframes, ph - clip.start, fx.scale);
            const opacity = lerp(fx.opacityKeyframes, ph - clip.start, fx.opacity);

            const drawVideo = (
              targetW: number,
              targetH: number,
              x: number,
              y: number,
            ) => {
              ctx.save();
              ctx.globalAlpha = opacity;
              ctx.translate(x + targetW / 2, y + targetH / 2);
              ctx.rotate((fx.rotation * Math.PI) / 180);
              ctx.scale(fx.mirrorH ? -scale : scale, fx.mirrorV ? -scale : scale);
              if (fx.effect === "grayscale") ctx.filter = "grayscale(1)";
              else if (fx.effect === "sepia") ctx.filter = "sepia(1)";
              else {
                ctx.filter = `brightness(${1 + fx.brightness}) contrast(${fx.contrast}) saturate(${fx.saturation})`;
              }
              ctx.drawImage(video, -targetW / 2, -targetH / 2, targetW, targetH);
              ctx.restore();
            };

            if (clip.trackIndex === 0) {
              if (state.backgroundBlur) {
                const cover = Math.max(W / video.videoWidth, H / video.videoHeight);
                const bw = video.videoWidth * cover;
                const bh = video.videoHeight * cover;
                ctx.save();
                ctx.filter = "blur(18px) brightness(0.55)";
                ctx.drawImage(video, (W - bw) / 2, (H - bh) / 2, bw, bh);
                ctx.restore();
              }
              const fit = Math.min(W / video.videoWidth, H / video.videoHeight);
              const dw = video.videoWidth * fit;
              const dh = video.videoHeight * fit;
              drawVideo(dw, dh, (W - dw) / 2, (H - dh) / 2);
            } else {
              const pipW = W * 0.35 * scale;
              const pipH = (video.videoHeight / video.videoWidth) * pipW;
              drawVideo(pipW, pipH, W * fx.pipX, H * fx.pipY);
            }
          }
        }
      }
      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="panel flex h-full min-h-0 flex-col overflow-hidden rounded-md">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Preview
        </div>
        <div className="font-[var(--font-mono)] text-[11px] text-[var(--muted)]">
          {projectWidth}×{projectHeight} · {formatTime(playhead)}
          {activeVideoClips.length === 0 ? " · no clip" : ""}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#05070b] p-3">
        <div
          className="relative flex h-full max-h-full w-full max-w-full items-center justify-center overflow-hidden rounded-lg border border-[var(--line)]"
          style={{ aspectRatio: `${projectWidth / projectHeight}` }}
        >
          <canvas
            ref={canvasRef}
            width={Math.min(projectWidth, 1280)}
            height={Math.min(
              projectHeight,
              Math.round(1280 / Math.max(projectWidth / projectHeight, 0.01)),
            )}
            className="max-h-full max-w-full bg-black object-contain"
          />
        </div>
        {previewError && (
          <div className="absolute bottom-4 left-1/2 max-w-[90%] -translate-x-1/2 rounded bg-black/80 px-3 py-1 text-center text-[11px] text-[var(--danger)]">
            {previewError}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-[var(--line)] bg-[var(--bg-2)] px-3 py-2">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setPlaying(false);
            setPlayhead(0);
          }}
        >
          Reset
        </button>
        <button
          type="button"
          className="btn btn-accent min-w-24"
          onClick={() => {
            if (!isPlaying && playhead >= contentEnd() - 0.05) setPlayhead(0);
            setPlaying(!isPlaying);
          }}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <span className="w-16 font-[var(--font-mono)] text-[11px] text-[var(--muted)]">
          {formatTime(playhead)}
        </span>
        <input
          className="slider flex-1"
          type="range"
          min={0}
          max={dur}
          step={0.01}
          value={Math.min(playhead, dur)}
          onChange={(e) => {
            setPlaying(false);
            setPlayhead(Number(e.target.value));
          }}
        />
        <span className="w-16 text-right font-[var(--font-mono)] text-[11px] text-[var(--muted)]">
          {formatTime(dur)}
        </span>
      </div>
    </section>
  );
}
