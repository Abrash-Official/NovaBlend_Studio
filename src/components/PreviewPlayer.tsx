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
import { syncMediaAudio } from "../lib/audioEngine";
import { IconPause, IconPlay, IconReset } from "./Icons";
import { CropOverlay, VideoBound } from "./CropOverlay";
import { VideoSelectionOverlay } from "./VideoSelectionOverlay";

type VideoDrag = {
  id: string;
  originX: number;
  originY: number;
  startPosX: number;
  startPosY: number;
};

type DrawnRect = {
  id: string;
  /** Canvas pixels */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Normalized 0–1 of composition */
  nx: number;
  ny: number;
  nw: number;
  nh: number;
};

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
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const [textDrag, setTextDrag] = useState<TextDrag | null>(null);
  const [videoDrag, setVideoDrag] = useState<VideoDrag | null>(null);
  const [boardZoom, setBoardZoom] = useState(1);
  const [boardPan, setBoardPan] = useState({ x: 0, y: 0 });
  const [boardDragging, setBoardDragging] = useState(false);
  const boardDragRef = useRef<{
    originX: number;
    originY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [selectedBound, setSelectedBound] = useState<VideoBound | null>(null);
  const drawnRectsRef = useRef<DrawnRect[]>([]);
  const lastBoundKeyRef = useRef("");
  const lastBoundSetAtRef = useRef(0);
  const paintDirtyRef = useRef(true);
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
    updateSelectedEffects,
    pushHistory,
    aspect,
    setAspect,
    cropEditing,
    boardPanMode,
  } = useEditorStore();

  const tracks = useEditorStore((s) => s.tracks);
  const aspectOrder = ["16:9", "9:16", "1:1", "4:5", "21:9"] as const;

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
    if (!videoDrag) return;
    const onMove = (e: MouseEvent) => {
      const frame = frameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      const dx = (e.clientX - videoDrag.originX) / Math.max(1, rect.width);
      const dy = (e.clientY - videoDrag.originY) / Math.max(1, rect.height);
      const posX = Math.min(1, Math.max(-1, videoDrag.startPosX + dx));
      const posY = Math.min(1, Math.max(-1, videoDrag.startPosY + dy));
      selectClip(videoDrag.id);
      updateSelectedEffects({ posX, posY });
    };
    const onUp = () => setVideoDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [videoDrag, selectClip, updateSelectedEffects]);

  /** Hand-tool pan, or momentary right-click hold (does not toggle boardPanMode). */
  function beginBoardPan(e: React.MouseEvent, force = false) {
    if (!force && !boardPanMode) return;
    e.preventDefault();
    e.stopPropagation();
    setBoardDragging(true);
    boardDragRef.current = {
      originX: e.clientX,
      originY: e.clientY,
      startX: boardPan.x,
      startY: boardPan.y,
    };
  }

  useEffect(() => {
    if (!boardDragging) return;
    const onMove = (e: MouseEvent) => {
      const d = boardDragRef.current;
      if (!d) return;
      setBoardPan({
        x: d.startX + (e.clientX - d.originX),
        y: d.startY + (e.clientY - d.originY),
      });
    };
    const onUp = () => {
      setBoardDragging(false);
      boardDragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [boardDragging]);

  function beginVideoDrag(e: React.MouseEvent) {
    // Right-click hold = temporary hand pan (toolbar Hand stays as-is)
    if (e.button === 2) {
      beginBoardPan(e, true);
      return;
    }
    if (boardPanMode) {
      beginBoardPan(e);
      return;
    }
    if (cropEditing) return;
    if ((e.target as HTMLElement).closest(".preview-text-item, .crop-overlay")) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    // Map click into canvas pixel space
    const cx =
      ((e.clientX - canvasRect.left) / Math.max(1, canvasRect.width)) *
      canvas.width;
    const cy =
      ((e.clientY - canvasRect.top) / Math.max(1, canvasRect.height)) *
      canvas.height;
    // Topmost first (drawn last = end of ascending visual stack = start of our drawn array is under)
    const hit = [...drawnRectsRef.current].reverse().find(
      (r) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h,
    );
    if (!hit) return;
    const state = useEditorStore.getState();
    const clip = state.clips.find((c) => c.id === hit.id);
    if (!clip) return;
    if (state.isClipLocked(clip.id)) {
      state.setStatus("Track is locked");
      return;
    }
    e.preventDefault();
    setPlaying(false);
    selectClip(clip.id);
    pushHistory();
    const localT = state.playhead - clip.start;
    const posX = lerp(
      clip.effects.posXKeyframes || [],
      localT,
      clip.effects.posX ?? 0,
    );
    const posY = lerp(
      clip.effects.posYKeyframes || [],
      localT,
      clip.effects.posY ?? 0,
    );
    setVideoDrag({
      id: clip.id,
      originX: e.clientX,
      originY: e.clientY,
      startPosX: posX,
      startPosY: posY,
    });
  }

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    let lastPaintAt = 0;
    paintDirtyRef.current = true;
    const unsub = useEditorStore.subscribe(() => {
      paintDirtyRef.current = true;
    });

    /** One decoder per clip. dataset.src must be the asset URL (same as audioEngine). */
    const ensureVideo = (clipId: string, src: string) => {
      const url = convertFileSrc(src);
      let video = videoRefs.current.get(clipId);
      if (!video || video.dataset.src !== url) {
        if (video) {
          try {
            video.pause();
            video.removeAttribute("src");
            video.load();
          } catch {
            /* ignore */
          }
        }
        video = document.createElement("video");
        video.dataset.src = url;
        video.playsInline = true;
        video.preload = "auto";
        video.muted = true;
        video.crossOrigin = "anonymous";
        const bump = () => {
          setPreviewError(null);
          paintDirtyRef.current = true;
        };
        video.addEventListener("loadeddata", bump);
        video.addEventListener("seeked", bump);
        video.addEventListener("canplay", bump);
        video.onerror = () => {
          setPreviewError(`Cannot decode preview: ${src.split(/[/\\]/).pop()}`);
        };
        // Setting src is enough — do not call load() (restarts decode / fights seeks)
        video.src = url;
        videoRefs.current.set(clipId, video);
      }
      return video;
    };

    const paint = (now: number) => {
      if (cancelled) return;
      const state = useEditorStore.getState();
      const playing = state.isPlaying;
      // CapCut-like: don't burn CPU at 60fps while paused / waiting for a frame
      const interval = playing ? 33 : 100;
      if (now - lastPaintAt < interval) {
        raf = requestAnimationFrame(paint);
        return;
      }
      if (
        !paintDirtyRef.current &&
        !playing &&
        now - lastPaintAt < 400
      ) {
        raf = requestAnimationFrame(paint);
        return;
      }
      lastPaintAt = now;
      paintDirtyRef.current = playing; // keep dirty while playing

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d", { alpha: false });
        if (ctx) {
          const W = canvas.width;
          const H = canvas.height;
          const ph = state.playhead;
          // Draw high trackIndex first (under); low index last (on top) — matches timeline top=front
          const active = state.clips
            .filter((c) => {
              if (c.trackKind !== "video") return false;
              if (ph < c.start || ph >= c.start + c.duration) return false;
              const track = state.tracks.find((t) => t.index === c.trackIndex);
              return !track?.hidden;
            })
            .sort((a, b) => b.trackIndex - a.trackIndex);
          const drawn: DrawnRect[] = [];
          const bottomVideoIndex = active.length
            ? Math.max(...active.map((c) => c.trackIndex))
            : -1;
          // Blur letterbox must paint once under every layer (lane stacks share trackIndex)
          let blurFillDrawn = false;

          const mediaTFor = (clip: TimelineClip) => {
            if (isStillClip(clip)) {
              return Math.min(0.04, Math.max(0, clip.inPoint));
            }
            const speed = Math.max(0.05, clip.effects.speed || 1);
            const t =
              clip.inPoint + Math.max(0, ph - clip.start) * speed;
            const maxT = Math.max(clip.inPoint, clip.outPoint - 0.001);
            return Math.min(maxT, Math.max(clip.inPoint, t));
          };

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
              if (!c.hasAudio) return false;
              return (c.effects.volume ?? 1) > 0.01;
            })?.id ?? null;

          // Dedicated A1 (and other) audio clips — Web Audio for gain > 1 + voice FX
          const activeAudio = state.clips.filter((c) => {
            if (c.trackKind !== "audio") return false;
            if (ph < c.start || ph >= c.start + c.duration) return false;
            const track = state.tracks.find((t) => t.index === c.trackIndex);
            return !track?.hidden && !track?.muted && c.hasAudio;
          });
          const ensureAudio = (clipId: string) => {
            let el = audioRefs.current.get(clipId);
            if (!el) {
              el = new Audio();
              el.preload = "auto";
              el.crossOrigin = "anonymous";
              audioRefs.current.set(clipId, el);
            }
            return el;
          };
          for (const [id, el] of audioRefs.current) {
            if (!activeAudio.some((c) => c.id === id)) {
              if (!el.paused) el.pause();
              el.muted = true;
            }
          }
          for (const aClip of activeAudio) {
            const src = aClip.previewPath || aClip.mediaPath;
            if (!src) continue;
            const el = ensureAudio(aClip.id);
            const localT = ph - aClip.start;
            let gain = Math.max(0, aClip.effects.volume ?? 1);
            const afi = aClip.effects.audioFadeIn || 0;
            const afo = aClip.effects.audioFadeOut || 0;
            if (afi > 0 && localT < afi) gain *= localT / afi;
            if (afo > 0 && localT > aClip.duration - afo) {
              gain *= Math.max(0, (aClip.duration - localT) / afo);
            }
            const mediaT = Math.min(
              aClip.outPoint - 0.02,
              Math.max(
                aClip.inPoint,
                localT * (aClip.effects.speed || 1) + aClip.inPoint,
              ),
            );
            void syncMediaAudio({
              id: `a_${aClip.id}`,
              el,
              srcPath: src,
              playing: state.isPlaying,
              mediaTime: mediaT,
              volumeLinear: gain,
              voiceEffect: aClip.effects.voiceEffect || "none",
              speed: aClip.effects.speed || 1,
              muted: gain < 0.001,
            });
          }

          const activeIds = new Set(active.map((c) => c.id));
          for (const clip of active) {
            const track = state.tracks.find((t) => t.index === clip.trackIndex);
            const src = clip.previewPath || clip.mediaPath;
            if (!src) continue;
            const video = ensureVideo(clip.id, src);
            video.muted = true;
            const clipLocalT = ph - clip.start;
            let audioGain = Math.max(0, clip.effects.volume ?? 1);
            if (!clip.hasAudio) audioGain = 0;
            const afi = clip.effects.audioFadeIn || 0;
            const afo = clip.effects.audioFadeOut || 0;
            if (afi > 0 && clipLocalT < afi) audioGain *= clipLocalT / afi;
            if (afo > 0 && clipLocalT > clip.duration - afo) {
              audioGain *= Math.max(0, (clip.duration - clipLocalT) / afo);
            }
            const videoAudible =
              !!clip.hasAudio &&
              !track?.muted &&
              clip.id === audibleId &&
              audioGain >= 0.01;
            if (videoAudible && src) {
              void syncMediaAudio({
                id: `v_${clip.id}`,
                el: video,
                srcPath: src,
                playing: state.isPlaying && !isStillClip(clip),
                mediaTime: 0,
                volumeLinear: audioGain,
                voiceEffect: "none",
                speed: 1,
                muted: false,
                controlTransport: false,
              });
            }

            const local = mediaTFor(clip);
            const drift = Math.abs((video.currentTime || 0) - local);
            // Never interrupt an in-flight seek — that left preview stuck on "Loading frame…"
            if (!video.seeking && video.readyState >= 1) {
              if (isStillClip(clip)) {
                if (drift > 0.03) {
                  try {
                    video.currentTime = local;
                  } catch {
                    /* ignore */
                  }
                }
              } else if (!state.isPlaying) {
                if (drift > 0.05) {
                  try {
                    video.currentTime = local;
                  } catch {
                    /* ignore */
                  }
                }
              } else if (drift > 0.45) {
                try {
                  video.currentTime = local;
                } catch {
                  /* ignore */
                }
              }
            }

            if (isStillClip(clip) || !state.isPlaying) {
              if (!video.paused) video.pause();
            } else if (video.paused) {
              void video.play().catch(() => undefined);
            }

            if (video.seeking || video.readyState < 2 || !video.videoWidth) {
              ctx.fillStyle = "#8a96a8";
              ctx.font = "14px Segoe UI";
              ctx.textAlign = "center";
              ctx.fillText("Loading frame…", W / 2, H / 2);
              paintDirtyRef.current = true;
              continue;
            }

            const fx = clip.effects;
            const localT = ph - clip.start;
            const scale = lerp(fx.scaleKeyframes || [], localT, fx.scale);
            const rot = lerp(
              fx.rotationKeyframes || [],
              localT,
              fx.rotation,
            );
            const posX = lerp(fx.posXKeyframes || [], localT, fx.posX ?? 0);
            const posY = lerp(fx.posYKeyframes || [], localT, fx.posY ?? 0);

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
              ctx.rotate((rot * Math.PI) / 180);
              ctx.scale(fx.mirrorH ? -scale : scale, fx.mirrorV ? -scale : scale);
              if (maskFx) {
                const mx = -targetW / 2 + (maskFx.cropX || 0) * targetW;
                const my = -targetH / 2 + (maskFx.cropY || 0) * targetH;
                const mw = Math.max(2, (maskFx.cropW || 1) * targetW);
                const mh = Math.max(2, (maskFx.cropH || 1) * targetH);
                const shape = maskFx.maskShape || "box";
                ctx.beginPath();
                if (shape === "circle") {
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
                  const r =
                    shape === "rounded"
                      ? Math.min(mw, mh) * 0.18
                      : shape === "square"
                        ? Math.min(12, (maskFx.maskFeather || 0) * 0.4)
                        : Math.min(24, (maskFx.maskFeather || 0) * 0.6);
                  if (
                    typeof (ctx as CanvasRenderingContext2D).roundRect ===
                    "function"
                  ) {
                    ctx.roundRect(mx, my, mw, mh, r);
                  } else {
                    ctx.rect(mx, my, mw, mh);
                  }
                }
                ctx.clip();
              }
              ctx.filter = cssFilterForEffect(lookId, lookFx);
              if (fx.removeBg || lookFx.removeBg) {
                const tw = Math.max(2, Math.round(targetW));
                const th = Math.max(2, Math.round(targetH));
                const off = document.createElement("canvas");
                off.width = tw;
                off.height = th;
                const octx = off.getContext("2d");
                if (octx) {
                  octx.drawImage(video, 0, 0, tw, th);
                  const img = octx.getImageData(0, 0, tw, th);
                  const d = img.data;
                  // Sample corners for key color (typical studio / green screen)
                  const samples = [
                    0,
                    (tw - 1) * 4,
                    (th - 1) * tw * 4,
                    ((th - 1) * tw + (tw - 1)) * 4,
                  ];
                  let sr = 0;
                  let sg = 0;
                  let sb = 0;
                  for (const i of samples) {
                    sr += d[i];
                    sg += d[i + 1];
                    sb += d[i + 2];
                  }
                  sr /= 4;
                  sg /= 4;
                  sb /= 4;
                  const thresh = 48;
                  for (let i = 0; i < d.length; i += 4) {
                    const dr = Math.abs(d[i] - sr);
                    const dg = Math.abs(d[i + 1] - sg);
                    const db = Math.abs(d[i + 2] - sb);
                    if (dr + dg + db < thresh * 3) {
                      d[i + 3] = 0;
                    }
                  }
                  octx.putImageData(img, 0, 0);
                  ctx.drawImage(off, -targetW / 2, -targetH / 2, targetW, targetH);
                } else {
                  ctx.drawImage(video, -targetW / 2, -targetH / 2, targetW, targetH);
                }
              } else {
                ctx.drawImage(video, -targetW / 2, -targetH / 2, targetW, targetH);
              }
              ctx.restore();
            };

            // CapCut Blur: one cover fill behind all layers (never between stacked clips)
            if (
              !blurFillDrawn &&
              clip.trackIndex === bottomVideoIndex &&
              state.backgroundBlur &&
              video.videoWidth > 0 &&
              video.videoHeight > 0
            ) {
              const cover = Math.max(
                W / video.videoWidth,
                H / video.videoHeight,
              );
              const bw = video.videoWidth * cover;
              const bh = video.videoHeight * cover;
              ctx.save();
              ctx.filter = "blur(12px) brightness(0.55)";
              ctx.drawImage(video, (W - bw) / 2, (H - bh) / 2, bw, bh);
              ctx.restore();
              blurFillDrawn = true;
            }
            const fit = Math.min(W / video.videoWidth, H / video.videoHeight);
            const dw = video.videoWidth * fit;
            const dh = video.videoHeight * fit;
            const dx = (W - dw) / 2 + posX * W;
            const dy = (H - dh) / 2 + posY * H;
            drawVideo(dw, dh, dx, dy);
            const bx = dx + dw / 2 - (dw * scale) / 2;
            const by = dy + dh / 2 - (dh * scale) / 2;
            const bw = dw * scale;
            const bh = dh * scale;
            drawn.push({
              id: clip.id,
              x: bx,
              y: by,
              w: bw,
              h: bh,
              nx: bx / W,
              ny: by / H,
              nw: bw / W,
              nh: bh / H,
            });

            if (clip.trackIndex === bottomVideoIndex) {
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
                g.addColorStop(
                  1,
                  `rgba(0,0,0,${Math.min(0.92, 0.35 + vig * 0.55).toFixed(3)})`,
                );
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
              }
            }
          }
          drawnRectsRef.current = drawn;
          const selId = state.selectedClipId;
          const sel = selId ? drawn.find((d) => d.id === selId) : null;
          const key = sel
            ? `${sel.id}:${sel.nx.toFixed(3)},${sel.ny.toFixed(3)},${sel.nw.toFixed(3)},${sel.nh.toFixed(3)}`
            : "";
          if (
            key !== lastBoundKeyRef.current &&
            now - lastBoundSetAtRef.current > 50
          ) {
            lastBoundKeyRef.current = key;
            lastBoundSetAtRef.current = now;
            setSelectedBound(
              sel
                ? { x: sel.nx, y: sel.ny, w: sel.nw, h: sel.nh }
                : null,
            );
          }

          // Pause decoders for clips not under the playhead (keep element cached)
          for (const [id, video] of videoRefs.current) {
            if (!activeIds.has(id) && !video.paused) {
              video.pause();
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
      unsub();
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

  function toggleFullscreen() {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void el.requestFullscreen().catch(() => {
      useEditorStore.getState().setStatus("Fullscreen not available");
    });
  }

  return (
    <section className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Preview
        </div>
        <div className="flex items-center gap-2">
          <div className="font-[var(--font-mono)] text-[11px] text-[var(--muted)]">
            {projectWidth}×{projectHeight} · {formatTime(playhead)}
            {activeVideoClips.length === 0 && activeTextClips.length === 0
              ? " · no clip"
              : ""}
          </div>
          <button
            type="button"
            className="btn btn-ghost h-7 px-2 text-[10px]"
            title="Cycle aspect ratio"
            onClick={() => {
              const i = aspectOrder.indexOf(
                aspect as (typeof aspectOrder)[number],
              );
              const next = aspectOrder[(i + 1) % aspectOrder.length];
              setAspect(next);
            }}
          >
            Ratio {aspect}
          </button>
          <button
            type="button"
            className="btn btn-ghost h-7 px-2 text-[10px]"
            title="Fullscreen"
            onClick={() => toggleFullscreen()}
          >
            Full
          </button>
        </div>
      </div>

      <div
        className={`preview-board-viewport relative flex min-h-0 flex-1 flex-col overflow-hidden${boardPanMode ? " pan-mode" : ""}`}
        onWheel={(e) => {
          e.preventDefault();
          const factor = e.deltaY > 0 ? 0.9 : 1.11;
          setBoardZoom((z) =>
            Math.min(3, Math.max(0.25, Number((z * factor).toFixed(3)))),
          );
        }}
        onContextMenu={(e) => {
          e.preventDefault();
        }}
        onMouseDown={(e) => {
          if (e.button === 2) {
            beginBoardPan(e, true);
            return;
          }
          if (boardPanMode) beginBoardPan(e);
        }}
      >
        <div className="preview-board-space">
          <div
            className="preview-board-zoom"
            style={{
              transform: `translate(${boardPan.x}px, ${boardPan.y}px) scale(${boardZoom})`,
            }}
          >
            <div
              ref={frameRef}
              className="preview-stage relative overflow-hidden border border-[var(--line)] bg-black shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
              style={{
                aspectRatio: `${projectWidth / projectHeight}`,
                height: "min(62vh, 100%)",
                width: "auto",
                maxWidth: "min(92vw, 720px)",
                borderRadius: "var(--radius)",
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <canvas
                ref={canvasRef}
                width={Math.min(projectWidth, 960)}
                height={Math.min(
                  projectHeight,
                  Math.round(
                    960 / Math.max(projectWidth / projectHeight, 0.01),
                  ),
                )}
                className="block h-full w-full bg-black"
                style={{
                  cursor:
                    boardPanMode || boardDragging
                      ? boardDragging
                        ? "grabbing"
                        : "grab"
                      : cropEditing
                        ? "crosshair"
                        : "grab",
                }}
                onMouseDown={beginVideoDrag}
                onContextMenu={(e) => e.preventDefault()}
              />
              <VideoSelectionOverlay
                bound={selectedBound}
                visible={
                  !!selectedClipId &&
                  !cropEditing &&
                  !boardPanMode &&
                  !boardDragging
                }
              />
              {!boardPanMode && !boardDragging && (
                <CropOverlay videoBound={selectedBound} />
              )}
              <div className="preview-text-layer">
                {activeTextClips.map((clip) => {
                  const text = clip.text || DEFAULT_TEXT();
                  const selected = clip.id === selectedClipId;
                  const locked = tracks.find(
                    (t) => t.index === clip.trackIndex,
                  )?.locked;
                  return (
                    <div
                      key={clip.id}
                      className={`preview-text-item${selected ? " selected" : ""}${locked ? " locked" : ""}`}
                      style={{
                        ...textCss(
                          text,
                          frameSize.h || projectHeight,
                          projectHeight,
                        ),
                        pointerEvents:
                          boardPanMode || boardDragging ? "none" : undefined,
                      }}
                      onMouseDown={(e) => {
                        if (e.button === 2) {
                          beginBoardPan(e, true);
                          return;
                        }
                        if (boardPanMode) return;
                        beginMove(e, clip);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      onDoubleClick={(e) => {
                        if (boardPanMode) return;
                        e.stopPropagation();
                        selectClip(clip.id);
                      }}
                      title={
                        locked
                          ? "Track locked — unlock T1 to edit"
                          : "Drag to move · use top handle to rotate"
                      }
                    >
                      {selected && !locked && !boardPanMode && !boardDragging && (
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
          className="transport-icon"
          title="Reset to start"
          aria-label="Reset"
          onClick={() => {
            setPlaying(false);
            setPlayhead(0);
          }}
        >
          <IconReset size={18} />
        </button>
        <button
          type="button"
          className="transport-icon transport-play"
          title={isPlaying ? "Pause" : "Play"}
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={() => {
            if (!isPlaying && playhead >= contentEnd() - 0.05) setPlayhead(0);
            setPlaying(!isPlaying);
          }}
        >
          {isPlaying ? <IconPause size={18} /> : <IconPlay size={18} />}
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
