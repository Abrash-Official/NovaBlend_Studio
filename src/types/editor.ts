export type TrackKind = "video" | "audio";

export type AspectRatioId = "16:9" | "9:16" | "1:1" | "4:5" | "21:9";

export type MediaReadyState = "processing" | "ready" | "error";

export interface Keyframe {
  time: number;
  value: number;
}

export interface ClipEffects {
  brightness: number;
  contrast: number;
  saturation: number;
  scale: number;
  rotation: number;
  opacity: number;
  mirrorH: boolean;
  mirrorV: boolean;
  reverse: boolean;
  speed: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  maskEnabled: boolean;
  maskFeather: number;
  motionBlur: number;
  effect: string;
  pipX: number;
  pipY: number;
  scaleKeyframes: Keyframe[];
  opacityKeyframes: Keyframe[];
}

export interface MediaItem {
  id: string;
  name: string;
  path: string;
  /** Browser-playable path (H.264 proxy for HEVC, etc.) */
  previewPath: string;
  /** Optional poster image for Media Bin */
  thumbPath?: string;
  duration: number;
  width: number;
  height: number;
  hasVideo: boolean;
  hasAudio: boolean;
  codec: string;
  fps: number;
  readyState: MediaReadyState;
  statusMessage: string;
  progressPercent?: number;
  progressEtaSeconds?: number;
}

export interface TimelineClip {
  id: string;
  mediaId: string;
  /** Original media path used for export */
  mediaPath: string;
  /** Path used for HTML preview playback */
  previewPath: string;
  name: string;
  trackIndex: number;
  trackKind: TrackKind;
  hasAudio: boolean;
  start: number;
  duration: number;
  inPoint: number;
  outPoint: number;
  effects: ClipEffects;
}

export type ExportFps = 25 | 30 | 60;

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  index: number;
}

export interface ProjectSnapshot {
  version: 1;
  name: string;
  savedAt: string;
  filePath?: string;
  aspect: AspectRatioId;
  fps: number;
  backgroundBlur: boolean;
  projectWidth: number;
  projectHeight: number;
  playhead: number;
  zoom: number;
  media: MediaItem[];
  clips: TimelineClip[];
}

export const DEFAULT_EFFECTS = (): ClipEffects => ({
  brightness: 0,
  contrast: 1,
  saturation: 1,
  scale: 1,
  rotation: 0,
  opacity: 1,
  mirrorH: false,
  mirrorV: false,
  reverse: false,
  speed: 1,
  cropX: 0,
  cropY: 0,
  cropW: 1,
  cropH: 1,
  maskEnabled: false,
  maskFeather: 0,
  motionBlur: 0,
  effect: "none",
  pipX: 0.05,
  pipY: 0.05,
  scaleKeyframes: [],
  opacityKeyframes: [],
});

export const ASPECT_PRESETS: Record<
  AspectRatioId,
  { label: string; width: number; height: number }
> = {
  "16:9": { label: "16:9 Landscape", width: 1920, height: 1080 },
  "9:16": { label: "9:16 Vertical", width: 1080, height: 1920 },
  "1:1": { label: "1:1 Square", width: 1080, height: 1080 },
  "4:5": { label: "4:5 Portrait", width: 1080, height: 1350 },
  "21:9": { label: "21:9 Ultrawide", width: 2560, height: 1080 },
};

export const EFFECT_PRESETS = [
  { id: "none", label: "None" },
  { id: "grayscale", label: "Grayscale" },
  { id: "sepia", label: "Sepia" },
  { id: "vignette", label: "Vignette" },
  { id: "sharpen", label: "Sharpen" },
] as const;
