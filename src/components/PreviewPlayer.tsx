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
import { resolveMediaUrl } from "../lib/mediaUrl";
import { getLivePlayhead, setLivePlayhead } from "../lib/playheadClock";
import { IconPause, IconPlay, IconReset } from "./Icons";
import { CropOverlay, VideoBound } from "./CropOverlay";
import { VideoSelectionOverlay } from "./VideoSelectionOverlay";

const PREVIEW_FALLBACK_MAX = 540;
const SEEK_DRIFT_PLAY = 0.15;
const SEEK_DRIFT_PAUSE = 0.05;

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
  const videoLayerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
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
    let lastStore = 0;
    let t = useEditorStore.getState().playhead;
    setLivePlayhead(t);
    const tick = (now: number) => {
      const dt = Math.min(0.08, (now - last) / 1000);
      last = now;
      const state = useEditorStore.getState();
      const end = contentEnd();
      t = t + dt;
      if (t >= end) {
        state.setPlaying(false);
        state.setPlayhead(end - 0.01);
        return;
      }
      // Smooth needle every frame; store rarely (Timeline ignores playhead via useShallow)
      setLivePlayhead(t);
      if (now - lastStore > 200) {
        lastStore = now;
        useEditorStore.setState({ playhead: t });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      useEditorStore.getState().setPlayhead(t);
    };
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
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
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
    const urlCache = new Map<string, string>();
    const baseRotRef = new Map<string, number>();
    const srcPathRef = new Map<string, string>();

    const ensureVideo = async (clipId: string, srcPath: string) => {
      let url = urlCache.get(srcPath);
      if (!url) {
        url = await resolveMediaUrl(srcPath);
        urlCache.set(srcPath, url);
      }
      let video = videoRefs.current.get(clipId);
      if (!video || srcPathRef.get(clipId) !== srcPath) {
        if (video) {
          try {
            video.pause();
            video.removeAttribute("src");
            video.load();
            video.remove();
          } catch {
            /* ignore */
          }
        }
        video = document.createElement("video");
        video.playsInline = true;
        video.preload = "auto";
        video.muted = true;
        video.crossOrigin = "anonymous";
        video.dataset.clipId = clipId;
        video.style.cssText =
          "position:absolute;left:50%;top:50%;width:100%;height:100%;object-fit:contain;transform-origin:center center;will-change:transform,opacity,filter;pointer-events:none;display:none;";
        const bump = () => {
          setPreviewError(null);
          paintDirtyRef.current = true;
        };
        video.addEventListener("loadedmetadata", () => {
          bump();
          const st = useEditorStore.getState();
          const clip = st.clips.find((c) => c.id === clipId);
          const media = clip
            ? st.media.find((m) => m.id === clip.mediaId)
            : undefined;
          const displayW = media?.width || 0;
          const displayH = media?.height || 0;
          const probeRot = media?.rotation ?? 0;
          if (
            video &&
            video.videoWidth > 0 &&
            video.videoHeight > 0 &&
            displayW > 0 &&
            displayH > 0
          ) {
            const elemSign = Math.sign(video.videoWidth - video.videoHeight);
            const displaySign = Math.sign(displayW - displayH);
            if (
              elemSign !== 0 &&
              displaySign !== 0 &&
              elemSign !== displaySign &&
              Math.abs(probeRot) >= 80
            ) {
              baseRotRef.set(clipId, -probeRot);
            } else {
              baseRotRef.set(clipId, 0);
            }
          }
        });
        video.addEventListener("loadeddata", bump);
        video.addEventListener("seeked", bump);
        video.onerror = () => {
          setPreviewError(
            `Cannot decode preview: ${srcPath.split(/[/\\]/).pop()}`,
          );
        };
        video.src = url;
        srcPathRef.set(clipId, srcPath);
        videoRefs.current.set(clipId, video);
        videoLayerRef.current?.appendChild(video);
      } else if (
        videoLayerRef.current &&
        video.parentElement !== videoLayerRef.current
      ) {
        videoLayerRef.current.appendChild(video);
      }
      return video;
    };

    const sync = async () => {
      if (cancelled) return;
      const now = performance.now();
      const state = useEditorStore.getState();
      const playing = state.isPlaying;
      // Prefer live clock during playback so A/V stays smooth while store is throttled
      const ph = playing ? getLivePlayhead() : state.playhead;
      const frame = frameRef.current;
      const W = Math.max(1, frame?.clientWidth || 1);
      const H = Math.max(1, frame?.clientHeight || 1);

      const active = state.clips
        .filter((c) => {
          if (c.trackKind !== "video") return false;
          if (ph < c.start || ph >= c.start + c.duration) return false;
          const track = state.tracks.find((t) => t.index === c.trackIndex);
          return !track?.hidden;
        })
        .sort((a, b) => b.trackIndex - a.trackIndex);

      const audibleId =
        active.find((c) => {
          const track = state.tracks.find((t) => t.index === c.trackIndex);
          if (track?.muted) return false;
          if (!c.hasAudio) return false;
          return (c.effects.volume ?? 1) > 0.01;
        })?.id ?? null;

      const activeIds = new Set(active.map((c) => c.id));
      const blurKeep = new Set<string>();
      const drawn: DrawnRect[] = [];
      const bottomVideoIndex = active.length
        ? Math.max(...active.map((c) => c.trackIndex))
        : -1;

      for (const [id, video] of videoRefs.current) {
        const isBlur = id.endsWith("__blur");
        const mainId = isBlur ? id.slice(0, -6) : id;
        if (!activeIds.has(mainId)) {
          if (!video.paused) video.pause();
          video.style.display = "none";
          video.muted = true;
        }
      }

      // Clear fallback canvas each frame
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }

      for (const clip of active) {
        const track = state.tracks.find((t) => t.index === clip.trackIndex);
        const mediaItem = state.media.find((m) => m.id === clip.mediaId);
        const original = clip.mediaPath || mediaItem?.path || "";
        let src = clip.previewPath || mediaItem?.previewPath || original;
        if (!src) continue;

        const speed = Math.max(0.05, clip.effects.speed || 1);
        const mediaT = isStillClip(clip)
          ? Math.min(0.04, Math.max(0, clip.inPoint))
          : Math.min(
              clip.outPoint - 0.001,
              Math.max(
                clip.inPoint,
                clip.inPoint + Math.max(0, ph - clip.start) * speed,
              ),
            );
        if (
          original &&
          src !== original &&
          /_head\.mp4$/i.test(src) &&
          mediaT > 58
        ) {
          src = original;
        }

        const video = await ensureVideo(clip.id, src);
        if (cancelled) return;

        const fx = clip.effects;
        const localT = ph - clip.start;
        const scale = lerp(fx.scaleKeyframes || [], localT, fx.scale);
        const userRot = lerp(
          fx.rotationKeyframes || [],
          localT,
          fx.rotation,
        );
        const posX = lerp(fx.posXKeyframes || [], localT, fx.posX ?? 0);
        const posY = lerp(fx.posYKeyframes || [], localT, fx.posY ?? 0);
        const opacity =
          lerp(fx.opacityKeyframes, localT, fx.opacity) *
          fadeMultiplier(
            localT,
            clip.duration,
            fx.fadeIn || 0,
            fx.fadeOut || 0,
          );

        const hiddenFx = new Set(
          state.tracks
            .filter((t) => t.hidden && t.kind === "fx")
            .map((t) => t.index),
        );
        const fxLayer = activeFxClipAt(state.clips, ph, hiddenFx);
        const maskLayer = activeMaskClipAt(state.clips, ph, hiddenFx);
        const lookId = fxLayer?.effects?.effect || fx.effect || "none";
        const lookFx = fxLayer?.effects
          ? {
              ...fx,
              ...fxLayer.effects,
              scale: fx.scale,
              rotation: fx.rotation,
            }
          : fx;
        const maskFx =
          maskLayer?.effects?.maskEnabled ||
          maskLayer?.effects?.effect === "mask"
            ? maskLayer.effects
            : fx.maskEnabled
              ? fx
              : null;

        const needsCanvas = !!(fx.removeBg || lookFx.removeBg);
        const baseRot = baseRotRef.get(clip.id) || 0;
        const totalRot = baseRot + userRot;

        let audioGain = Math.max(0, Math.min(1, fx.volume ?? 1));
        if (!clip.hasAudio) audioGain = 0;
        const afi = fx.audioFadeIn || 0;
        const afo = fx.audioFadeOut || 0;
        if (afi > 0 && localT < afi) audioGain *= localT / afi;
        if (afo > 0 && localT > clip.duration - afo) {
          audioGain *= Math.max(0, (clip.duration - localT) / afo);
        }
        const videoAudible =
          !!clip.hasAudio &&
          !track?.muted &&
          clip.id === audibleId &&
          audioGain >= 0.01;
        video.muted = !videoAudible;
        video.volume = videoAudible ? audioGain : 0;

        const local =
          video.duration > 0 && Number.isFinite(video.duration)
            ? Math.min(mediaT, Math.max(0, video.duration - 0.02))
            : mediaT;
        const drift = Math.abs((video.currentTime || 0) - local);
        const driftLimit = playing ? SEEK_DRIFT_PLAY : SEEK_DRIFT_PAUSE;
        if (!video.seeking && video.readyState >= 1 && drift > driftLimit) {
          try {
            video.currentTime = local;
          } catch {
            /* ignore */
          }
        }
        if (isStillClip(clip) || !playing) {
          if (!video.paused) video.pause();
        } else if (video.paused) {
          void video.play().catch(() => undefined);
        }

        const vw = video.videoWidth || mediaItem?.width || 1;
        const vh = video.videoHeight || mediaItem?.height || 1;
        const fit = Math.min(W / vw, H / vh);
        const dw = vw * fit;
        const dh = vh * fit;
        const dx = (W - dw) / 2 + posX * W;
        const dy = (H - dh) / 2 + posY * H;
        const sx = (fx.mirrorH ? -1 : 1) * scale;
        const sy = (fx.mirrorV ? -1 : 1) * scale;

        // CapCut Blur: cover-fill behind letterboxed video (GPU CSS, no canvas)
        const wantBlur =
          !!state.backgroundBlur &&
          clip.trackIndex === bottomVideoIndex &&
          !needsCanvas &&
          (dw < W - 2 || dh < H - 2);
        if (wantBlur) {
          const blur = await ensureVideo(`${clip.id}__blur`, src);
          blurKeep.add(`${clip.id}__blur`);
          blur.muted = true;
          blur.volume = 0;
          if (
            !blur.seeking &&
            blur.readyState >= 1 &&
            Math.abs((blur.currentTime || 0) - local) > driftLimit
          ) {
            try {
              blur.currentTime = local;
            } catch {
              /* ignore */
            }
          }
          if (isStillClip(clip) || !playing) {
            if (!blur.paused) blur.pause();
          } else if (blur.paused) {
            void blur.play().catch(() => undefined);
          }
          blur.style.display = "block";
          blur.style.zIndex = "1";
          blur.style.left = "0";
          blur.style.top = "0";
          blur.style.width = "100%";
          blur.style.height = "100%";
          blur.style.objectFit = "cover";
          blur.style.opacity = "1";
          blur.style.filter = "blur(16px) brightness(0.55)";
          blur.style.transform = "none";
          blur.style.clipPath = "none";
          blur.style.mixBlendMode = "normal";
        }

        if (!needsCanvas) {
          video.style.display = "block";
          video.style.zIndex = String(1000 - clip.trackIndex);
          video.style.left = `${(dx / W) * 100}%`;
          video.style.top = `${(dy / H) * 100}%`;
          video.style.width = `${(dw / W) * 100}%`;
          video.style.height = `${(dh / H) * 100}%`;
          video.style.objectFit = "fill";
          video.style.opacity = String(opacity);
          video.style.filter = cssFilterForEffect(lookId, lookFx);
          video.style.mixBlendMode =
            fx.blendMode && fx.blendMode !== "normal"
              ? fx.blendMode
              : "normal";
          video.style.transform = `rotate(${totalRot}deg) scale(${sx}, ${sy})`;
          if (maskFx) {
            const mx = (maskFx.cropX || 0) * 100;
            const my = (maskFx.cropY || 0) * 100;
            const mw = (maskFx.cropW || 1) * 100;
            const mh = (maskFx.cropH || 1) * 100;
            const shape = maskFx.maskShape || "box";
            if (shape === "circle") {
              video.style.clipPath = `ellipse(${mw / 2}% ${mh / 2}% at ${mx + mw / 2}% ${my + mh / 2}%)`;
            } else {
              video.style.clipPath = `inset(${my}% ${Math.max(0, 100 - mx - mw)}% ${Math.max(0, 100 - my - mh)}% ${mx}%${
                shape === "rounded" ? " round 12px" : ""
              })`;
            }
          } else {
            video.style.clipPath = "none";
          }
        } else if (canvas && video.readyState >= 2) {
          video.style.display = "none";
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.translate(
              canvas.width / 2 + posX * canvas.width,
              canvas.height / 2 + posY * canvas.height,
            );
            ctx.rotate((totalRot * Math.PI) / 180);
            ctx.scale(sx, sy);
            const tw = Math.min(PREVIEW_FALLBACK_MAX, canvas.width) * (dw / W);
            const th = tw * (dh / Math.max(1, dw));
            ctx.drawImage(video, -tw / 2, -th / 2, tw, th);
            ctx.restore();
          }
        }

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
      }

      // Hide blur layers that aren't needed this frame
      for (const [id, video] of videoRefs.current) {
        if (id.endsWith("__blur") && !blurKeep.has(id)) {
          video.style.display = "none";
          if (!video.paused) video.pause();
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
          sel ? { x: sel.nx, y: sel.ny, w: sel.nw, h: sel.nh } : null,
        );
      }

      raf = requestAnimationFrame(() => {
        void sync();
      });
    };

    const unsub = useEditorStore.subscribe(() => {
      paintDirtyRef.current = true;
    });
    raf = requestAnimationFrame(() => {
      void sync();
    });
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
              <div
                ref={videoLayerRef}
                className="absolute inset-0 overflow-hidden bg-black"
                style={{ zIndex: 0, pointerEvents: "none" }}
              />
              <canvas
                ref={canvasRef}
                width={Math.min(projectWidth, PREVIEW_FALLBACK_MAX)}
                height={Math.min(
                  projectHeight,
                  Math.round(
                    PREVIEW_FALLBACK_MAX /
                      Math.max(projectWidth / projectHeight, 0.01),
                  ),
                )}
                className="relative block h-full w-full"
                style={{
                  zIndex: 1,
                  background: "transparent",
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
