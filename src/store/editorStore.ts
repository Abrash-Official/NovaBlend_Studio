import { create } from "zustand";
import {
  ASPECT_PRESETS,
  AspectRatioId,
  ClipEffects,
  DEFAULT_EFFECTS,
  DEFAULT_TEXT,
  isTextClip,
  MediaItem,
  ProjectSnapshot,
  TextStyle,
  TimelineClip,
  Track,
} from "../types/editor";

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const defaultTracks: Track[] = [
  { id: "v1", kind: "video", name: "V1", index: 0 },
  { id: "v2", kind: "video", name: "V2 Overlay", index: 1 },
  { id: "t1", kind: "text", name: "T1 Text", index: 2 },
  { id: "a1", kind: "audio", name: "A1", index: 3 },
];

function normalizeClip(c: TimelineClip): TimelineClip {
  if (!isTextClip(c) && c.trackKind !== "text") return c;
  return {
    ...c,
    trackKind: "text",
    hasAudio: false,
    mediaId: c.mediaId || "",
    mediaPath: c.mediaPath || "",
    previewPath: c.previewPath || "",
    text: { ...DEFAULT_TEXT(), ...(c.text || {}) },
  };
}

interface EditorState {
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
  addTextClip: () => void;
  updateClip: (id: string, patch: Partial<TimelineClip>) => void;
  updateSelectedEffects: (patch: Partial<ClipEffects>) => void;
  updateSelectedText: (patch: Partial<TextStyle>) => void;
  removeSelectedClip: () => void;
  splitSelectedAtPlayhead: () => void;
  trimSelected: (edge: "in" | "out", delta: number) => void;
  trimClip: (
    id: string,
    edge: "in" | "out",
    timelineDelta: number,
  ) => void;
  moveClip: (id: string, newStart: number, newTrack?: number) => void;
  addKeyframe: (prop: "scale" | "opacity", time: number, value: number) => void;
  timelineDuration: () => number;

  newProject: (name?: string) => void;
  loadSnapshot: (snap: ProjectSnapshot) => void;
  toSnapshot: () => ProjectSnapshot;
  bumpProcessing: (delta: number) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
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
        : tracks.find((t) => t.kind === "audio")?.index ?? 3);
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

  addTextClip: () => {
    const tracks = get().tracks;
    const track = tracks.find((t) => t.kind === "text") ?? {
      id: "t1",
      kind: "text" as const,
      name: "T1 Text",
      index: 2,
    };
    const playhead = get().playhead;
    const duration = 5;
    const text = DEFAULT_TEXT();
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

  updateClip: (id, patch) =>
    set((s) => ({
      clips: s.clips.map((c) => {
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
    })),

  updateSelectedEffects: (patch) => {
    const id = get().selectedClipId;
    if (!id) return;
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id ? { ...c, effects: { ...c.effects, ...patch } } : c,
      ),
      dirty: true,
    }));
  },

  updateSelectedText: (patch) => {
    const id = get().selectedClipId;
    if (!id) return;
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
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== id),
      selectedClipId: null,
      status: "Clip removed",
      dirty: true,
    }));
  },

  splitSelectedAtPlayhead: () => {
    const { selectedClipId, playhead, clips } = get();
    if (!selectedClipId) return;
    const clip = clips.find((c) => c.id === selectedClipId);
    if (!clip) return;
    if (playhead <= clip.start || playhead >= clip.start + clip.duration) {
      set({ status: "Playhead must be inside the selected clip to split" });
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
    };
    const right: TimelineClip = {
      ...clip,
      id: uid("clip"),
      start: playhead,
      inPoint: splitSrc,
      duration: (clip.outPoint - splitSrc) / speed,
    };
    set((s) => ({
      clips: [...s.clips.filter((c) => c.id !== clip.id), left, right],
      selectedClipId: right.id,
      status: "Clip split",
      dirty: true,
    }));
  },

  trimSelected: (edge, delta) => {
    const id = get().selectedClipId;
    if (!id) return;
    get().trimClip(id, edge, delta);
  },

  trimClip: (id, edge, timelineDelta) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip) return;
    const media = get().media.find((m) => m.id === clip.mediaId);
    const mediaDur = isTextClip(clip)
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
        const track =
          newTrack !== undefined
            ? s.tracks.find((t) => t.index === newTrack)
            : undefined;
        // Text clips stay on the text track kind
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
          trackIndex: newTrack ?? c.trackIndex,
          trackKind: track?.kind === "text" ? c.trackKind : (track?.kind ?? c.trackKind),
        };
      }),
      dirty: true,
    }));
  },

  addKeyframe: (prop, time, value) => {
    const id = get().selectedClipId;
    if (!id) return;
    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== id) return c;
        const key = prop === "scale" ? "scaleKeyframes" : "opacityKeyframes";
        const existing = c.effects[key].filter(
          (k) => Math.abs(k.time - time) > 0.001,
        );
        return {
          ...c,
          effects: {
            ...c.effects,
            [key]: [...existing, { time, value }].sort((a, b) => a.time - b.time),
          },
        };
      }),
      status: `Keyframe added for ${prop}`,
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

  newProject: (name) =>
    set({
      projectName: name?.trim() || "Untitled Project",
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
      status: `New project: ${name?.trim() || "Untitled Project"}`,
      processingCount: 0,
    }),

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
      tracks: defaultTracks,
      clips: snap.clips.map(normalizeClip).map((c) => {
        if (!isTextClip(c)) return c;
        const textTrack = defaultTracks.find((t) => t.kind === "text")!;
        return { ...c, trackIndex: textTrack.index, trackKind: "text" as const };
      }),
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
    }),

  toSnapshot: () => {
    const s = get();
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
    };
  },
}));
