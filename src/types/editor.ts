export type TrackKind = "video" | "audio" | "text" | "fx";

export type AspectRatioId = "16:9" | "9:16" | "1:1" | "4:5" | "21:9";

export type MediaReadyState = "processing" | "ready" | "error";

export type TextAlign = "left" | "center" | "right";

export interface Keyframe {
  time: number;
  value: number;
}

/** On-screen title / caption style (normalized position 0–1). */
export interface TextStyle {
  content: string;
  fontFamily: string;
  /** Font size in pixels at project resolution */
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  backgroundColor: string;
  backgroundOpacity: number;
  /** Center X as fraction of frame width */
  x: number;
  /** Center Y as fraction of frame height */
  y: number;
  rotation: number;
  align: TextAlign;
  bold: boolean;
  italic: boolean;
  letterSpacing: number;
  lineHeight: number;
  opacity: number;
}

export interface ClipEffects {
  brightness: number;
  contrast: number;
  saturation: number;
  /** Sharpen amount 0–2 (filter look) */
  sharpness: number;
  /** Warm ↔ cool, -1…1 */
  temperature: number;
  /** Magenta ↔ green tint, -1…1 */
  tint: number;
  /** Edge darkening 0–1 */
  vignetteAmount: number;
  /** Soft blur for color grade (px-ish 0–20) */
  softBlur: number;
  /** Position offset from center, -1…1 */
  posX: number;
  posY: number;
  /** Audio gain 0…2 (1 = unity) */
  volume: number;
  audioFadeIn: number;
  audioFadeOut: number;
  audioEnhance: boolean;
  /** Open-source style voice FX id (none|chipmunk|deep|robot|cave|radio) */
  voiceEffect: string;
  /** Simple edge chroma remove-bg for preview/export */
  removeBg: boolean;
  blendMode: "normal" | "screen" | "multiply" | "overlay" | "lighten" | "color-dodge";
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
  /** Mask / crop geometry */
  maskShape: "box" | "circle" | "rounded" | "square";
  motionBlur: number;
  effect: string;
  /** Seconds of fade-in at clip start */
  fadeIn: number;
  /** Seconds of fade-out at clip end */
  fadeOut: number;
  pipX: number;
  pipY: number;
  scaleKeyframes: Keyframe[];
  opacityKeyframes: Keyframe[];
  posXKeyframes: Keyframe[];
  posYKeyframes: Keyframe[];
  rotationKeyframes: Keyframe[];
}

export type KeyframeProp =
  | "scale"
  | "opacity"
  | "posX"
  | "posY"
  | "rotation";

export function keyframeListKey(
  prop: KeyframeProp,
): keyof Pick<
  ClipEffects,
  | "scaleKeyframes"
  | "opacityKeyframes"
  | "posXKeyframes"
  | "posYKeyframes"
  | "rotationKeyframes"
> {
  switch (prop) {
    case "scale":
      return "scaleKeyframes";
    case "opacity":
      return "opacityKeyframes";
    case "posX":
      return "posXKeyframes";
    case "posY":
      return "posYKeyframes";
    case "rotation":
      return "rotationKeyframes";
  }
}

export function keyframesFor(
  fx: ClipEffects,
  prop: KeyframeProp,
): Keyframe[] {
  return fx[keyframeListKey(prop)] || [];
}

export type ProxyStatus = "none" | "native" | "building" | "head" | "full";

export interface MediaItem {
  id: string;
  name: string;
  path: string;
  /** Browser-playable path (H.264 proxy for HEVC, etc.) */
  previewPath: string;
  /** Optional poster image for Media Bin */
  thumbPath?: string;
  /** Still image used for freeze / extendable holds */
  stillPath?: string;
  duration: number;
  width: number;
  height: number;
  /** Coded (pre-rotation) dimensions when known */
  codedWidth?: number;
  codedHeight?: number;
  /** Display-matrix rotation degrees from probe */
  rotation?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  codec: string;
  fps: number;
  readyState: MediaReadyState;
  statusMessage: string;
  progressPercent?: number;
  progressEtaSeconds?: number;
  /** native = WebView2 HEVC OK; head/full = edit proxy stages */
  proxyStatus?: ProxyStatus;
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
  /** Present when trackKind === "text" */
  text?: TextStyle;
  /** Freeze / image hold — duration can be dragged freely */
  isStill?: boolean;
  /** Path to still frame (jpg) when isStill */
  stillPath?: string;
}

export function isStillClip(clip: TimelineClip): boolean {
  return !!clip.isStill || !!clip.stillPath;
}

export function isFxClip(clip: TimelineClip): boolean {
  return clip.trackKind === "fx";
}

/** Topmost FX clip active at time t (hidden tracks skipped). */
export function activeFxClipAt(
  clips: TimelineClip[],
  t: number,
  hiddenTrackIndexes?: Set<number>,
  opts?: { includeMask?: boolean },
): TimelineClip | null {
  const includeMask = opts?.includeMask ?? false;
  const active = clips
    .filter(
      (c) =>
        c.trackKind === "fx" &&
        t >= c.start &&
        t < c.start + c.duration &&
        (!hiddenTrackIndexes || !hiddenTrackIndexes.has(c.trackIndex)) &&
        (c.effects?.effect || "none") !== "none" &&
        (includeMask || (c.effects?.effect || "") !== "mask"),
    )
    .sort((a, b) => a.trackIndex - b.trackIndex);
  return active[active.length - 1] || null;
}

/** Active mask FX clip at time t (F1 "Mask · …" blocks). */
export function activeMaskClipAt(
  clips: TimelineClip[],
  t: number,
  hiddenTrackIndexes?: Set<number>,
): TimelineClip | null {
  const active = clips
    .filter(
      (c) =>
        c.trackKind === "fx" &&
        t >= c.start &&
        t < c.start + c.duration &&
        (!hiddenTrackIndexes || !hiddenTrackIndexes.has(c.trackIndex)) &&
        ((c.effects?.effect || "") === "mask" || !!c.effects?.maskEnabled),
    )
    .sort((a, b) => a.trackIndex - b.trackIndex);
  return active[active.length - 1] || null;
}

/** @deprecated Prefer activeFxClipAt for tunable values */
export function activeFxEffectAt(
  clips: TimelineClip[],
  t: number,
  hiddenTrackIndexes?: Set<number>,
): string | null {
  const top = activeFxClipAt(clips, t, hiddenTrackIndexes);
  return top?.effects?.effect || null;
}

export type EffectTune = {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  temperature: number;
  tint: number;
  vignetteAmount: number;
};

/** Starting filter values for each look (user-tunable after). */
export const EFFECT_TUNE_DEFAULTS: Record<string, EffectTune> = {
  none: {
    brightness: 0,
    contrast: 1,
    saturation: 1,
    sharpness: 0,
    temperature: 0,
    tint: 0,
    vignetteAmount: 0,
  },
  grayscale: {
    brightness: 0.02,
    contrast: 1.1,
    saturation: 0,
    sharpness: 0.15,
    temperature: 0,
    tint: 0,
    vignetteAmount: 0.15,
  },
  sepia: {
    brightness: 0.04,
    contrast: 1.05,
    saturation: 0.85,
    sharpness: 0,
    temperature: 0.35,
    tint: 0.1,
    vignetteAmount: 0.2,
  },
  vignette: {
    brightness: -0.06,
    contrast: 1.12,
    saturation: 1.05,
    sharpness: 0.1,
    temperature: 0,
    tint: 0,
    vignetteAmount: 0.65,
  },
  sharpen: {
    brightness: 0.02,
    contrast: 1.15,
    saturation: 1.05,
    sharpness: 1.1,
    temperature: 0,
    tint: 0,
    vignetteAmount: 0,
  },
  teal_orange: {
    brightness: 0.04,
    contrast: 1.12,
    saturation: 1.25,
    sharpness: 0.35,
    temperature: 0.2,
    tint: -0.15,
    vignetteAmount: 0.25,
  },
  cyberpunk: {
    brightness: 0.05,
    contrast: 1.2,
    saturation: 1.45,
    sharpness: 0.5,
    temperature: -0.45,
    tint: 0.25,
    vignetteAmount: 0.3,
  },
  noir: {
    brightness: -0.04,
    contrast: 1.35,
    saturation: 0,
    sharpness: 0.4,
    temperature: 0,
    tint: 0,
    vignetteAmount: 0.45,
  },
  warm_glow: {
    brightness: 0.08,
    contrast: 1.02,
    saturation: 1.15,
    sharpness: 0.1,
    temperature: 0.55,
    tint: 0.1,
    vignetteAmount: 0.2,
  },
  cold_blue: {
    brightness: 0.02,
    contrast: 1.08,
    saturation: 1.12,
    sharpness: 0.2,
    temperature: -0.5,
    tint: -0.1,
    vignetteAmount: 0.15,
  },
  vhs: {
    brightness: 0.03,
    contrast: 1.18,
    saturation: 0.9,
    sharpness: 0,
    temperature: 0.15,
    tint: 0.05,
    vignetteAmount: 0.35,
  },
  bloom: {
    brightness: 0.1,
    contrast: 0.95,
    saturation: 1.08,
    sharpness: 0,
    temperature: 0.2,
    tint: 0,
    vignetteAmount: 0.1,
  },
  high_sat: {
    brightness: 0.04,
    contrast: 1.12,
    saturation: 1.55,
    sharpness: 0.45,
    temperature: 0.05,
    tint: 0,
    vignetteAmount: 0.1,
  },
};

export function effectsForLook(effectId: string): ClipEffects {
  const tune = EFFECT_TUNE_DEFAULTS[effectId] || EFFECT_TUNE_DEFAULTS.none;
  return {
    ...DEFAULT_EFFECTS(),
    effect: effectId,
    brightness: tune.brightness,
    contrast: tune.contrast,
    saturation: tune.saturation,
    sharpness: tune.sharpness,
    temperature: tune.temperature,
    tint: tune.tint,
    vignetteAmount: tune.vignetteAmount,
  };
}

export type ExportFps = 25 | 30 | 60;

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  index: number;
  muted?: boolean;
  hidden?: boolean;
  locked?: boolean;
}

export type LibraryTool =
  | "media"
  | "text"
  | "stickers"
  | "effects"
  | "transitions"
  | "captions"
  | "filters";

export type TimelineTab = {
  id: string;
  name: string;
};

export type TimelineBundle = {
  clips: TimelineClip[];
  tracks: Track[];
  playhead: number;
  zoom: number;
};

export interface ProjectSnapshot {
  version: 1;
  name: string;
  savedAt: string;
  filePath?: string;
  /** Cover image for home screen cards */
  coverPath?: string;
  aspect: AspectRatioId;
  fps: number;
  backgroundBlur: boolean;
  projectWidth: number;
  projectHeight: number;
  playhead: number;
  zoom: number;
  media: MediaItem[];
  clips: TimelineClip[];
  tracks?: Track[];
  /** Extra timelines in this project (active is clips/tracks above) */
  timelineTabs?: TimelineTab[];
  activeTimelineId?: string;
  timelineBundles?: Record<string, TimelineBundle>;
}

export const DEFAULT_EFFECTS = (): ClipEffects => ({
  brightness: 0,
  contrast: 1,
  saturation: 1,
  sharpness: 0,
  temperature: 0,
  tint: 0,
  vignetteAmount: 0,
  softBlur: 0,
  posX: 0,
  posY: 0,
  volume: 1,
  audioFadeIn: 0,
  audioFadeOut: 0,
  audioEnhance: false,
  voiceEffect: "none",
  removeBg: false,
  blendMode: "normal",
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
  maskFeather: 8,
  maskShape: "box",
  motionBlur: 0,
  effect: "none",
  fadeIn: 0,
  fadeOut: 0,
  pipX: 0.05,
  pipY: 0.05,
  scaleKeyframes: [],
  opacityKeyframes: [],
  posXKeyframes: [],
  posYKeyframes: [],
  rotationKeyframes: [],
});

export const BLEND_MODES: ClipEffects["blendMode"][] = [
  "normal",
  "screen",
  "multiply",
  "overlay",
  "lighten",
  "color-dodge",
];

/** Preview/export voice FX — FFmpeg filters + approximate preview rates. */
export const VOICE_EFFECTS = [
  { id: "none", label: "Original", desc: "No voice change" },
  { id: "chipmunk", label: "Chipmunk", desc: "Higher pitch" },
  { id: "deep", label: "Deep", desc: "Lower pitch" },
  { id: "robot", label: "Robot", desc: "Tremolo / metallic" },
  { id: "cave", label: "Cave", desc: "Echo chamber" },
  { id: "radio", label: "Radio", desc: "Band-limited" },
] as const;

export type VoiceEffectId = (typeof VOICE_EFFECTS)[number]["id"];

/** Approximate HTMLMediaElement playbackRate for voice preview. */
export function voicePreviewRate(voice: string, speed: number): number {
  const s = Math.max(0.25, Math.min(4, speed || 1));
  if (voice === "chipmunk") return Math.min(4, s * 1.28);
  if (voice === "deep") return Math.max(0.25, s * 0.78);
  return s;
}

export const DEFAULT_TEXT = (): TextStyle => ({
  content: "Your text here",
  fontFamily: "Segoe UI",
  fontSize: 72,
  color: "#ffffff",
  strokeColor: "#000000",
  strokeWidth: 0,
  shadowColor: "rgba(0,0,0,0.65)",
  shadowBlur: 10,
  shadowOffsetX: 2,
  shadowOffsetY: 3,
  backgroundColor: "#000000",
  backgroundOpacity: 0,
  x: 0.5,
  y: 0.5,
  rotation: 0,
  align: "center",
  bold: false,
  italic: false,
  letterSpacing: 0,
  lineHeight: 1.25,
  opacity: 1,
});

export const TEXT_FONTS = [
  "Segoe UI",
  "Arial",
  "Georgia",
  "Impact",
  "Verdana",
  "Trebuchet MS",
  "Times New Roman",
  "Consolas",
  "Comic Sans MS",
  "Courier New",
] as const;

export function isTextClip(clip: TimelineClip): boolean {
  return clip.trackKind === "text" || !!clip.text;
}

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
  { id: "none", label: "None", group: "essentials" },
  { id: "grayscale", label: "Grayscale", group: "essentials" },
  { id: "sepia", label: "Sepia", group: "essentials" },
  { id: "vignette", label: "Vignette", group: "essentials" },
  { id: "sharpen", label: "Sharpen", group: "essentials" },
  { id: "teal_orange", label: "Teal & Orange", group: "gaming" },
  { id: "cyberpunk", label: "Cyberpunk Neon", group: "gaming" },
  { id: "noir", label: "Noir Contrast", group: "gaming" },
  { id: "warm_glow", label: "Warm Glow", group: "gaming" },
  { id: "cold_blue", label: "Cold Blue", group: "gaming" },
  { id: "vhs", label: "VHS Retro", group: "gaming" },
  { id: "bloom", label: "Soft Bloom", group: "gaming" },
  { id: "high_sat", label: "Hyper Saturation", group: "gaming" },
] as const;

export const TRANSITION_PRESETS = [
  { id: "none", label: "None", fadeIn: 0, fadeOut: 0 },
  { id: "fade", label: "Fade", fadeIn: 0.4, fadeOut: 0.4 },
  { id: "fade_in", label: "Fade In", fadeIn: 0.6, fadeOut: 0 },
  { id: "fade_out", label: "Fade Out", fadeIn: 0, fadeOut: 0.6 },
  { id: "cross_soft", label: "Soft Cross", fadeIn: 0.8, fadeOut: 0.8 },
] as const;

export const STICKER_PRESETS = [
  "🔥", "💥", "✨", "⭐", "🎮", "🏆", "💀", "😎", "😂", "❤️",
  "💯", "⚡", "🎯", "🚀", "👑", "😈", "🙌", "👏", "🎶", "📌",
] as const;

/** CSS filter string for preview (export uses FFmpeg equivalents). */
export function cssFilterForEffect(effect: string, fx: ClipEffects): string {
  const sharpBoost = 1 + Math.max(0, fx.sharpness || 0) * 0.12;
  const tempDeg = (fx.temperature || 0) * 28;
  const tintDeg = (fx.tint || 0) * 18;
  const hue = tempDeg + tintDeg;

  let look = `brightness(${1 + fx.brightness}) contrast(${fx.contrast * sharpBoost}) saturate(${fx.saturation})`;
  if (Math.abs(hue) > 0.5) look += ` hue-rotate(${hue.toFixed(1)}deg)`;
  if ((fx.softBlur || 0) > 0.05) look += ` blur(${Math.min(12, fx.softBlur).toFixed(1)}px)`;

  switch (effect) {
    case "grayscale":
      look += " grayscale(1)";
      break;
    case "sepia":
      look += " sepia(0.75)";
      break;
    case "vignette":
      break;
    case "sharpen":
      look += ` contrast(${(1 + (fx.sharpness || 0) * 0.08).toFixed(3)})`;
      break;
    case "teal_orange":
      look += " sepia(0.12)";
      break;
    case "cyberpunk":
      look += " hue-rotate(12deg)";
      break;
    case "noir":
      look += " grayscale(1)";
      break;
    case "warm_glow":
      look += " sepia(0.22)";
      break;
    case "cold_blue":
      break;
    case "vhs":
      look += " contrast(1.05) hue-rotate(4deg)";
      break;
    case "bloom":
      look += " brightness(1.04) blur(0.25px)";
      break;
    case "high_sat":
      break;
    default:
      break;
  }
  return look;
}
