import { invoke } from "@tauri-apps/api/core";
import {
  activeFxClipAt,
  activeMaskClipAt,
  ClipEffects,
  DEFAULT_TEXT,
  TimelineClip,
  TextStyle,
} from "../types/editor";

export interface MediaProbe {
  path: string;
  duration: number;
  width: number;
  height: number;
  codedWidth?: number;
  codedHeight?: number;
  rotation?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  codec: string;
  fps: number;
}

export interface FfmpegResult {
  success: boolean;
  message: string;
  outputPath?: string;
}

function toBackendEffects(fx: ClipEffects) {
  return {
    brightness: fx.brightness,
    contrast: fx.contrast,
    saturation: fx.saturation,
    sharpness: fx.sharpness ?? 0,
    temperature: fx.temperature ?? 0,
    tint: fx.tint ?? 0,
    vignetteAmount: fx.vignetteAmount ?? 0,
    softBlur: fx.softBlur ?? 0,
    posX: fx.posX ?? 0,
    posY: fx.posY ?? 0,
    volume: fx.volume ?? 1,
    audioFadeIn: fx.audioFadeIn ?? 0,
    audioFadeOut: fx.audioFadeOut ?? 0,
    audioEnhance: false,
    voiceEffect: fx.voiceEffect || "none",
    removeBg: !!fx.removeBg,
    blendMode: fx.blendMode || "normal",
    scale: fx.scale,
    rotation: fx.rotation,
    opacity: fx.opacity,
    mirrorH: fx.mirrorH,
    mirrorV: fx.mirrorV,
    reverse: fx.reverse,
    speed: fx.speed,
    cropX: fx.cropX,
    cropY: fx.cropY,
    cropW: fx.cropW,
    cropH: fx.cropH,
    maskEnabled: fx.maskEnabled,
    maskFeather: fx.maskFeather,
    maskShape: fx.maskShape || "box",
    motionBlur: fx.motionBlur,
    effect: fx.effect,
    fadeIn: fx.fadeIn || 0,
    fadeOut: fx.fadeOut || 0,
    pipX: fx.pipX,
    pipY: fx.pipY,
    scaleKeyframes: fx.scaleKeyframes || [],
    opacityKeyframes: fx.opacityKeyframes || [],
    posXKeyframes: fx.posXKeyframes || [],
    posYKeyframes: fx.posYKeyframes || [],
    rotationKeyframes: fx.rotationKeyframes || [],
  };
}

function toBackendText(text?: TextStyle) {
  const t = { ...DEFAULT_TEXT(), ...(text || {}) };
  return {
    content: t.content,
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    color: t.color,
    strokeColor: t.strokeColor,
    strokeWidth: t.strokeWidth,
    shadowColor: t.shadowColor,
    shadowBlur: t.shadowBlur,
    shadowOffsetX: t.shadowOffsetX,
    shadowOffsetY: t.shadowOffsetY,
    backgroundColor: t.backgroundColor,
    backgroundOpacity: t.backgroundOpacity,
    x: t.x,
    y: t.y,
    rotation: t.rotation,
    align: t.align,
    bold: t.bold,
    italic: t.italic,
    letterSpacing: t.letterSpacing,
    lineHeight: t.lineHeight,
    opacity: t.opacity,
  };
}

export function clipsToExportPayload(clips: TimelineClip[]) {
  // Bake overlapping F1 look/mask into video clips — backend skips FX track items.
  return clips
    .filter((c) => c.trackKind !== "fx")
    .map((c) => {
      let effects = c.effects;
      if (c.trackKind === "video") {
        const mid = c.start + Math.max(0.01, c.duration) * 0.5;
        const look = activeFxClipAt(clips, mid);
        const mask = activeMaskClipAt(clips, mid);
        if (look?.effects) {
          effects = {
            ...effects,
            ...look.effects,
            scale: c.effects.scale,
            rotation: c.effects.rotation,
            mirrorH: c.effects.mirrorH,
            mirrorV: c.effects.mirrorV,
            speed: c.effects.speed,
            volume: c.effects.volume,
            audioFadeIn: c.effects.audioFadeIn,
            audioFadeOut: c.effects.audioFadeOut,
            posX: c.effects.posX,
            posY: c.effects.posY,
            opacity: c.effects.opacity,
            blendMode: c.effects.blendMode,
            fadeIn: c.effects.fadeIn,
            fadeOut: c.effects.fadeOut,
            scaleKeyframes: c.effects.scaleKeyframes,
            opacityKeyframes: c.effects.opacityKeyframes,
          };
        }
        if (mask?.effects) {
          effects = {
            ...effects,
            maskEnabled: true,
            maskShape: mask.effects.maskShape || "box",
            maskFeather: mask.effects.maskFeather,
            cropX: mask.effects.cropX,
            cropY: mask.effects.cropY,
            cropW: mask.effects.cropW,
            cropH: mask.effects.cropH,
          };
        }
      }
      return {
        id: c.id,
        mediaPath: c.mediaPath || c.previewPath || "",
        trackIndex: c.trackIndex,
        trackKind: c.trackKind,
        hasAudio: c.hasAudio,
        start: c.start,
        duration: c.duration,
        inPoint: c.inPoint,
        outPoint: c.outPoint,
        effects: toBackendEffects(effects),
        text: c.trackKind === "text" || c.text ? toBackendText(c.text) : null,
        isStill: !!c.isStill,
        stillPath: c.stillPath || null,
      };
    });
}

export async function probeMedia(path: string) {
  return invoke<MediaProbe>("probe_media", { path });
}

export async function exportTimeline(args: {
  clips: TimelineClip[];
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  backgroundBlur: boolean;
}) {
  return invoke<FfmpegResult>("export_timeline", {
    request: {
      clips: clipsToExportPayload(args.clips),
      outputPath: args.outputPath,
      width: args.width,
      height: args.height,
      fps: args.fps,
      backgroundBlur: args.backgroundBlur,
      audioExtractOnly: false,
    },
  });
}

export async function extractAudio(args: {
  clips: TimelineClip[];
  outputPath: string;
  width: number;
  height: number;
  fps: number;
}) {
  return invoke<FfmpegResult>("extract_audio", {
    request: {
      clips: clipsToExportPayload(args.clips),
      outputPath: args.outputPath,
      width: args.width,
      height: args.height,
      fps: args.fps,
      backgroundBlur: false,
      audioExtractOnly: true,
    },
  });
}

/** Extract audio from one media file into proxies/ (no Save dialog). */
export async function extractMediaAudio(args: {
  path: string;
  inPoint: number;
  outPoint: number;
}) {
  return invoke<string>("extract_media_audio", {
    path: args.path,
    inPoint: args.inPoint,
    outPoint: args.outPoint,
  });
}

export async function createPreviewProxy(path: string) {
  return invoke<string>("create_preview_proxy", { path });
}

export async function startBackgroundProxy(path: string) {
  return invoke<string>("start_background_proxy", { path });
}

export async function resolveMediaUrl(path: string) {
  return invoke<string>("resolve_media_url", { path });
}

export async function getWaveformWindow(args: {
  path: string;
  startSec: number;
  durationSec: number;
  buckets: number;
}) {
  return invoke<number[]>("get_waveform_window", {
    path: args.path,
    startSec: args.startSec,
    durationSec: args.durationSec,
    buckets: args.buckets,
  });
}

export async function previewThumbPath(previewPath: string) {
  return invoke<string | null>("preview_thumb_path", { previewPath });
}

export async function extractFilmFrame(path: string, time: number) {
  return invoke<string>("extract_film_frame", { path, time });
}

export interface ProxyReadyEvent {
  sourcePath: string;
  previewPath: string;
  stage: string;
  message: string;
}

export interface FreezeResult {
  videoPath: string;
  stillPath: string;
}

export async function createFreezeClip(args: {
  path: string;
  time: number;
  duration?: number;
  fps?: number;
}) {
  return invoke<FreezeResult>("create_freeze_clip", {
    path: args.path,
    time: args.time,
    duration: args.duration ?? 2,
    fps: args.fps ?? 30,
  });
}

export interface PreviewProgressEvent {
  sourcePath: string;
  percent: number;
  etaSeconds: number;
  message: string;
}
