import { invoke } from "@tauri-apps/api/core";
import { ClipEffects, TimelineClip } from "../types/editor";

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
    pipX: fx.pipX,
    pipY: fx.pipY,
    scaleKeyframes: fx.scaleKeyframes,
    opacityKeyframes: fx.opacityKeyframes,
  };
}

export function clipsToExportPayload(clips: TimelineClip[]) {
  return clips.map((c) => ({
    id: c.id,
    mediaPath: c.mediaPath,
    trackIndex: c.trackIndex,
    trackKind: c.trackKind,
    hasAudio: c.hasAudio,
    start: c.start,
    duration: c.duration,
    inPoint: c.inPoint,
    outPoint: c.outPoint,
    effects: toBackendEffects(c.effects),
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

export async function createPreviewProxy(path: string) {
  return invoke<string>("create_preview_proxy", { path });
}

export async function previewThumbPath(previewPath: string) {
  return invoke<string | null>("preview_thumb_path", { previewPath });
}

export interface PreviewProgressEvent {
  sourcePath: string;
  percent: number;
  etaSeconds: number;
  message: string;
}
