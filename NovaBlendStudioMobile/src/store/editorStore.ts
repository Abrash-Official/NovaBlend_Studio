import { create } from "zustand";
import {
  ASPECT_PRESETS,
  AspectRatioId,
  ClipEffects,
  DEFAULT_EFFECTS,
  DEFAULT_TEXT,
  effectsForLook,
  KeyframeProp,
  keyframeListKey,
  LibraryTool,
  MediaItem,
  ProjectSnapshot,
  TextStyle,
  TimelineClip,
  Track,
  TrackKind,
} from "../types/editor";

export type AppView = "home" | "editor";

type HistorySnap = {
  clips: TimelineClip[];
  tracks: Track[];
  selectedClipId: string | null;
};

type ProjectCard = {
  id: string;
  name: string;
  savedAt: string;
  aspect: AspectRatioId;
  clipCount: number;
  snapshot: ProjectSnapshot;
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultTracks(): Track[] {
  return [
    { id: "t_v1", kind: "video", name: "V1", index: 0 },
    { id: "t_a1", kind: "audio", name: "A1", index: 1 },
    { id: "t_tx1", kind: "text", name: "T1", index: 2 },
    { id: "t_fx1", kind: "fx", name: "F1", index: 3 },
  ];
}

function cloneSnap(s: {
  clips: TimelineClip[];
  tracks: Track[];
  selectedClipId: string | null;
}): HistorySnap {
  return {
    clips: JSON.parse(JSON.stringify(s.clips)),
    tracks: JSON.parse(JSON.stringify(s.tracks)),
    selectedClipId: s.selectedClipId,
  };
}

function trackForKind(tracks: Track[], kind: TrackKind) {
  return tracks.find((t) => t.kind === kind) || tracks[0];
}

interface EditorState {
  view: AppView;
  projectName: string;
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
  libraryTool: LibraryTool;
  magnetEnabled: boolean;
  cropEditing: boolean;
  past: HistorySnap[];
  future: HistorySnap[];
  projects: ProjectCard[];
  updateAvailable: null | { version: string; url: string; notes: string };
  inspectorOpen: boolean;
  libraryOpen: boolean;

  setView: (v: AppView) => void;
  setStatus: (s: string) => void;
  setPlayhead: (t: number) => void;
  setPlaying: (v: boolean) => void;
  setAspect: (a: AspectRatioId) => void;
  setBackgroundBlur: (v: boolean) => void;
  setZoom: (z: number) => void;
  setLibraryTool: (t: LibraryTool) => void;
  setMagnetEnabled: (v: boolean) => void;
  setCropEditing: (v: boolean) => void;
  setInspectorOpen: (v: boolean) => void;
  setLibraryOpen: (v: boolean) => void;
  setProjectName: (name: string) => void;
  selectClip: (id: string | null) => void;
  setUpdateAvailable: (
    v: null | { version: string; url: string; notes: string },
  ) => void;

  addMedia: (item: MediaItem) => void;
  updateMedia: (id: string, patch: Partial<MediaItem>) => void;
  removeMedia: (id: string) => void;
  addClipFromMedia: (mediaId: string, trackIndex?: number) => void;
  addTextClip: (textPatch?: Partial<TextStyle>) => void;
  addFxClip: (effectId: string) => void;
  addStickerClip: (emoji: string) => void;
  updateClip: (id: string, patch: Partial<TimelineClip>) => void;
  updateSelectedEffects: (patch: Partial<ClipEffects>) => void;
  updateSelectedText: (patch: Partial<TextStyle>) => void;
  removeSelectedClip: () => void;
  removeClip: (id: string) => void;
  splitSelectedAtPlayhead: () => void;
  duplicateClip: (id: string) => void;
  moveClip: (id: string, newStart: number, newTrack?: number) => void;
  nudgeClipLayer: (direction: "forward" | "backward") => void;
  toggleKeyframe: (prop: KeyframeProp, time: number, value: number) => void;
  addQuickKeyframe: () => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  timelineDuration: () => number;
  updateTrack: (index: number, patch: Partial<Track>) => void;
  isClipLocked: (clipId: string) => boolean;

  newProject: (name?: string, aspect?: AspectRatioId) => void;
  saveProject: () => void;
  openProject: (id: string) => void;
  deleteProject: (id: string) => void;
  loadProjects: (list: ProjectCard[]) => void;
  toSnapshot: () => ProjectSnapshot;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  view: "home",
  projectName: "Untitled Project",
  dirty: false,
  media: [],
  tracks: defaultTracks(),
  clips: [],
  selectedClipId: null,
  playhead: 0,
  isPlaying: false,
  aspect: "9:16",
  projectWidth: 1080,
  projectHeight: 1920,
  fps: 30,
  backgroundBlur: true,
  zoom: 48,
  status: "Ready",
  libraryTool: "media",
  magnetEnabled: true,
  cropEditing: false,
  past: [],
  future: [],
  projects: [],
  updateAvailable: null,
  inspectorOpen: false,
  libraryOpen: false,

  setView: (v) => set({ view: v }),
  setStatus: (s) => set({ status: s }),
  setPlayhead: (t) => set({ playhead: Math.max(0, t) }),
  setPlaying: (v) => set({ isPlaying: v }),
  setAspect: (a) => {
    const preset = ASPECT_PRESETS[a];
    set({
      aspect: a,
      projectWidth: preset.width,
      projectHeight: preset.height,
      dirty: true,
    });
  },
  setBackgroundBlur: (v) => set({ backgroundBlur: v, dirty: true }),
  setZoom: (z) => set({ zoom: Math.min(160, Math.max(24, z)) }),
  setLibraryTool: (t) => set({ libraryTool: t, libraryOpen: true }),
  setMagnetEnabled: (v) => set({ magnetEnabled: v }),
  setCropEditing: (v) => set({ cropEditing: v }),
  setInspectorOpen: (v) => set({ inspectorOpen: v }),
  setLibraryOpen: (v) => set({ libraryOpen: v }),
  setProjectName: (name) => set({ projectName: name, dirty: true }),
  selectClip: (id) =>
    set({ selectedClipId: id, inspectorOpen: !!id }),
  setUpdateAvailable: (v) => set({ updateAvailable: v }),

  pushHistory: () => {
    const s = get();
    set({
      past: [...s.past.slice(-40), cloneSnap(s)],
      future: [],
    });
  },

  undo: () => {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    set({
      past: s.past.slice(0, -1),
      future: [cloneSnap(s), ...s.future].slice(0, 40),
      clips: prev.clips,
      tracks: prev.tracks,
      selectedClipId: prev.selectedClipId,
      dirty: true,
      status: "Undo",
    });
  },

  redo: () => {
    const s = get();
    const next = s.future[0];
    if (!next) return;
    set({
      future: s.future.slice(1),
      past: [...s.past, cloneSnap(s)].slice(-40),
      clips: next.clips,
      tracks: next.tracks,
      selectedClipId: next.selectedClipId,
      dirty: true,
      status: "Redo",
    });
  },

  addMedia: (item) =>
    set((s) => ({ media: [item, ...s.media], dirty: true })),

  updateMedia: (id, patch) =>
    set((s) => ({
      media: s.media.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  removeMedia: (id) =>
    set((s) => ({
      media: s.media.filter((m) => m.id !== id),
      clips: s.clips.filter((c) => c.mediaId !== id),
      dirty: true,
    })),

  addClipFromMedia: (mediaId, trackIndex) => {
    const s = get();
    const media = s.media.find((m) => m.id === mediaId);
    if (!media) return;
    get().pushHistory();
    const kind: TrackKind = media.hasVideo ? "video" : "audio";
    const track =
      trackIndex != null
        ? s.tracks.find((t) => t.index === trackIndex)
        : trackForKind(s.tracks, kind);
    if (!track) return;
    const same = s.clips.filter((c) => c.trackIndex === track.index);
    const start = same.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    const clip: TimelineClip = {
      id: uid("clip"),
      mediaId: media.id,
      mediaPath: media.path,
      previewPath: media.previewPath || media.path,
      name: media.name,
      trackIndex: track.index,
      trackKind: kind,
      hasAudio: media.hasAudio,
      start,
      duration: Math.max(0.2, media.duration || 3),
      inPoint: 0,
      outPoint: Math.max(0.2, media.duration || 3),
      effects: DEFAULT_EFFECTS(),
    };
    set({
      clips: [...s.clips, clip],
      selectedClipId: clip.id,
      inspectorOpen: true,
      dirty: true,
      status: `Added ${media.name}`,
      view: "editor",
    });
  },

  addTextClip: (textPatch) => {
    const s = get();
    get().pushHistory();
    const track = trackForKind(s.tracks, "text");
    const clip: TimelineClip = {
      id: uid("text"),
      mediaId: "",
      mediaPath: "",
      previewPath: "",
      name: "Text",
      trackIndex: track.index,
      trackKind: "text",
      hasAudio: false,
      start: s.playhead,
      duration: 3,
      inPoint: 0,
      outPoint: 3,
      effects: DEFAULT_EFFECTS(),
      text: { ...DEFAULT_TEXT(), ...textPatch },
    };
    set({
      clips: [...s.clips, clip],
      selectedClipId: clip.id,
      inspectorOpen: true,
      dirty: true,
      status: "Text added",
      libraryOpen: false,
    });
  },

  addFxClip: (effectId) => {
    const s = get();
    get().pushHistory();
    const track = trackForKind(s.tracks, "fx");
    const clip: TimelineClip = {
      id: uid("fx"),
      mediaId: "",
      mediaPath: "",
      previewPath: "",
      name: effectId,
      trackIndex: track.index,
      trackKind: "fx",
      hasAudio: false,
      start: s.playhead,
      duration: 3,
      inPoint: 0,
      outPoint: 3,
      effects: effectsForLook(effectId),
    };
    set({
      clips: [...s.clips, clip],
      selectedClipId: clip.id,
      dirty: true,
      status: `Effect: ${effectId}`,
      libraryOpen: false,
    });
  },

  addStickerClip: (emoji) => {
    get().addTextClip({
      content: emoji,
      fontSize: 120,
      strokeWidth: 0,
      shadowBlur: 0,
    });
  },

  updateClip: (id, patch) =>
    set((s) => ({
      clips: s.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      dirty: true,
    })),

  updateSelectedEffects: (patch) => {
    const s = get();
    const id = s.selectedClipId;
    if (!id) return;
    set({
      clips: s.clips.map((c) =>
        c.id === id ? { ...c, effects: { ...c.effects, ...patch } } : c,
      ),
      dirty: true,
    });
  },

  updateSelectedText: (patch) => {
    const s = get();
    const id = s.selectedClipId;
    if (!id) return;
    set({
      clips: s.clips.map((c) =>
        c.id === id
          ? { ...c, text: { ...(c.text || DEFAULT_TEXT()), ...patch } }
          : c,
      ),
      dirty: true,
    });
  },

  removeSelectedClip: () => {
    const id = get().selectedClipId;
    if (!id) return;
    get().removeClip(id);
  },

  removeClip: (id) => {
    get().pushHistory();
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== id),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
      dirty: true,
      status: "Clip removed",
    }));
  },

  splitSelectedAtPlayhead: () => {
    const s = get();
    const clip = s.clips.find((c) => c.id === s.selectedClipId);
    if (!clip) return;
    const local = s.playhead - clip.start;
    if (local <= 0.05 || local >= clip.duration - 0.05) {
      set({ status: "Move playhead inside the clip to split" });
      return;
    }
    get().pushHistory();
    const leftDur = local;
    const rightDur = clip.duration - local;
    const speed = Math.max(0.05, clip.effects.speed || 1);
    const cutMedia = clip.inPoint + local * speed;
    const left: TimelineClip = { ...clip, duration: leftDur, outPoint: cutMedia };
    const right: TimelineClip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: uid("clip"),
      start: clip.start + leftDur,
      duration: rightDur,
      inPoint: cutMedia,
      outPoint: clip.outPoint,
    };
    set({
      clips: [...s.clips.filter((c) => c.id !== clip.id), left, right],
      selectedClipId: right.id,
      dirty: true,
      status: "Split",
    });
  },

  duplicateClip: (id) => {
    const s = get();
    const clip = s.clips.find((c) => c.id === id);
    if (!clip) return;
    get().pushHistory();
    const copy: TimelineClip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: uid("clip"),
      start: clip.start + clip.duration,
    };
    set({
      clips: [...s.clips, copy],
      selectedClipId: copy.id,
      dirty: true,
      status: "Duplicated",
    });
  },

  moveClip: (id, newStart, newTrack) => {
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id
          ? {
              ...c,
              start: Math.max(0, newStart),
              trackIndex: newTrack ?? c.trackIndex,
            }
          : c,
      ),
      dirty: true,
    }));
  },

  nudgeClipLayer: (direction) => {
    const s = get();
    const clip = s.clips.find((c) => c.id === s.selectedClipId);
    if (!clip || clip.trackKind !== "video") return;
    const videoTracks = s.tracks
      .filter((t) => t.kind === "video")
      .sort((a, b) => a.index - b.index);
    if (videoTracks.length < 2) {
      // Create a second video track for stacking
      get().pushHistory();
      const maxIdx = Math.max(...s.tracks.map((t) => t.index), 0) + 1;
      const neu: Track = {
        id: uid("track"),
        kind: "video",
        name: `V${videoTracks.length + 1}`,
        index: maxIdx,
      };
      const targetIndex = direction === "forward" ? clip.trackIndex : maxIdx;
      const moveTo = direction === "forward" ? maxIdx : clip.trackIndex;
      // forward = visually on top = lower index in CapCut; keep simple: new track above
      set({
        tracks: [...s.tracks, neu],
        clips: s.clips.map((c) =>
          c.id === clip.id
            ? {
                ...c,
                trackIndex: direction === "forward" ? neu.index : neu.index,
              }
            : c,
        ),
        dirty: true,
        status: direction === "forward" ? "Brought forward" : "Sent backward",
      });
      void targetIndex;
      void moveTo;
      return;
    }
    const order = videoTracks.map((t) => t.index);
    const pos = order.indexOf(clip.trackIndex);
    const targetPos =
      direction === "forward"
        ? Math.max(0, pos - 1)
        : Math.min(order.length - 1, pos + 1);
    if (targetPos === pos) return;
    const targetIndex = order[targetPos];
    get().pushHistory();
    set({
      clips: s.clips.map((c) =>
        c.id === clip.id ? { ...c, trackIndex: targetIndex } : c,
      ),
      dirty: true,
      status: direction === "forward" ? "Brought forward" : "Sent backward",
    });
  },

  toggleKeyframe: (prop, time, value) => {
    const s = get();
    const clip = s.clips.find((c) => c.id === s.selectedClipId);
    if (!clip) return;
    get().pushHistory();
    const key = keyframeListKey(prop);
    const list = [...(clip.effects[key] || [])];
    const idx = list.findIndex((k) => Math.abs(k.time - time) < 0.04);
    if (idx >= 0) list.splice(idx, 1);
    else list.push({ time, value });
    list.sort((a, b) => a.time - b.time);
    set({
      clips: s.clips.map((c) =>
        c.id === clip.id
          ? { ...c, effects: { ...c.effects, [key]: list } }
          : c,
      ),
      dirty: true,
    });
  },

  addQuickKeyframe: () => {
    const s = get();
    const clip = s.clips.find((c) => c.id === s.selectedClipId);
    if (!clip) return;
    const t = Math.max(0, s.playhead - clip.start);
    const fx = clip.effects;
    get().toggleKeyframe("scale", t, fx.scale);
    get().toggleKeyframe("posX", t, fx.posX ?? 0);
    get().toggleKeyframe("posY", t, fx.posY ?? 0);
    get().toggleKeyframe("rotation", t, fx.rotation);
    set({ status: "Keyframe" });
  },

  timelineDuration: () => {
    const clips = get().clips;
    if (!clips.length) return 8;
    return Math.max(
      1,
      clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0),
    );
  },

  updateTrack: (index, patch) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.index === index ? { ...t, ...patch } : t)),
      dirty: true,
    })),

  isClipLocked: (clipId) => {
    const s = get();
    const clip = s.clips.find((c) => c.id === clipId);
    if (!clip) return false;
    return !!s.tracks.find((t) => t.index === clip.trackIndex)?.locked;
  },

  newProject: (name, aspect) => {
    const a = aspect || "9:16";
    const preset = ASPECT_PRESETS[a];
    set({
      view: "editor",
      projectName: name || "Untitled Project",
      dirty: false,
      media: [],
      tracks: defaultTracks(),
      clips: [],
      selectedClipId: null,
      playhead: 0,
      isPlaying: false,
      aspect: a,
      projectWidth: preset.width,
      projectHeight: preset.height,
      backgroundBlur: true,
      past: [],
      future: [],
      status: "New project",
      libraryOpen: true,
      inspectorOpen: false,
    });
  },

  toSnapshot: () => {
    const s = get();
    return {
      version: 1 as const,
      name: s.projectName,
      savedAt: new Date().toISOString(),
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
    };
  },

  saveProject: () => {
    const snap = get().toSnapshot();
    const id = uid("proj");
    const card: ProjectCard = {
      id,
      name: snap.name,
      savedAt: snap.savedAt,
      aspect: snap.aspect,
      clipCount: snap.clips.length,
      snapshot: snap,
    };
    set((s) => {
      const existing = s.projects.findIndex(
        (p) => p.name === snap.name && p.snapshot.savedAt,
      );
      // Replace latest with same name if present
      const sameName = s.projects.find((p) => p.name === snap.name);
      let projects: ProjectCard[];
      if (sameName) {
        projects = s.projects.map((p) =>
          p.id === sameName.id
            ? { ...card, id: sameName.id }
            : p,
        );
      } else {
        projects = [card, ...s.projects];
      }
      void existing;
      return {
        projects,
        dirty: false,
        status: "Project saved on device",
      };
    });
  },

  openProject: (id) => {
    const card = get().projects.find((p) => p.id === id);
    if (!card) return;
    const snap = card.snapshot;
    set({
      view: "editor",
      projectName: snap.name,
      dirty: false,
      media: snap.media || [],
      tracks: snap.tracks?.length ? snap.tracks : defaultTracks(),
      clips: snap.clips || [],
      selectedClipId: null,
      playhead: snap.playhead || 0,
      isPlaying: false,
      aspect: snap.aspect || "9:16",
      projectWidth: snap.projectWidth || 1080,
      projectHeight: snap.projectHeight || 1920,
      fps: snap.fps || 30,
      backgroundBlur: snap.backgroundBlur ?? true,
      zoom: snap.zoom || 48,
      past: [],
      future: [],
      status: `Opened ${snap.name}`,
    });
  },

  deleteProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      status: "Project deleted",
    })),

  loadProjects: (list) => set({ projects: list }),
}));
