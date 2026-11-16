import { convertFileSrc } from "@tauri-apps/api/core";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import {
  activeFxClipAt,
  activeMaskClipAt,
  cssFilterForEffect,
  DEFAULT_TEXT,
  isStillClip,
  isTextClip,
  TextStyle,
  TimelineClip,
} from "../types/editor";

function fadeMultiplier(
  localT: number,
  duration: number,
  fadeIn: number,
  fadeOut: number,
) {
  let m = 1;
  const fi = Math.max(0, fadeIn || 0);
  const fo = Math.max(0, fadeOut || 0);
  if (fi > 0 && localT < fi) m = Math.min(m, localT / fi);
  if (fo > 0 && localT > duration - fo) {
    m = Math.min(m, Math.max(0, (duration - localT) / fo));
  }
  return Math.max(0, Math.min(1, m));
}

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

function textCss(text: TextStyle, frameH: number, projectH: number): CSSProperties {
  const scale = frameH > 0 ? frameH / Math.max(1, projectH) : 1;
  const fontPx = Math.max(8, text.fontSize * scale);
  const stroke = text.strokeWidth * scale;
  const shadowX = text.shadowOffsetX * scale;
  const shadowY = text.shadowOffsetY * scale;
  const shadowBlur = text.shadowBlur * scale;
  const bg =
    text.backgroundOpacity > 0.01
      ? hexToRgba(text.backgroundColor, text.backgroundOpacity)
      : "transparent";

  return {
    left: `${text.x * 100}%`,
    top: `${text.y * 100}%`,
    transform: `translate(-50%, -50%) rotate(${text.rotation}deg)`,
    fontFamily: `"${text.fontFamily}", "Segoe UI Emoji", "Apple Color Emoji", sans-serif`,
    fontSize: `${fontPx}px`,
    fontWeight: text.bold ? 700 : 400,
    fontStyle: text.italic ? "italic" : "normal",
    color: text.color,
    opacity: text.opacity,
    textAlign: text.align,
    letterSpacing: `${text.letterSpacing * scale}px`,
    lineHeight: text.lineHeight,
    background: bg,
    borderRadius: bg !== "transparent" ? 6 : 0,
    WebkitTextStroke:
      stroke > 0 ? `${stroke}px ${text.strokeColor}` : undefined,
    textShadow:
      text.shadowBlur > 0 || text.shadowOffsetX || text.shadowOffsetY
        ? `${shadowX}px ${shadowY}px ${shadowBlur}px ${text.shadowColor}`
        : "none",
    paintOrder: "stroke fill",
  };
}

function hexToRgba(color: string, alpha: number) {
  if (color.startsWith("rgba") || color.startsWith("rgb")) {
    return color;
  }
  const hex = color.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex.padEnd(6, "0").slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

type TextDrag =
  | {
      mode: "move";
      id: string;
      originX: number;
      originY: number;
      startTX: number;
      startTY: number;
    }
  | {
      mode: "rotate";
      id: string;
      centerX: number;
      centerY: number;
      startAngle: number;
      originRotation: number;
    };

export function PreviewPlayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const [textDrag, setTextDrag] = useState<TextDrag | null>(null);
  const {
    clips,
    playhead,
    setPlayhead,
    isPlaying,
    setPlaying,
    projectWidth,
    projectHeight,
    selectedClipId,
    selectClip,
    updateClip,
  } = useEditorStore();

  const tracks = useEditorStore((s) => s.tracks);

  const activeVideoClips = useMemo(
    () =>
      clips
        .filter((c) => {
          if (c.trackKind !== "video") return false;
          if (playhead < c.start || playhead >= c.start + c.duration) return false;
          const track = tracks.find((t) => t.index === c.trackIndex);
          return !track?.hidden;
        })
        .sort((a, b) => a.trackIndex - b.trackIndex),
    [clips, playhead, tracks],
  );

  const activeTextClips = useMemo(
    () =>
      clips
        .filter((c) => {
          if (!isTextClip(c)) return false;
          if (playhead < c.start || playhead >= c.start + c.duration) return false;
          const track = tracks.find((t) => t.index === c.trackIndex);
          return !track?.hidden;
        })
        .sort((a, b) => a.trackIndex - b.trackIndex),
    [clips, playhead, tracks],
  );

  const dur = contentEnd();

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setFrameSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    if (!textDrag) return;
    const onMove = (e: MouseEvent) => {
      const frame = frameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      if (textDrag.mode === "move") {
        const dx = (e.clientX - textDrag.originX) / Math.max(1, rect.width);
        const dy = (e.clientY - textDrag.originY) / Math.max(1, rect.height);
        updateClip(textDrag.id, {
          text: {
            ...(useEditorStore.getState().clips.find((c) => c.id === textDrag.id)
              ?.text || DEFAULT_TEXT()),
            x: Math.min(1, Math.max(0, textDrag.startTX + dx)),
            y: Math.min(1, Math.max(0, textDrag.startTY + dy)),
          },
        });
        return;
      }
      const angle = Math.atan2(
        e.clientY - textDrag.centerY,
        e.clientX - textDrag.centerX,
      );
      let deg =
        textDrag.originRotation +
        ((angle - textDrag.startAngle) * 180) / Math.PI;
      while (deg > 180) deg -= 360;
      while (deg < -180) deg += 360;
      updateClip(textDrag.id, {
        text: {
          ...(useEditorStore.getState().clips.find((c) => c.id === textDrag.id)
            ?.text || DEFAULT_TEXT()),
          rotation: Math.round(deg),
        },
      });
    };
    const onUp = () => setTextDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [textDrag, updateClip]);

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
            .filter((c) => {
              if (c.trackKind !== "video") return false;
              if (ph < c.start || ph >= c.start + c.duration) return false;
              const track = state.tracks.find((t) => t.index === c.trackIndex);
              return !track?.hidden;
            })
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
            active.find((c) => {
              const track = state.tracks.find((t) => t.index === c.trackIndex);
              if (track?.muted) return false;
              return c.hasAudio || c.trackIndex === 0;
            })?.id ?? null;

          for (const [id, video] of videoRefs.current) {
            if (!active.some((c) => c.id === id)) {
              if (!video.paused) video.pause();
              video.muted = true;
            }
          }

          for (const clip of active) {
            const track = state.tracks.find((t) => t.index === clip.trackIndex);
            const src = clip.previewPath || clip.mediaPath;
            const video = ensureVideo(clip.id, src);
            const clipLocalT = ph - clip.start;
            let audioGain = Math.max(0, Math.min(2, clip.effects.volume ?? 1));
            if (clip.effects.audioEnhance) audioGain *= 1.08;
            const afi = clip.effects.audioFadeIn || 0;
            const afo = clip.effects.audioFadeOut || 0;
            if (afi > 0 && clipLocalT < afi) audioGain *= clipLocalT / afi;
            if (afo > 0 && clipLocalT > clip.duration - afo) {
              audioGain *= Math.max(0, (clip.duration - clipLocalT) / afo);
            }
            video.muted = track?.muted || clip.id !== audibleId;
            try {
              video.volume = Math.min(1, audioGain);
            } catch {
              /* ignore */
            }

            // Freeze / still: always hold the first frame (stretchable on timeline)
            const local = isStillClip(clip)
              ? Math.min(0.04, Math.max(0, clip.inPoint))
              : Math.min(
                  clip.outPoint - 0.04,
                  Math.max(
                    clip.inPoint,
                    (ph - clip.start) * (clip.effects.speed || 1) + clip.inPoint,
                  ),
                );

            const drift = Math.abs((video.currentTime || 0) - local);
            if (isStillClip(clip)) {
              if (video.readyState >= 1 && drift > 0.02) {
                try {
                  video.currentTime = local;
                } catch {
                  /* ignore */
                }
              }
              if (!video.paused) video.pause();
            } else if (!state.isPlaying) {
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

            if (!isStillClip(clip)) {
              if (state.isPlaying) {
                if (video.paused) void video.play().catch(() => undefined);
              } else if (!video.paused) {
                video.pause();
              }
            }

            if (video.readyState < 2 || !video.videoWidth) {
              ctx.fillStyle = "#8a96a8";
              ctx.font = "14px Segoe UI";
              ctx.textAlign = "center";
              ctx.fillText("Loading frame…", W / 2, H / 2);
              continue;
            }

            const fx = clip.effects;
            const localT = ph - clip.start;
            const scale = lerp(fx.scaleKeyframes, localT, fx.scale);

            const hiddenFx = new Set(
              state.tracks.filter((t) => t.hidden && t.kind === "fx").map((t) => t.index),
            );
            const fxLayer = activeFxClipAt(state.clips, ph, hiddenFx);
            const maskLayer = activeMaskClipAt(state.clips, ph, hiddenFx);
            const lookId = fxLayer?.effects?.effect || fx.effect || "none";
            // Prefer tunable values from the F1 clip when one is active
            const lookFx = fxLayer?.effects
              ? {
                  ...fx,
                  ...fxLayer.effects,
                  // Keep clip transform from the video; color/look from FX layer
                  scale: fx.scale,
                  rotation: fx.rotation,
                  mirrorH: fx.mirrorH,
                  mirrorV: fx.mirrorV,
                  speed: fx.speed,
                  fadeIn: fx.fadeIn,
                  fadeOut: fx.fadeOut,
                  scaleKeyframes: fx.scaleKeyframes,
                  opacityKeyframes: fx.opacityKeyframes,
                }
              : fx;
            const maskFx =
              maskLayer?.effects?.maskEnabled || maskLayer?.effects?.effect === "mask"
                ? maskLayer.effects
                : fx.maskEnabled
                  ? fx
                  : null;

            const opacity =
              lerp(fx.opacityKeyframes, localT, fx.opacity) *
              fadeMultiplier(localT, clip.duration, fx.fadeIn || 0, fx.fadeOut || 0);

            const blend =
              fx.blendMode === "screen"
                ? "screen"
                : fx.blendMode === "multiply"
                  ? "multiply"
                  : fx.blendMode === "overlay"
                    ? "overlay"
                    : fx.blendMode === "lighten"
                      ? "lighten"
                      : fx.blendMode === "color-dodge"
                        ? "color-dodge"
                        : "source-over";

            const drawVideo = (
              targetW: number,
              targetH: number,
              x: number,
              y: number,
            ) => {
              ctx.save();
              ctx.globalAlpha = opacity;
              ctx.globalCompositeOperation = blend as GlobalCompositeOperation;
              ctx.translate(x + targetW / 2, y + targetH / 2);
              ctx.rotate((fx.rotation * Math.PI) / 180);
              ctx.scale(fx.mirrorH ? -scale : scale, fx.mirrorV ? -scale : scale);
              if (maskFx) {
                const mx = -targetW / 2 + (maskFx.cropX || 0) * targetW;
                const my = -targetH / 2 + (maskFx.cropY || 0) * targetH;
                const mw = Math.max(2, (maskFx.cropW || 1) * targetW);
                const mh = Math.max(2, (maskFx.cropH || 1) * targetH);
                ctx.beginPath();
                if ((maskFx.maskShape || "box") === "circle") {
                  ctx.ellipse(
                    mx + mw / 2,
                    my + mh / 2,
                    mw / 2,
                    mh / 2,
                    0,
                    0,
                    Math.PI * 2,
                  );
                } else {
                  const r = Math.min(24, (maskFx.maskFeather || 0) * 0.6);
                  if (typeof (ctx as CanvasRenderingContext2D).roundRect === "function") {
                    ctx.roundRect(mx, my, mw, mh, r);
                  } else {
                    ctx.rect(mx, my, mw, mh);
                  }
                }
                ctx.clip();
              }
              ctx.filter = cssFilterForEffect(lookId, lookFx);
              ctx.drawImage(video, -targetW / 2, -targetH / 2, targetW, targetH);
              ctx.restore();
            };

            const posX = fx.posX ?? 0;
            const posY = fx.posY ?? 0;

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
              drawVideo(
                dw,
                dh,
                (W - dw) / 2 + posX * W,
                (H - dh) / 2 + posY * H,
              );

              const vig = lookFx.vignetteAmount ?? 0;
              if (vig > 0.02) {
                const g = ctx.createRadialGradient(
                  W / 2,
                  H / 2,
                  Math.min(W, H) * (0.35 - vig * 0.12),
                  W / 2,
                  H / 2,
                  Math.max(W, H) * 0.72,
                );
                g.addColorStop(0, "rgba(0,0,0,0)");
                g.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, 0.35 + vig * 0.55).toFixed(3)})`);
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
              }
            } else {
              const pipW = W * 0.35 * scale;
              const pipH = (video.videoHeight / video.videoWidth) * pipW;
              drawVideo(
                pipW,
                pipH,
                W * (fx.pipX + posX),
                H * (fx.pipY + posY),
              );
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

  function beginMove(e: React.MouseEvent, clip: TimelineClip) {
    e.preventDefault();
    e.stopPropagation();
    setPlaying(false);
    selectClip(clip.id);
    const state = useEditorStore.getState();
    if (state.isClipLocked(clip.id)) {
      state.setStatus("Track is locked");
      return;
    }
    const text = clip.text || DEFAULT_TEXT();
    setTextDrag({
      mode: "move",
      id: clip.id,
      originX: e.clientX,
      originY: e.clientY,
      startTX: text.x,
      startTY: text.y,
    });
  }

  function beginRotate(e: React.MouseEvent, clip: TimelineClip) {
    e.preventDefault();
    e.stopPropagation();
    setPlaying(false);
    selectClip(clip.id);
    const state = useEditorStore.getState();
    if (state.isClipLocked(clip.id)) {
      state.setStatus("Track is locked");
      return;
    }
    const text = clip.text || DEFAULT_TEXT();
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const centerX = rect.left + text.x * rect.width;
    const centerY = rect.top + text.y * rect.height;
    setTextDrag({
      mode: "rotate",
      id: clip.id,
      centerX,
      centerY,
      startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX),
      originRotation: text.rotation,
    });
  }

  return (
    <section className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Preview
        </div>
        <div className="font-[var(--font-mono)] text-[11px] text-[var(--muted)]">
          {projectWidth}×{projectHeight} · {formatTime(playhead)}
          {activeVideoClips.length === 0 && activeTextClips.length === 0
            ? " · no clip"
            : ""}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#05070b] p-3">
        <div
          ref={frameRef}
          className="relative flex h-full max-h-full w-full max-w-full items-center justify-center overflow-hidden border border-[var(--line)]"
          style={{
            aspectRatio: `${projectWidth / projectHeight}`,
            borderRadius: "var(--radius)",
          }}
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
          <div className="preview-text-layer">
            {activeTextClips.map((clip) => {
              const text = clip.text || DEFAULT_TEXT();
              const selected = clip.id === selectedClipId;
              const locked = tracks.find((t) => t.index === clip.trackIndex)?.locked;
              return (
                <div
                  key={clip.id}
                  className={`preview-text-item${selected ? " selected" : ""}${locked ? " locked" : ""}`}
                  style={textCss(text, frameSize.h || projectHeight, projectHeight)}
                  onMouseDown={(e) => beginMove(e, clip)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    selectClip(clip.id);
                  }}
                  title={
                    locked
                      ? "Track locked — unlock T1 to edit"
                      : "Drag to move · use top handle to rotate"
                  }
                >
                  {selected && !locked && (
                    <div
                      className="preview-text-rotate"
                      onMouseDown={(e) => beginRotate(e, clip)}
                      title="Rotate"
                    />
                  )}
                  {text.content || "Text"}
                </div>
              );
            })}
          </div>
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
