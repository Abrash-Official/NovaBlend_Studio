import { create } from "zustand";
import {
  ASPECT_PRESETS,
  AspectRatioId,
  ClipEffects,
  DEFAULT_EFFECTS,
  DEFAULT_TEXT,
  EFFECT_PRESETS,
  effectsForLook,
  isFxClip,
  isStillClip,
  isTextClip,
  keyframeListKey,
  KeyframeProp,
  LibraryTool,
  MediaItem,
  ProjectSnapshot,
  TextStyle,
  TimelineBundle,
  TimelineClip,
  TimelineTab,
  Track,
} from "../types/editor";

type HistorySnap = {
  clips: TimelineClip[];
  tracks: Track[];
  selectedClipId: string | null;
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const defaultTracks: Track[] = [
  { id: "v1", kind: "video", name: "V1", index: 0, muted: false, hidden: false, locked: false },
  { id: "f1", kind: "fx", name: "F1 FX", index: 1, muted: false, hidden: false, locked: false },
  { id: "t1", kind: "text", name: "T1 Text", index: 2, muted: false, hidden: false, locked: false },
  { id: "a1", kind: "audio", name: "A1", index: 3, muted: false, hidden: false, locked: false },
];

const LAYOUT_DEFAULTS = { leftWidth: 300, rightWidth: 280, timelineHeight: 280 };

function normalizeTracks(tracks?: Track[]): Track[] {
  if (!tracks?.length) return defaultTracks.map((t) => ({ ...t }));
  return defaultTracks.map((def) => {
    const found = tracks.find((t) => t.id === def.id || t.kind === def.kind);
    return {
      ...def,
      ...(found || {}),
      id: def.id,
      kind: def.kind,
      name: def.name,
      index: def.index,
      muted: found?.muted ?? false,
      hidden: found?.hidden ?? false,
      locked: found?.locked ?? false,
    };
  });
}

function normalizeEffects(fx?: Partial<ClipEffects>): ClipEffects {
  return { ...DEFAULT_EFFECTS(), ...(fx || {}) };
}

function trackLockedForClip(
  tracks: Track[],
  clips: TimelineClip[],
  clipId: string,
): boolean {
  const clip = clips.find((c) => c.id === clipId);
  if (!clip) return false;
  return !!tracks.find((t) => t.index === clip.trackIndex)?.locked;
}

function normalizeClip(c: TimelineClip): TimelineClip {
  const effects = normalizeEffects(c.effects);
  if (isFxClip(c) || c.trackKind === "fx") {
    return {
      ...c,
      effects,
      trackKind: "fx",
      hasAudio: false,
      mediaId: c.mediaId || "",
      mediaPath: c.mediaPath || "",
      previewPath: c.previewPath || "",
    };
  }
  if (!isTextClip(c) && c.trackKind !== "text") {
    return { ...c, effects };
  }
  return {
    ...c,
    effects,
    trackKind: "text",
    hasAudio: false,
    mediaId: c.mediaId || "",
    mediaPath: c.mediaPath || "",
    previewPath: c.previewPath || "",
    text: { ...DEFAULT_TEXT(), ...(c.text || {}) },
  };
}

/** Remap clips from older layouts onto V1 / F1 / T1 / A1. */
function migrateClipTracks(clips: TimelineClip[]): TimelineClip[] {
  const videoIdx = defaultTracks.find((t) => t.kind === "video")!.index;
  const fxIdx = defaultTracks.find((t) => t.kind === "fx")!.index;
  const textIdx = defaultTracks.find((t) => t.kind === "text")!.index;
  const audioIdx = defaultTracks.find((t) => t.kind === "audio")!.index;

  return clips.map((c) => {
    const base = normalizeClip(c);
    if (isFxClip(base) || base.trackKind === "fx") {
      return { ...base, trackIndex: fxIdx, trackKind: "fx" as const };
    }
    if (isTextClip(base) || base.trackKind === "text") {
      return { ...base, trackIndex: textIdx, trackKind: "text" as const };
    }
    if (base.trackKind === "audio") {
      return { ...base, trackIndex: audioIdx, trackKind: "audio" as const };
    }
    return { ...base, trackIndex: videoIdx, trackKind: "video" as const };
  });
}

export type AppView = "home" | "editor";

interface EditorState {
  view: AppView;
  projectName: string;
  projectPath: string | null;
  dirty: boolean;
  media: MediaItem[];
  tracks: Track[];
  clips: TimelineClip[];
  selectedClipId: string | null;
  playhead: number;
  isPlaying: boolean;
  aspect: AspectRatioId;
  projectWidth: number;
  projectHeight: number;
  fps: number;
  backgroundBlur: boolean;
  zoom: number;
  status: string;
  exporting: boolean;
  exportPercent: number;
  exportEtaSeconds: number;
  exportMessage: string;
  showExportDialog: boolean;
  processingCount: number;
  libraryTool: LibraryTool;
  layoutLeftWidth: number;
  layoutRightWidth: number;
  layoutTimelineHeight: number;
  lastAutoSavedAt: number | null;
  magnetEnabled: boolean;
  past: HistorySnap[];
  future: HistorySnap[];
  timelineTabs: TimelineTab[];
  activeTimelineId: string;
  timelineBundles: Record<string, TimelineBundle>;

  setView: (v: AppView) => void;
  setLibraryTool: (t: LibraryTool) => void;
  updateTrack: (index: number, patch: Partial<Track>) => void;
  setLayoutSize: (
    patch: Partial<{
      leftWidth: number;
      rightWidth: number;
      timelineHeight: number;
    }>,
  ) => void;
  isClipLocked: (clipId: string) => boolean;
  setStatus: (s: string) => void;
  setPlayhead: (t: number) => void;
  setPlaying: (v: boolean) => void;
  setAspect: (a: AspectRatioId) => void;
  setBackgroundBlur: (v: boolean) => void;
  setZoom: (z: number) => void;
  setExporting: (v: boolean) => void;
  setExportProgress: (percent: number, etaSeconds: number, message: string) => void;
  setShowExportDialog: (v: boolean) => void;
  setFps: (fps: number) => void;
  setProjectSize: (width: number, height: number) => void;
  setProjectName: (name: string) => void;
  selectClip: (id: string | null) => void;
  markDirty: () => void;

  addMedia: (item: MediaItem) => void;
  updateMedia: (id: string, patch: Partial<MediaItem>) => void;
  removeMedia: (id: string) => void;
  addClipFromMedia: (mediaId: string, trackIndex?: number) => void;
  addTextClip: (textPatch?: Partial<TextStyle>) => void;
  addFxClip: (effectId: string) => void;
  addMaskClip: (shape: "box" | "circle") => void;
  updateClip: (id: string, patch: Partial<TimelineClip>) => void;
  updateSelectedEffects: (patch: Partial<ClipEffects>) => void;
  updateSelectedText: (patch: Partial<TextStyle>) => void;
  removeSelectedClip: () => void;
  removeClip: (id: string) => void;
  splitSelectedAtPlayhead: () => void;
  splitClipAtPlayhead: (id: string) => void;
  duplicateClip: (id: string) => void;
  toggleClipReverse: (id: string) => void;
  insertFreezeMediaClip: (args: {
    afterClipId: string;
    media: MediaItem;
    freezeDuration: number;
    sourceTime: number;
  }) => void;
  trimSelected: (edge: "in" | "out", delta: number) => void;
  trimClip: (
    id: string,
    edge: "in" | "out",
    timelineDelta: number,
  ) => void;
  moveClip: (id: string, newStart: number, newTrack?: number) => void;
  addKeyframe: (prop: KeyframeProp, time: number, value: number) => void;
  toggleKeyframe: (prop: KeyframeProp, time: number, value: number) => void;
  timelineDuration: () => number;

  setMagnetEnabled: (v: boolean) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  addTimeline: () => void;
  switchTimeline: (id: string) => void;
  applyCropMask: () => void;
  toggleRemoveBg: () => void;
  addQuickKeyframe: () => void;
  clipboardClip: TimelineClip | null;
  copySelectedClip: () => void;
  pasteClipboard: () => void;

  newProject: (name?: string, aspect?: AspectRatioId) => void;
  loadSnapshot: (snap: ProjectSnapshot) => void;
  toSnapshot: () => ProjectSnapshot;
  bumpProcessing: (delta: number) => void;
}

function cloneHistory(s: {
  clips: TimelineClip[];
  tracks: Track[];
  selectedClipId: string | null;
}): HistorySnap {
  return {
    clips: structuredClone(s.clips),
    tracks: structuredClone(s.tracks),
    selectedClipId: s.selectedClipId,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  view: "home",
  projectName: "Untitled Project",
  projectPath: null,
  dirty: false,
  media: [],
  tracks: defaultTracks,
  clips: [],
  selectedClipId: null,
  playhead: 0,
  isPlaying: false,
  aspect: "16:9",
  projectWidth: 1920,
  projectHeight: 1080,
  fps: 30,
  backgroundBlur: true,
  zoom: 64,
  status: "Ready — create or open a project to get started",
  exporting: false,
  exportPercent: 0,
  exportEtaSeconds: 0,
  exportMessage: "",
  showExportDialog: false,
  processingCount: 0,
  libraryTool: "media",
  layoutLeftWidth: LAYOUT_DEFAULTS.leftWidth,
  layoutRightWidth: LAYOUT_DEFAULTS.rightWidth,
  layoutTimelineHeight: LAYOUT_DEFAULTS.timelineHeight,
  lastAutoSavedAt: null,
  magnetEnabled: true,
  past: [],
  future: [],
  timelineTabs: [{ id: "tl_1", name: "Timeline 01" }],
  activeTimelineId: "tl_1",
  timelineBundles: {},
  clipboardClip: null,

  setView: (v) => set({ view: v }),
  setMagnetEnabled: (v) => set({ magnetEnabled: v }),

  copySelectedClip: () => {
    const s = get();
    const clip = s.clips.find((c) => c.id === s.selectedClipId);
    if (!clip) {
      set({ status: "Select a clip to copy" });
      return;
    }
    set({
      clipboardClip: structuredClone(clip),
      status: `Copied “${clip.name}”`,
    });
  },

  pasteClipboard: () => {
    const s = get();
    const src = s.clipboardClip;
    if (!src) {
      set({ status: "Clipboard empty — copy a clip first (Ctrl+C)" });
      return;
    }
    const track = s.tracks.find((t) => t.kind === src.trackKind);
    if (!track) {
      set({ status: "No matching track for paste" });
      return;
    }
    if (track.locked) {
      set({ status: "Track is locked" });
      return;
    }
    get().pushHistory();
    const copy: TimelineClip = {
      ...structuredClone(src),
      id: uid(isTextClip(src) ? "text" : "clip"),
      start: s.playhead,
      trackIndex: track.index,
      trackKind: track.kind,
    };
    set((st) => ({
      clips: [...st.clips, copy],
      selectedClipId: copy.id,
      dirty: true,
      status: `Pasted “${copy.name}”`,
    }));
  },

  pushHistory: () => {
    const s = get();
    const snap = cloneHistory(s);
    set({
      past: [...s.past.slice(-40), snap],
      future: [],
    });
  },

  undo: () => {
    const s = get();
    if (!s.past.length) {
      set({ status: "Nothing to undo" });
      return;
    }
    const prev = s.past[s.past.length - 1];
    const current = cloneHistory(s);
    set({
      past: s.past.slice(0, -1),
      future: [current, ...s.future].slice(0, 40),
      clips: prev.clips,
      tracks: prev.tracks,
      selectedClipId: prev.selectedClipId,
      dirty: true,
      status: "Undo",
    });
  },

  redo: () => {
    const s = get();
    if (!s.future.length) {
      set({ status: "Nothing to redo" });
      return;
    }
    const next = s.future[0];
    const current = cloneHistory(s);
    set({
      future: s.future.slice(1),
      past: [...s.past, current].slice(-40),
      clips: next.clips,
      tracks: next.tracks,
      selectedClipId: next.selectedClipId,
      dirty: true,
      status: "Redo",
    });
  },

  addTimeline: () => {
    const s = get();
    const id = uid("tl");
    const n = s.timelineTabs.length + 1;
    const bundles = {
      ...s.timelineBundles,
      [s.activeTimelineId]: {
        clips: structuredClone(s.clips),
        tracks: structuredClone(s.tracks),
        playhead: s.playhead,
        zoom: s.zoom,
      },
    };
    set({
      timelineBundles: bundles,
      timelineTabs: [...s.timelineTabs, { id, name: `Timeline ${String(n).padStart(2, "0")}` }],
      activeTimelineId: id,
      clips: [],
      tracks: structuredClone(defaultTracks),
      selectedClipId: null,
      playhead: 0,
      past: [],
      future: [],
      dirty: true,
      status: `Created Timeline ${String(n).padStart(2, "0")}`,
    });
  },

  switchTimeline: (id) => {
    const s = get();
    if (id === s.activeTimelineId) return;
    const bundles = {
      ...s.timelineBundles,
      [s.activeTimelineId]: {
        clips: structuredClone(s.clips),
        tracks: structuredClone(s.tracks),
        playhead: s.playhead,
        zoom: s.zoom,
      },
    };
    const next = bundles[id] || {
      clips: [],
      tracks: structuredClone(defaultTracks),
      playhead: 0,
      zoom: s.zoom,
    };
    set({
      timelineBundles: bundles,
      activeTimelineId: id,
      clips: structuredClone(next.clips),
      tracks: structuredClone(next.tracks.length ? next.tracks : defaultTracks),
      playhead: next.playhead,
      zoom: next.zoom || s.zoom,
      selectedClipId: null,
      past: [],
      future: [],
      dirty: true,
      status: `Switched to ${s.timelineTabs.find((t) => t.id === id)?.name || "timeline"}`,
    });
  },

  applyCropMask: () => {
    const id = get().selectedClipId;
    if (!id) {
      set({ status: "Select a clip to crop" });
      return;
    }
    get().pushHistory();
    get().updateSelectedEffects({
      maskEnabled: true,
      maskShape: "box",
      cropX: 0.08,
      cropY: 0.08,
      cropW: 0.84,
      cropH: 0.84,
      maskFeather: 6,
    });
    set({ status: "Crop mask on — tweak in Mask tab" });
  },

  toggleRemoveBg: () => {
    const id = get().selectedClipId;
    if (!id) {
      set({ status: "Select a video clip to remove background" });
      return;
    }
    const clip = get().clips.find((c) => c.id === id);
    if (!clip || clip.trackKind !== "video") {
      set({ status: "Remove background works on video clips" });
      return;
    }
    get().pushHistory();
    const on = !clip.effects?.removeBg;
    get().updateSelectedEffects({ removeBg: on });
    set({ status: on ? "Remove background on" : "Remove background off" });
  },

  addQuickKeyframe: () => {
    const s = get();
    const clip = s.clips.find((c) => c.id === s.selectedClipId);
    if (!clip) {
      set({ status: "Select a clip to add a keyframe" });
      return;
    }
    if (s.playhead < clip.start || s.playhead > clip.start + clip.duration) {
      set({ status: "Move playhead onto the clip, then add a keyframe" });
      return;
    }
    const t = Math.max(0, Math.min(clip.duration, s.playhead - clip.start));
    get().pushHistory();
    get().toggleKeyframe("scale", t, clip.effects.scale ?? 1);
  },
  setLibraryTool: (t) => set({ libraryTool: t }),
  updateTrack: (index, patch) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.index === index ? { ...t, ...patch } : t)),
      dirty: true,
    })),
  setLayoutSize: (patch) =>
    set((s) => ({
      layoutLeftWidth:
        patch.leftWidth !== undefined
          ? Math.min(520, Math.max(220, patch.leftWidth))
          : s.layoutLeftWidth,
      layoutRightWidth:
        patch.rightWidth !== undefined
          ? Math.min(480, Math.max(200, patch.rightWidth))
          : s.layoutRightWidth,
      layoutTimelineHeight:
        patch.timelineHeight !== undefined
          ? Math.min(560, Math.max(180, patch.timelineHeight))
          : s.layoutTimelineHeight,
    })),
  isClipLocked: (clipId) => {
    const s = get();
    return trackLockedForClip(s.tracks, s.clips, clipId);
  },
  setStatus: (s) => set({ status: s }),
  setPlayhead: (t) => set({ playhead: Math.max(0, t) }),
  setPlaying: (v) => set({ isPlaying: v }),
  setAspect: (a) => {
    const p = ASPECT_PRESETS[a];
    set({
      aspect: a,
      projectWidth: p.width,
      projectHeight: p.height,
      dirty: true,
    });
  },
  setBackgroundBlur: (v) => set({ backgroundBlur: v, dirty: true }),
  setZoom: (z) => set({ zoom: Math.min(200, Math.max(24, z)) }),
  setExporting: (v) => set({ exporting: v, ...(v ? {} : { exportPercent: 0, exportMessage: "" }) }),
  setExportProgress: (percent, etaSeconds, message) =>
    set({ exportPercent: percent, exportEtaSeconds: etaSeconds, exportMessage: message }),
  setShowExportDialog: (v) => set({ showExportDialog: v }),
  setFps: (fps) => set({ fps, dirty: true }),
  setProjectSize: (width, height) =>
    set({
      projectWidth: Math.max(16, Math.round(width / 2) * 2),
      projectHeight: Math.max(16, Math.round(height / 2) * 2),
      dirty: true,
    }),
  setProjectName: (name) => set({ projectName: name.trim() || "Untitled Project", dirty: true }),
  selectClip: (id) => set({ selectedClipId: id }),
  markDirty: () => set({ dirty: true }),
  bumpProcessing: (delta) =>
    set((s) => ({ processingCount: Math.max(0, s.processingCount + delta) })),

  addMedia: (item) =>
    set((s) => ({ media: [...s.media, item], dirty: true })),

  updateMedia: (id, patch) =>
    set((s) => ({
      media: s.media.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      clips: s.clips.map((c) =>
        c.mediaId === id
          ? {
              ...c,
              previewPath: patch.previewPath ?? c.previewPath,
              mediaPath: patch.path ?? c.mediaPath,
            }
          : c,
      ),
      dirty: true,
    })),

  removeMedia: (id) =>
    set((s) => {
      const nextClips = s.clips.filter(
        (c) => isTextClip(c) || c.mediaId !== id,
      );
      return {
        media: s.media.filter((m) => m.id !== id),
        clips: nextClips,
        selectedClipId:
          s.selectedClipId && nextClips.some((c) => c.id === s.selectedClipId)
            ? s.selectedClipId
            : null,
        status: "Media removed from bin",
        dirty: true,
      };
    }),

  addClipFromMedia: (mediaId, trackIndex) => {
    const media = get().media.find((m) => m.id === mediaId);
    if (!media) return;
    if (media.readyState === "processing") {
      set({ status: `Still processing “${media.name}”. Wait until it says Ready.` });
      return;
    }
    if (media.readyState === "error") {
      set({ status: `Cannot add “${media.name}” — preview failed.` });
      return;
    }
    const tracks = get().tracks;
    const preferred =
      trackIndex ??
      (media.hasVideo
        ? tracks.find((t) => t.kind === "video")?.index ?? 0
        : tracks.find((t) => t.kind === "audio")?.index ?? 2);
    const track = tracks.find((t) => t.index === preferred) ?? tracks[0];
    const sameTrack = get().clips.filter((c) => c.trackIndex === track.index);
    const start = sameTrack.reduce(
      (max, c) => Math.max(max, c.start + c.duration),
      0,
    );

    const clip: TimelineClip = {
      id: uid("clip"),
      mediaId: media.id,
      mediaPath: media.path,
      previewPath: media.previewPath || media.path,
      name: media.name,
      trackIndex: track.index,
      trackKind: track.kind === "text" ? "video" : track.kind,
      hasAudio: media.hasAudio,
      start,
      duration: media.duration,
      inPoint: 0,
      outPoint: media.duration,
      effects: DEFAULT_EFFECTS(),
    };

    set((s) => ({
      clips: [...s.clips, clip],
      selectedClipId: clip.id,
      status: `Added ${media.name} to timeline`,
      dirty: true,
    }));
  },

  addTextClip: (textPatch) => {
    const tracks = get().tracks;
    const track = tracks.find((t) => t.kind === "text") ?? {
      id: "t1",
      kind: "text" as const,
      name: "T1 Text",
      index: 2,
      muted: false,
      hidden: false,
      locked: false,
    };
    if (track.locked) {
      set({ status: "Text track is locked" });
      return;
    }
    const playhead = get().playhead;
    const duration = 5;
    const text = { ...DEFAULT_TEXT(), ...(textPatch || {}) };
    const clip: TimelineClip = {
      id: uid("text"),
      mediaId: "",
      mediaPath: "",
      previewPath: "",
      name: text.content.slice(0, 24) || "Text",
      trackIndex: track.index,
      trackKind: "text",
      hasAudio: false,
      start: Math.max(0, playhead),
      duration,
      inPoint: 0,
      outPoint: duration,
      effects: DEFAULT_EFFECTS(),
      text,
    };
    set((s) => ({
      clips: [...s.clips, clip],
      selectedClipId: clip.id,
      tracks: s.tracks.some((t) => t.kind === "text")
        ? s.tracks
        : [...s.tracks.filter((t) => t.kind !== "audio"), track, ...s.tracks.filter((t) => t.kind === "audio")],
      status: "Added text — drag on preview to position",
      dirty: true,
    }));
  },

  addFxClip: (effectId) => {
    const s = get();
    const track = s.tracks.find((t) => t.kind === "fx");
    if (!track) {
      set({ status: "FX track missing" });
      return;
    }
    if (track.locked) {
      set({ status: "FX track is locked" });
      return;
    }
    if (effectId === "none") {
      set({ status: "Pick a filter or effect to add on F1" });
      return;
    }
    const selected = s.clips.find((c) => c.id === s.selectedClipId);
    const videoAtPlayhead = s.clips.find(
      (c) =>
        c.trackKind === "video" &&
        s.playhead >= c.start &&
        s.playhead < c.start + c.duration,
    );
    const anchor =
      selected?.trackKind === "video"
        ? selected
        : selected?.trackKind === "fx"
          ? selected
          : videoAtPlayhead;

    const start =
      selected?.trackKind === "fx"
        ? selected.start
        : anchor && anchor.trackKind === "video"
          ? anchor.start
          : Math.max(0, s.playhead);
    const duration =
      selected?.trackKind === "fx"
        ? selected.duration
        : anchor && anchor.trackKind === "video"
          ? Math.max(0.5, anchor.duration)
          : 3;

    const label =
      EFFECT_PRESETS.find((p) => p.id === effectId)?.label || effectId;

    // Replacing effect on an existing selected FX clip — reset tune to that look’s defaults
    if (selected?.trackKind === "fx") {
      set((st) => ({
        clips: st.clips.map((c) =>
          c.id === selected.id
            ? {
                ...c,
                name: label,
                effects: effectsForLook(effectId),
              }
            : c,
        ),
        dirty: true,
        status: `Updated FX: ${label} — tweak values in Properties`,
      }));
      return;
    }

    const clip: TimelineClip = {
      id: uid("fx"),
      mediaId: "",
      mediaPath: "",
      previewPath: "",
      name: label,
      trackIndex: track.index,
      trackKind: "fx",
      hasAudio: false,
      start,
      duration,
      inPoint: 0,
      outPoint: duration,
      effects: effectsForLook(effectId),
    };
    set((st) => ({
      clips: [...st.clips, clip],
      selectedClipId: clip.id,
      dirty: true,
      status: `Added ${label} on F1 — tweak brightness/contrast in Properties`,
    }));
  },

  addMaskClip: (shape) => {
    const s = get();
    const track = s.tracks.find((t) => t.kind === "fx");
    if (!track) {
      set({ status: "FX track missing" });
      return;
    }
    if (track.locked) {
      set({ status: "FX track is locked" });
      return;
    }
    const selected = s.clips.find((c) => c.id === s.selectedClipId);
    const video =
      selected?.trackKind === "video"
        ? selected
        : s.clips.find(
            (c) =>
              c.trackKind === "video" &&
              s.playhead >= c.start &&
              s.playhead < c.start + c.duration,
          );
    if (!video) {
      set({ status: "Select a video clip first, then add a mask" });
      return;
    }

    const label = shape === "circle" ? "Mask · Circle" : "Mask · Box";
    const clip: TimelineClip = {
      id: uid("mask"),
      mediaId: "",
      mediaPath: "",
      previewPath: "",
      name: label,
      trackIndex: track.index,
      trackKind: "fx",
      hasAudio: false,
      start: video.start,
      duration: Math.max(0.5, video.duration),
      inPoint: 0,
      outPoint: Math.max(0.5, video.duration),
      effects: {
        ...DEFAULT_EFFECTS(),
        effect: "mask",
        maskEnabled: true,
        maskShape: shape,
        maskFeather: 10,
        cropX: 0.12,
        cropY: 0.12,
        cropW: 0.76,
        cropH: 0.76,
      },
    };
    set((st) => ({
      clips: [...st.clips, clip],
      selectedClipId: clip.id,
      dirty: true,
      libraryTool: "effects",
      status: `Added ${label} on F1 — trim length · edit shape in Mask tab`,
    }));
  },

  updateClip: (id, patch) => {
    const s = get();
    if (trackLockedForClip(s.tracks, s.clips, id)) {
      set({ status: "Track is locked" });
      return;
    }
    set((st) => ({
      clips: st.clips.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        if (patch.text) {
          next.text = { ...(c.text || DEFAULT_TEXT()), ...patch.text };
          if (patch.text.content !== undefined) {
            next.name = patch.text.content.trim().slice(0, 28) || "Text";
          }
        }
        if (
          patch.inPoint !== undefined ||
          patch.outPoint !== undefined ||
          patch.effects?.speed !== undefined
        ) {
          const speed = Math.max(0.05, next.effects.speed || 1);
          next.duration = Math.max(0.05, (next.outPoint - next.inPoint) / speed);
        }
        return next;
      }),
      dirty: true,
    }));
  },

  updateSelectedEffects: (patch) => {
    const id = get().selectedClipId;
    if (!id) return;
    if (get().isClipLocked(id)) {
      set({ status: "Track is locked" });
      return;
    }
    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== id) return c;
        let effects = { ...c.effects, ...patch };
        // Keep active playhead keyframes in sync when dragging sliders
        const localT = Math.max(0, s.playhead - c.start);
        const keyed: KeyframeProp[] = [
          "scale",
          "opacity",
          "posX",
          "posY",
          "rotation",
        ];
        for (const prop of keyed) {
          if (patch[prop] === undefined) continue;
          const key = keyframeListKey(prop);
          const list = [...(effects[key] || [])];
          if (!list.length) continue;
          const idx = list.findIndex((k) => Math.abs(k.time - localT) <= 0.05);
          if (idx >= 0) {
            list[idx] = { time: list[idx].time, value: Number(patch[prop]) };
            effects = { ...effects, [key]: list };
          }
        }
        return { ...c, effects };
      }),
      dirty: true,
    }));
  },

  updateSelectedText: (patch) => {
    const id = get().selectedClipId;
    if (!id) return;
    if (get().isClipLocked(id)) {
      set({ status: "Track is locked" });
      return;
    }
    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== id || !isTextClip(c)) return c;
        const text = { ...(c.text || DEFAULT_TEXT()), ...patch };
        return {
          ...c,
          text,
          name:
            patch.content !== undefined
              ? patch.content.trim().slice(0, 28) || "Text"
              : c.name,
        };
      }),
      dirty: true,
    }));
  },

  removeSelectedClip: () => {
    const id = get().selectedClipId;
    if (!id) return;
    get().pushHistory();
    get().removeClip(id);
  },

  removeClip: (id) => {
    if (get().isClipLocked(id)) {
      set({ status: "Track is locked — unlock to delete" });
      return;
    }
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== id),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
      status: "Clip removed",
      dirty: true,
    }));
  },

  splitSelectedAtPlayhead: () => {
    const id = get().selectedClipId;
    if (!id) return;
    get().splitClipAtPlayhead(id);
  },

  splitClipAtPlayhead: (id) => {
    const { playhead, clips } = get();
    const clip = clips.find((c) => c.id === id);
    if (!clip) return;
    if (get().isClipLocked(id)) {
      set({ status: "Track is locked" });
      return;
    }
    if (playhead <= clip.start || playhead >= clip.start + clip.duration) {
      set({ status: "Move playhead onto the clip to split" });
      return;
    }
    const speed = Math.max(0.05, clip.effects.speed || 1);
    const local = playhead - clip.start;
    const splitSrc = clip.inPoint + local * speed;
    const left: TimelineClip = {
      ...clip,
      id: uid("clip"),
      outPoint: splitSrc,
      duration: (splitSrc - clip.inPoint) / speed,
      text: clip.text ? { ...clip.text } : undefined,
    };
    const right: TimelineClip = {
      ...clip,
      id: uid("clip"),
      start: playhead,
      inPoint: splitSrc,
      duration: (clip.outPoint - splitSrc) / speed,
      text: clip.text ? { ...clip.text } : undefined,
    };
    set((s) => ({
      clips: [...s.clips.filter((c) => c.id !== clip.id), left, right],
      selectedClipId: right.id,
      status: "Clip split",
      dirty: true,
    }));
  },

  duplicateClip: (id) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip) return;
    if (get().isClipLocked(id)) {
      set({ status: "Track is locked" });
      return;
    }
    const copy: TimelineClip = {
      ...clip,
      id: uid(isTextClip(clip) ? "text" : "clip"),
      start: clip.start + clip.duration,
      effects: {
        ...clip.effects,
        scaleKeyframes: [...(clip.effects.scaleKeyframes || [])],
        opacityKeyframes: [...(clip.effects.opacityKeyframes || [])],
        posXKeyframes: [...(clip.effects.posXKeyframes || [])],
        posYKeyframes: [...(clip.effects.posYKeyframes || [])],
        rotationKeyframes: [...(clip.effects.rotationKeyframes || [])],
      },
      text: clip.text ? { ...clip.text } : undefined,
      isStill: clip.isStill,
      stillPath: clip.stillPath,
    };
    set((s) => ({
      clips: [...s.clips, copy],
      selectedClipId: copy.id,
      status: `Duplicated “${clip.name}”`,
      dirty: true,
    }));
  },

  toggleClipReverse: (id) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip || isTextClip(clip)) {
      set({ status: "Reverse works on video/audio clips" });
      return;
    }
    if (get().isClipLocked(id)) {
      set({ status: "Track is locked" });
      return;
    }
    const next = !clip.effects.reverse;
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id ? { ...c, effects: { ...c.effects, reverse: next } } : c,
      ),
      selectedClipId: id,
      status: next ? "Clip set to reverse" : "Reverse off",
      dirty: true,
    }));
  },

  insertFreezeMediaClip: ({ afterClipId, media, freezeDuration, sourceTime }) => {
    const state = get();
    const clip = state.clips.find((c) => c.id === afterClipId);
    if (!clip) return;
    const playhead = state.playhead;
    if (playhead <= clip.start || playhead >= clip.start + clip.duration) {
      set({ status: "Move playhead onto the clip to freeze" });
      return;
    }
    const speed = Math.max(0.05, clip.effects.speed || 1);
    const splitSrc = sourceTime;
    const left: TimelineClip = {
      ...clip,
      id: uid("clip"),
      outPoint: splitSrc,
      duration: Math.max(0.05, (splitSrc - clip.inPoint) / speed),
    };
    const freeze: TimelineClip = {
      id: uid("clip"),
      mediaId: media.id,
      mediaPath: media.path,
      previewPath: media.previewPath || media.path,
      name: "Freeze",
      trackIndex: clip.trackIndex,
      trackKind: "video",
      hasAudio: false,
      start: playhead,
      duration: freezeDuration,
      inPoint: 0,
      outPoint: freezeDuration,
      effects: DEFAULT_EFFECTS(),
      isStill: true,
      stillPath: media.stillPath || media.path,
    };
    const right: TimelineClip = {
      ...clip,
      id: uid("clip"),
      start: playhead + freezeDuration,
      inPoint: splitSrc,
      duration: Math.max(0.05, (clip.outPoint - splitSrc) / speed),
    };

    set((s) => {
      const shifted = s.clips
        .filter((c) => c.id !== clip.id)
        .map((c) => {
          if (c.trackIndex !== clip.trackIndex) return c;
          if (c.start >= playhead) {
            return { ...c, start: c.start + freezeDuration };
          }
          return c;
        });
      return {
        media: s.media.some((m) => m.id === media.id) ? s.media : [...s.media, media],
        clips: [...shifted, left, freeze, right],
        selectedClipId: freeze.id,
        status: `Freeze frame added (${freezeDuration}s)`,
        dirty: true,
      };
    });
  },

  trimSelected: (edge, delta) => {
    const id = get().selectedClipId;
    if (!id) return;
    get().trimClip(id, edge, delta);
  },

  trimClip: (id, edge, timelineDelta) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip) return;
    const track = get().tracks.find((t) => t.index === clip.trackIndex);
    if (track?.locked) return;
    const media = get().media.find((m) => m.id === clip.mediaId);
    // Text / FX / freeze can be stretched freely
    const freeLen = isTextClip(clip) || isStillClip(clip) || isFxClip(clip);
    const mediaDur = freeLen
      ? Math.max(clip.outPoint + 120, 600)
      : (media?.duration ?? Math.max(clip.outPoint, clip.inPoint + 0.05));
    const speed = Math.max(0.05, clip.effects.speed || 1);
    const sourceDelta = timelineDelta * speed;
    const minLen = 0.05;

    if (edge === "in") {
      const nextIn = Math.min(
        clip.outPoint - minLen,
        Math.max(0, clip.inPoint + sourceDelta),
      );
      const shifted = (nextIn - clip.inPoint) / speed;
      get().updateClip(id, {
        inPoint: nextIn,
        start: Math.max(0, clip.start + shifted),
        duration: (clip.outPoint - nextIn) / speed,
      });
    } else {
      const nextOut = Math.min(
        mediaDur,
        Math.max(clip.inPoint + minLen, clip.outPoint + sourceDelta),
      );
      get().updateClip(id, {
        outPoint: nextOut,
        duration: (nextOut - clip.inPoint) / speed,
      });
    }
  },

  moveClip: (id, newStart, newTrack) => {
    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== id) return c;
        const currentTrack = s.tracks.find((t) => t.index === c.trackIndex);
        if (currentTrack?.locked) return c;

        const track =
          newTrack !== undefined
            ? s.tracks.find((t) => t.index === newTrack)
            : undefined;
        if (track?.locked) return c;

        // Only allow dropping onto a track of the same kind
        if (track && track.kind !== c.trackKind) {
          return { ...c, start: Math.max(0, newStart) };
        }

        if (isTextClip(c)) {
          const textTrack = s.tracks.find((t) => t.kind === "text");
          return {
            ...c,
            start: Math.max(0, newStart),
            trackIndex: textTrack?.index ?? c.trackIndex,
            trackKind: "text" as const,
          };
        }

        return {
          ...c,
          start: Math.max(0, newStart),
          trackIndex: track?.index ?? c.trackIndex,
          trackKind: track?.kind ?? c.trackKind,
        };
      }),
      dirty: true,
    }));
  },

  addKeyframe: (prop, time, value) => {
    const id = get().selectedClipId;
    if (!id) return;
    if (get().isClipLocked(id)) {
      set({ status: "Track is locked" });
      return;
    }
    const key = keyframeListKey(prop);
    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== id) return c;
        const list = c.effects[key] || [];
        const existing = list.filter((k) => Math.abs(k.time - time) > 0.001);
        return {
          ...c,
          effects: {
            ...c.effects,
            [key]: [...existing, { time, value }].sort((a, b) => a.time - b.time),
          },
        };
      }),
      status: `Keyframe added · ${prop}`,
      dirty: true,
    }));
  },

  toggleKeyframe: (prop, time, value) => {
    const id = get().selectedClipId;
    if (!id) return;
    if (get().isClipLocked(id)) {
      set({ status: "Track is locked" });
      return;
    }
    const key = keyframeListKey(prop);
    const clip = get().clips.find((c) => c.id === id);
    if (!clip) return;
    const list = [...(clip.effects[key] || [])];
    const removing = list.some((k) => Math.abs(k.time - time) <= 0.05);
    let next = list;
    if (removing) {
      next = list.filter((k) => Math.abs(k.time - time) > 0.05);
    } else {
      next = [...list, { time, value }];
      if (list.length === 0 && time > 0.05) {
        const base =
          prop === "scale"
            ? clip.effects.scale
            : prop === "opacity"
              ? clip.effects.opacity
              : prop === "posX"
                ? clip.effects.posX ?? 0
                : prop === "posY"
                  ? clip.effects.posY ?? 0
                  : clip.effects.rotation;
        next.push({ time: 0, value: base });
      }
      next.sort((a, b) => a.time - b.time);
    }
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id ? { ...c, effects: { ...c.effects, [key]: next } } : c,
      ),
      status: removing ? `Removed ${prop} keyframe` : `Added ${prop} keyframe`,
      dirty: true,
    }));
  },

  timelineDuration: () => {
    const clips = get().clips;
    if (!clips.length) return 10;
    return Math.max(
      1,
      clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0),
    );
  },

  newProject: (name, aspect) => {
    const a = aspect || "16:9";
    const p = ASPECT_PRESETS[a];
    set({
      projectName: name?.trim() || "Untitled Project",
      projectPath: null,
      dirty: true,
      media: [],
      tracks: defaultTracks.map((t) => ({ ...t })),
      clips: [],
      selectedClipId: null,
      playhead: 0,
      isPlaying: false,
      aspect: a,
      projectWidth: p.width,
      projectHeight: p.height,
      fps: 30,
      backgroundBlur: true,
      zoom: 64,
      status: `New project: ${name?.trim() || "Untitled Project"}`,
      processingCount: 0,
      view: "editor",
      libraryTool: "media",
      past: [],
      future: [],
      timelineTabs: [{ id: "tl_1", name: "Timeline 01" }],
      activeTimelineId: "tl_1",
      timelineBundles: {},
      magnetEnabled: true,
    });
  },

  loadSnapshot: (snap) =>
    set({
      projectName: snap.name,
      projectPath: snap.filePath || null,
      dirty: false,
      media: snap.media.map((m) => ({
        ...m,
        readyState: m.readyState || "ready",
        statusMessage: m.statusMessage || "Ready",
        previewPath: m.previewPath || m.path,
      })),
      tracks: normalizeTracks(snap.tracks),
      clips: migrateClipTracks(snap.clips),
      selectedClipId: null,
      playhead: snap.playhead || 0,
      isPlaying: false,
      aspect: snap.aspect,
      projectWidth: snap.projectWidth,
      projectHeight: snap.projectHeight,
      fps: snap.fps,
      backgroundBlur: snap.backgroundBlur,
      zoom: snap.zoom || 64,
      status: `Opened project: ${snap.name}`,
      processingCount: 0,
      view: "editor",
      libraryTool: "media",
      past: [],
      future: [],
      timelineTabs: snap.timelineTabs?.length
        ? snap.timelineTabs
        : [{ id: "tl_1", name: "Timeline 01" }],
      activeTimelineId: snap.activeTimelineId || "tl_1",
      timelineBundles: snap.timelineBundles || {},
      magnetEnabled: true,
    }),

  toSnapshot: () => {
    const s = get();
    const bundles = {
      ...s.timelineBundles,
      [s.activeTimelineId]: {
        clips: s.clips,
        tracks: s.tracks,
        playhead: s.playhead,
        zoom: s.zoom,
      },
    };
    return {
      version: 1 as const,
      name: s.projectName,
      savedAt: new Date().toISOString(),
      filePath: s.projectPath || undefined,
      aspect: s.aspect,
      fps: s.fps,
      backgroundBlur: s.backgroundBlur,
      projectWidth: s.projectWidth,
      projectHeight: s.projectHeight,
      playhead: s.playhead,
      zoom: s.zoom,
      media: s.media,
      clips: s.clips,
      tracks: s.tracks,
      timelineTabs: s.timelineTabs,
      activeTimelineId: s.activeTimelineId,
      timelineBundles: bundles,
    };
  },
}));
