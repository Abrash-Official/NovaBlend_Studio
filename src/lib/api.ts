import { invoke } from "@tauri-apps/api/core";
import { ClipEffects, DEFAULT_TEXT, TimelineClip, TextStyle } from "../types/editor";

export interface MediaProbe {
  path: string;
  duration: number;
  width: number;
  height: number;
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
    motionBlur: fx.motionBlur,
    effect: fx.effect,
    fadeIn: fx.fadeIn || 0,
    fadeOut: fx.fadeOut || 0,
    pipX: fx.pipX,
    pipY: fx.pipY,
    scaleKeyframes: fx.scaleKeyframes,
    opacityKeyframes: fx.opacityKeyframes,
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
  return clips.map((c) => ({
    id: c.id,
    mediaPath: c.mediaPath || "",
    trackIndex: c.trackIndex,
    trackKind: c.trackKind,
    hasAudio: c.hasAudio,
    start: c.start,
    duration: c.duration,
    inPoint: c.inPoint,
    outPoint: c.outPoint,
    effects: toBackendEffects(c.effects),
    text: c.trackKind === "text" || c.text ? toBackendText(c.text) : null,
    isStill: !!c.isStill,
    stillPath: c.stillPath || null,
  }));
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

export async function previewThumbPath(previewPath: string) {
  return invoke<string | null>("preview_thumb_path", { previewPath });
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
