import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createFreezeClip } from "../lib/api";
import {
  ASPECT_PRESETS,
  AspectRatioId,
  isFxClip,
  isStillClip,
  isTextClip,
  TimelineClip,
  TrackKind,
} from "../types/editor";
import { useEditorStore } from "../store/editorStore";
import { snapClipStart, snapPlayhead } from "../lib/snap";
import { ClipWaveform } from "./ClipWaveform";
import { ClipFilmstrip } from "./ClipFilmstrip";
import {
  IconAdd,
  IconCopy,
  IconCrop,
  IconEye,
  IconEyeOff,
  IconFreeze,
  IconFullscreen,
  IconKeyframe,
  IconLock,
  IconMagnet,
  IconMute,
  IconRedo,
  IconRemoveBg,
  IconReverse,
  IconSplit,
  IconTrash,
  IconUndo,
  IconUnlock,
  IconVolume,
} from "./Icons";

function formatClipTc(seconds: number, fps = 30) {
  const s = Math.max(0, seconds);
  const totalFrames = Math.round(s * fps);
  const ff = totalFrames % fps;
  const totalSec = Math.floor(totalFrames / fps);
  const ss = totalSec % 60;
  const mm = Math.floor(totalSec / 60) % 60;
  const hh = Math.floor(totalSec / 3600);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  if (hh > 0) return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
  return `${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

/** Extra space above each clip for CapCut-style name + duration meta. */
const CLIP_META_H = 16;

function clampMenuPos(x: number, y: number, w: number, h: number) {
  const pad = 10;
  return {
    x: Math.min(Math.max(pad, x), Math.max(pad, window.innerWidth - w - pad)),
    y: Math.min(Math.max(pad, y), Math.max(pad, window.innerHeight - h - pad)),
  };
}

type DragMode = "move" | "trim-in" | "trim-out";

type DragState = {
  mode: DragMode;
  id: string;
  originX: number;
  originStart: number;
  originIn: number;
  originOut: number;
  originDuration: number;
};

type CtxMenu = {
  x: number;
  y: number;
  clipId: string;
};

const LANE_GAP = 3;
const LANE_PAD = 5;
const TRACK_HEADER_W = 100;

/** CapCut-like: text thin, video tall (film + wave), audio mid with dense wave. */
function clipHeightForKind(kind: TrackKind): number {
  switch (kind) {
    case "text":
      return 20;
    case "fx":
      return 26;
    case "audio":
      return 44;
    case "video":
    default:
      return 64;
  }
}

function collectKeyframeTimes(clip: TimelineClip): number[] {
  const fx = clip.effects;
  if (!fx) return [];
  const lists = [
    fx.scaleKeyframes,
    fx.opacityKeyframes,
    fx.posXKeyframes,
    fx.posYKeyframes,
    fx.rotationKeyframes,
  ];
  const times = new Set<number>();
  for (const list of lists) {
    for (const k of list || []) times.add(k.time);
  }
  return [...times].sort((a, b) => a - b);
}

/** Pack overlapping clips into visual lanes (overlap allowed, stacked for readability). */
function assignLanes(trackClips: TimelineClip[]): { lanes: Map<string, number>; laneCount: number } {
  const sorted = [...trackClips].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.duration - a.duration;
  });
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();

  for (const clip of sorted) {
    const end = clip.start + clip.duration;
    let lane = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] <= clip.start + 0.001) {
        lane = i;
        break;
      }
    }
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    lanes.set(clip.id, lane);
  }

  return { lanes, laneCount: Math.max(1, laneEnds.length) };
}

function laneTint(base: string, lane: number): string {
  // Slight brightness shift per stacked lane so overlaps are easy to tell apart
  const shifts = [0, 18, -14, 28, -22];
  const shift = shifts[lane % shifts.length];
  if (!shift) return base;
  // base is a CSS var — use overlay instead via opacity in style when needed
  return base;
}

export function Timeline() {
  const {
    tracks,
    clips,
    selectedClipId,
    selectClip,
    playhead,
    setPlayhead,
    zoom,
    setZoom,
    moveClip,
    insertTrackRelative,
    pruneEmptyTracks,
    updateClip,
    timelineDuration,
    setPlaying,
    setStatus,
    splitClipAtPlayhead,
    duplicateClip,
    toggleClipReverse,
    removeClip,
    insertFreezeMediaClip,
    fps,
    bumpProcessing,
    updateTrack,
    media,
    magnetEnabled,
    setMagnetEnabled,
    pushHistory,
    undo,
    redo,
    past,
    future,
    timelineTabs,
    activeTimelineId,
    addTimeline,
    switchTimeline,
    removeSelectedClip,
    applyCropMask,
    toggleRemoveBg,
    addQuickKeyframe,
    splitSelectedAtPlayhead,
    removeKeyframesAtTime,
    aspect,
    setAspect,
  } = useEditorStore();

  const duration = timelineDuration();
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const layerBoostRef = useRef<{ above?: number; below?: number }>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [menu, setMenu] = useState<CtxMenu | null>(null);
  const [freezing, setFreezing] = useState(false);
  const [dropTrackIndex, setDropTrackIndex] = useState<number | null>(null);

  const widthPx = useMemo(() => Math.max(800, duration * zoom), [duration, zoom]);

  /** CapCut-like stack: text/FX above video, audio below. Always show V/A for layering. */
  const trackLayouts = useMemo(() => {
    const kindOrder = { text: 0, fx: 1, video: 2, audio: 3 } as const;
    const visible = tracks
      .filter((track) => {
        const hasClips = clips.some((c) => c.trackIndex === track.index);
        if (track.kind === "video" || track.kind === "audio") return true;
        return hasClips;
      })
      .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.index - b.index);

    return visible.map((track) => {
      const trackClips = clips.filter((c) => c.trackIndex === track.index);
      const { lanes, laneCount } = assignLanes(trackClips);
      const lanesUsed = Math.max(1, laneCount);
      const clipH = clipHeightForKind(track.kind);
      const meta = track.kind === "text" ? 0 : CLIP_META_H;
      const laneH = clipH + meta + LANE_GAP;
      const height =
        LANE_PAD * 2 + lanesUsed * (clipH + meta) + (lanesUsed - 1) * LANE_GAP;
      return {
        track,
        trackClips,
        lanes,
        laneCount: lanesUsed,
        clipH,
        metaH: meta,
        laneH,
        height: Math.max(LANE_PAD * 2 + clipH + meta, height),
      };
    });
  }, [tracks, clips]);

  const tracksBodyHeight = useMemo(
    () => trackLayouts.reduce((sum, t) => sum + t.height, 0),
    [trackLayouts],
  );

  function trackIndexAtClientY(clientY: number): number | null {
    for (const [index, el] of trackRowRefs.current) {
      const r = el.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) return index;
    }
    return null;
  }

  function timeFromClientX(clientX: number) {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft - TRACK_HEADER_W;
    return Math.max(0, Math.min(duration, x / zoom));
  }

  function scrubPlayheadToClientX(clientX: number) {
    const state = useEditorStore.getState();
    let t = timeFromClientX(clientX);
    if (state.magnetEnabled) {
      const threshold = Math.max(0.05, 10 / zoom);
      t = snapPlayhead({
        time: t,
        clips: state.clips,
        duration,
        threshold,
      });
    }
    setPlaying(false);
    setPlayhead(t);
  }

  function beginPlayheadScrub(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenu(null);
    setScrubbing(true);
    scrubPlayheadToClientX(e.clientX);
  }

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: MouseEvent) => {
      scrubPlayheadToClientX(e.clientX);
    };
    const onUp = () => setScrubbing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [scrubbing, zoom, duration, setPlayhead, setPlaying]);

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - drag.originX;
      const dTime = dx / zoom;
      const state = useEditorStore.getState();
      const clip = state.clips.find((c) => c.id === drag.id);
      if (!clip) return;
      const speed = Math.max(0.05, clip.effects.speed || 1);
      const media = state.media.find((m) => m.id === clip.mediaId);
      const mediaDur =
        isTextClip(clip) || isStillClip(clip) || isFxClip(clip)
          ? Math.max(drag.originOut + 120, 600)
          : (media?.duration ?? Math.max(drag.originOut, 0.05));
      const minLen = 0.05;

      if (drag.mode === "move") {
        const kind = clip.trackKind;
        const sameKind = state.tracks
          .filter((t) => t.kind === kind)
          .sort((a, b) => a.index - b.index);
        let dropIndex: number | undefined;

        const over = trackIndexAtClientY(e.clientY);
        if (over !== null) {
          const target = state.tracks.find((t) => t.index === over);
          if (target?.kind === kind && !target.locked) {
            dropIndex = target.index;
            // Near top/bottom edge of the row → CapCut-style new layer
            const row = trackRowRefs.current.get(over);
            if (row && sameKind.length) {
              const r = row.getBoundingClientRect();
              const edge = 14;
              if (e.clientY < r.top + edge && over === sameKind[0].index) {
                if (layerBoostRef.current.above == null) {
                  layerBoostRef.current.above = insertTrackRelative(
                    kind,
                    over,
                    "above",
                  );
                }
                dropIndex = layerBoostRef.current.above;
              } else if (
                e.clientY > r.bottom - edge &&
                over === sameKind[sameKind.length - 1].index
              ) {
                if (layerBoostRef.current.below == null) {
                  layerBoostRef.current.below = insertTrackRelative(
                    kind,
                    over,
                    "below",
                  );
                }
                dropIndex = layerBoostRef.current.below;
              }
            }
          }
        } else if (sameKind.length) {
          const firstEl = trackRowRefs.current.get(sameKind[0].index);
          const lastEl = trackRowRefs.current.get(
            sameKind[sameKind.length - 1].index,
          );
          const firstR = firstEl?.getBoundingClientRect();
          const lastR = lastEl?.getBoundingClientRect();
          if (firstR && e.clientY < firstR.top) {
            if (layerBoostRef.current.above == null) {
              layerBoostRef.current.above = insertTrackRelative(
                kind,
                sameKind[0].index,
                "above",
              );
            }
            dropIndex = layerBoostRef.current.above;
          } else if (lastR && e.clientY > lastR.bottom) {
            if (layerBoostRef.current.below == null) {
              layerBoostRef.current.below = insertTrackRelative(
                kind,
                sameKind[sameKind.length - 1].index,
                "below",
              );
            }
            dropIndex = layerBoostRef.current.below;
          }
        }

        setDropTrackIndex(dropIndex ?? over);
        let nextStart = Math.max(0, drag.originStart + dTime);
        if (state.magnetEnabled) {
          const threshold = Math.max(0.05, 10 / zoom);
          nextStart = snapClipStart({
            start: nextStart,
            duration: clip.duration,
            clipId: clip.id,
            clips: state.clips,
            playhead: state.playhead,
            threshold,
          });
        }
        moveClip(drag.id, nextStart, dropIndex);
        return;
      }

      if (drag.mode === "trim-in") {
        const nextIn = Math.min(
          drag.originOut - minLen,
          Math.max(0, drag.originIn + dTime * speed),
        );
        const shifted = (nextIn - drag.originIn) / speed;
        updateClip(drag.id, {
          inPoint: nextIn,
          outPoint: drag.originOut,
          start: Math.max(0, drag.originStart + shifted),
          duration: (drag.originOut - nextIn) / speed,
        });
        return;
      }

      const nextOut = Math.min(
        mediaDur,
        Math.max(drag.originIn + minLen, drag.originOut + dTime * speed),
      );
      updateClip(drag.id, {
        inPoint: drag.originIn,
        outPoint: nextOut,
        start: drag.originStart,
        duration: (nextOut - drag.originIn) / speed,
      });
    };

    const onUp = () => {
      setDrag(null);
      setDropTrackIndex(null);
      layerBoostRef.current = {};
      pruneEmptyTracks();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, zoom, moveClip, insertTrackRelative, pruneEmptyTracks, updateClip]);

  // Clean leftover empty layers from earlier sessions
  useEffect(() => {
    pruneEmptyTracks();
  }, [pruneEmptyTracks]);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const next = clampMenuPos(menu.x, menu.y, rect.width, rect.height);
    if (next.x !== menu.x || next.y !== menu.y) {
      setMenu({ ...menu, x: next.x, y: next.y });
    }
  }, [menu]);

  function beginDrag(
    e: React.MouseEvent,
    clipId: string,
    mode: DragMode,
    clip: {
      start: number;
      inPoint: number;
      outPoint: number;
      duration: number;
      trackIndex: number;
    },
  ) {
    e.preventDefault();
    e.stopPropagation();
    const locked = useEditorStore
      .getState()
      .tracks.find((t) => t.index === clip.trackIndex)?.locked;
    if (locked) {
      setStatus("Track is locked");
      selectClip(clipId);
      return;
    }
    setMenu(null);
    setPlaying(false);
    selectClip(clipId);
    pushHistory();
    layerBoostRef.current = {};
    setDrag({
      mode,
      id: clipId,
      originX: e.clientX,
      originStart: clip.start,
      originIn: clip.inPoint,
      originOut: clip.outPoint,
      originDuration: clip.duration,
    });
  }

  function openClipMenu(e: React.MouseEvent, clipId: string) {
    e.preventDefault();
    e.stopPropagation();
    setPlaying(false);
    selectClip(clipId);
    // Rough size first; refined after mount so Delete stays on-screen
    const pos = clampMenuPos(e.clientX, e.clientY, 210, 240);
    setMenu({ x: pos.x, y: pos.y, clipId });
  }

  async function onFreeze(clipId: string) {
    const state = useEditorStore.getState();
    const clip = state.clips.find((c) => c.id === clipId);
    if (!clip || isTextClip(clip)) {
      setStatus("Freeze works on video clips");
      return;
    }
    if (
      state.playhead <= clip.start ||
      state.playhead >= clip.start + clip.duration
    ) {
      setStatus("Move playhead onto the clip to freeze");
      return;
    }
    const speed = Math.max(0.05, clip.effects.speed || 1);
    const sourceTime =
      clip.inPoint + (state.playhead - clip.start) * speed;
    const src = clip.previewPath || clip.mediaPath;
    if (!src) {
      setStatus("No media path for freeze");
      return;
    }
    setFreezing(true);
    bumpProcessing(1);
    setStatus("Creating freeze frame…");
    try {
      const freeze = await createFreezeClip({
        path: src,
        time: sourceTime,
        duration: 2,
        fps: state.fps || fps,
      });
      const mediaId = `media_${Math.random().toString(36).slice(2, 10)}`;
      insertFreezeMediaClip({
        afterClipId: clipId,
        freezeDuration: 2,
        sourceTime,
        media: {
          id: mediaId,
          name: `Freeze ${sourceTime.toFixed(2)}s`,
          path: freeze.videoPath,
          previewPath: freeze.videoPath,
          stillPath: freeze.stillPath,
          duration: 600,
          width: state.projectWidth,
          height: state.projectHeight,
          hasVideo: true,
          hasAudio: false,
          codec: "h264",
          fps: state.fps || 30,
          readyState: "ready",
          statusMessage: "Ready · still (drag to stretch)",
        },
      });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      bumpProcessing(-1);
      setFreezing(false);
    }
  }

  const menuClip = menu
    ? clips.find((c) => c.id === menu.clipId)
    : undefined;

  return (
    <section className="panel mx-2 mb-1 flex h-full min-h-0 flex-col overflow-hidden">
      <div className="tl-toolbar shrink-0 border-b border-[var(--line)] px-2 py-1">
        <div className="tl-tabs">
          <button
            type="button"
            className="tl-tool"
            title="New timeline in this project"
            onClick={() => addTimeline()}
          >
            <IconAdd size={14} />
          </button>
          {timelineTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tl-tab ${tab.id === activeTimelineId ? "active" : ""}`}
              onClick={() => switchTimeline(tab.id)}
            >
              {tab.name}
            </button>
          ))}
        </div>
        <div className="tl-tools">
          <button
            type="button"
            className="tl-tool"
            title="Undo (Ctrl+Z)"
            disabled={!past.length}
            onClick={() => undo()}
          >
            <IconUndo size={14} />
          </button>
          <button
            type="button"
            className="tl-tool"
            title="Redo (Ctrl+Y)"
            disabled={!future.length}
            onClick={() => redo()}
          >
            <IconRedo size={14} />
          </button>
          <span className="tl-sep" />
          <button
            type="button"
            className="tl-tool"
            title="Split at playhead (S)"
            onClick={() => splitSelectedAtPlayhead()}
          >
            <IconSplit size={14} />
          </button>
          <button
            type="button"
            className="tl-tool danger"
            title="Delete selected (Del)"
            onClick={() => removeSelectedClip()}
          >
            <IconTrash size={14} />
          </button>
          <button
            type="button"
            className="tl-tool"
            title="Crop mask"
            onClick={() => applyCropMask()}
          >
            <IconCrop size={14} />
          </button>
          <button
            type="button"
            className="tl-tool"
            title="Remove background"
            onClick={() => toggleRemoveBg()}
          >
            <IconRemoveBg size={14} />
          </button>
          <button
            type="button"
            className="tl-tool"
            title="Keyframe at playhead"
            onClick={() => addQuickKeyframe()}
          >
            <IconKeyframe size={14} />
          </button>
          <span className="tl-sep" />
          <button
            type="button"
            className="tl-tool"
            title="Preview fullscreen"
            onClick={() => {
              const el = document.querySelector(".preview-stage");
              if (el && "requestFullscreen" in el) {
                void (el as HTMLElement).requestFullscreen().catch(() => {
                  setStatus("Fullscreen not available");
                });
              }
            }}
          >
            <IconFullscreen size={14} />
          </button>
          <button
            type="button"
            className={`tl-tool ${magnetEnabled ? "on" : ""}`}
            title="Auto magnet / snap (P)"
            onClick={() => setMagnetEnabled(!magnetEnabled)}
          >
            <IconMagnet size={14} />
          </button>
          <label className="ml-2 flex items-center gap-1 text-[11px] text-[var(--muted)]">
            Ratio
            <select
              className="toolbar-select"
              value={aspect}
              onChange={(e) => setAspect(e.target.value as AspectRatioId)}
              title="Project aspect ratio"
            >
              {(Object.keys(ASPECT_PRESETS) as AspectRatioId[]).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="ml-2 flex items-center gap-2 text-xs text-[var(--muted)]">
            Zoom
            <input
              className="slider w-28"
              type="range"
              min={24}
              max={160}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-auto"
      >
        <div style={{ width: widthPx + TRACK_HEADER_W, minHeight: 24 + tracksBodyHeight }}>
          <div className="sticky top-0 z-20 flex h-6 border-b border-[var(--line)] bg-[var(--bg-2)]">
            <div className="shrink-0 border-r border-[var(--line)]" style={{ width: TRACK_HEADER_W }} />
            <div
              className="relative flex-1 cursor-ew-resize"
              data-ruler="1"
              style={{ width: widthPx }}
              onMouseDown={beginPlayheadScrub}
            >
              {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="pointer-events-none absolute top-0 h-full border-l border-[var(--line)] text-[10px] text-[var(--muted)]"
                  style={{ left: i * zoom }}
                >
                  <span className="ml-1">{i}s</span>
                </div>
              ))}
            </div>
          </div>

          {trackLayouts.map(({ track, trackClips, lanes, laneCount, height, clipH, metaH, laneH }) => (
            <div
              key={track.id}
              ref={(el) => {
                if (el) trackRowRefs.current.set(track.index, el);
                else trackRowRefs.current.delete(track.index);
              }}
              className="flex shrink-0 overflow-hidden border-b border-[var(--line)]"
              style={{
                height,
                minHeight: height,
                maxHeight: height,
                background:
                  dropTrackIndex === track.index && drag?.mode === "move"
                    ? "rgba(78, 161, 255, 0.08)"
                    : undefined,
              }}
            >
              <div className="track-header flex w-[100px] shrink-0 flex-col justify-center gap-1 overflow-hidden border-r border-[var(--line)] bg-[var(--bg-2)] px-1.5 text-xs text-[var(--muted)]">
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1 truncate font-medium text-[var(--text)]">
                    {track.name}
                  </div>
                  {laneCount > 1 && (
                    <span className="shrink-0 text-[9px] text-[var(--warn)]">{laneCount}</span>
                  )}
                </div>
                <div className="track-controls">
                  <button
                    type="button"
                    className={`track-ctrl ${track.locked ? "on" : ""}`}
                    title={track.locked ? "Unlock track" : "Lock track"}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTrack(track.index, { locked: !track.locked });
                    }}
                  >
                    {track.locked ? <IconLock size={12} /> : <IconUnlock size={12} />}
                  </button>
                  <button
                    type="button"
                    className={`track-ctrl ${track.hidden ? "on danger" : ""}`}
                    title={track.hidden ? "Show track" : "Hide track"}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTrack(track.index, { hidden: !track.hidden });
                    }}
                  >
                    {track.hidden ? <IconEyeOff size={12} /> : <IconEye size={12} />}
                  </button>
                  {(track.kind === "video" || track.kind === "audio") && (
                    <button
                      type="button"
                      className={`track-ctrl ${track.muted ? "on danger" : ""}`}
                      title={track.muted ? "Unmute track" : "Mute track"}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTrack(track.index, { muted: !track.muted });
                      }}
                    >
                      {track.muted ? <IconMute size={12} /> : <IconVolume size={12} />}
                    </button>
                  )}
                </div>
              </div>
              <div
                className="relative overflow-hidden"
                style={{ width: widthPx, height, minHeight: height }}
              >
                {laneCount > 1 &&
                  Array.from({ length: laneCount - 1 }).map((_, i) => (
                    <div
                      key={`guide-${i}`}
                      className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-[var(--line)]/70"
                      style={{ top: LANE_PAD + (i + 1) * laneH - LANE_GAP / 2 }}
                    />
                  ))}

                {trackClips.map((clip) => {
                  const lane = lanes.get(clip.id) ?? 0;
                  const left = clip.start * zoom;
                  const width = Math.max(16, clip.duration * zoom);
                  const top = LANE_PAD + lane * laneH;
                  const selected = clip.id === selectedClipId;
                  const color =
                    clip.trackKind === "audio"
                      ? "var(--clip-a)"
                      : isFxClip(clip)
                        ? "var(--clip-fx)"
                        : isTextClip(clip)
                          ? "var(--clip-t)"
                          : "var(--clip-v)";
                  const handleW = 7;
                  const brightness = 1 + (lane % 3) * 0.08;
                  const mediaItem = media.find((m) => m.id === clip.mediaId);
                  const wavePath =
                    clip.previewPath ||
                    clip.mediaPath ||
                    mediaItem?.previewPath ||
                    mediaItem?.path ||
                    "";
                  const filmPath =
                    clip.trackKind === "video" && !isStillClip(clip)
                      ? clip.previewPath ||
                        clip.mediaPath ||
                        mediaItem?.previewPath ||
                        mediaItem?.path ||
                        ""
                      : "";
                  const mediaDur = Math.max(
                    0.05,
                    mediaItem?.duration || clip.outPoint || clip.duration,
                  );
                  const showWave =
                    !!wavePath &&
                    !!clip.hasAudio &&
                    (clip.trackKind === "audio" ||
                      (clip.trackKind === "video" && !isStillClip(clip)));
                  const thumb = mediaItem?.thumbPath
                    ? convertFileSrc(mediaItem.thumbPath)
                    : undefined;
                  const kfTimes = collectKeyframeTimes(clip);
                  const innerW = Math.max(0, width - handleW * 2);
                  const filmH = showWave
                    ? Math.max(22, Math.floor(clipH * 0.62))
                    : clipH;
                  const fadeInSec =
                    clip.trackKind === "audio" || clip.hasAudio
                      ? clip.effects.audioFadeIn || 0
                      : clip.effects.fadeIn || 0;
                  const fadeOutSec =
                    clip.trackKind === "audio" || clip.hasAudio
                      ? clip.effects.audioFadeOut || 0
                      : clip.effects.fadeOut || 0;
                  const fadeInPx = Math.min(
                    innerW * 0.48,
                    Math.max(0, fadeInSec) * zoom,
                  );
                  const fadeOutPx = Math.min(
                    innerW * 0.48,
                    Math.max(0, fadeOutSec) * zoom,
                  );

                  return (
                    <div
                      key={clip.id}
                      className="absolute select-none"
                      style={{
                        left,
                        width,
                        top,
                        height: clipH + metaH,
                        zIndex: selected || drag?.id === clip.id ? 8 : 1 + lane,
                        opacity: track.hidden ? 0.35 : track.muted ? 0.7 : 1,
                      }}
                    >
                      {metaH > 0 && (
                        <div className="tl-clip-meta" title={clip.name}>
                          <span className="tl-clip-meta-name">{clip.name}</span>
                          <span className="tl-clip-meta-dur">
                            {formatClipTc(clip.duration, fps)}
                          </span>
                        </div>
                      )}
                      <div
                        className={`absolute overflow-hidden text-white tl-clip tl-clip-${clip.trackKind}`}
                        style={{
                          left: 0,
                          right: 0,
                          top: metaH,
                          height: clipH,
                          borderRadius: clip.trackKind === "text" ? 3 : 5,
                          background: laneTint(color, lane),
                          filter: `brightness(${brightness})`,
                          boxShadow: selected
                            ? "inset 0 0 0 1.5px rgba(255,255,255,0.85)"
                            : "inset 0 0 0 1px rgba(255,255,255,0.12)",
                          cursor: track.locked ? "not-allowed" : undefined,
                        }}
                        title={`${clip.name} · ${formatClipTc(clip.duration, fps)}${track.locked ? " · locked" : " · drag up/down to change layer"}`}
                        onClick={() => selectClip(clip.id)}
                        onContextMenu={(e) => {
                          if (track.locked) {
                            e.preventDefault();
                            setStatus("Track is locked");
                            selectClip(clip.id);
                            return;
                          }
                          openClipMenu(e, clip.id);
                        }}
                      >
                        <div
                          className="clip-trim clip-trim-left"
                          onMouseDown={(e) =>
                            beginDrag(e, clip.id, "trim-in", clip)
                          }
                          onContextMenu={(e) => openClipMenu(e, clip.id)}
                          title="Trim start"
                        />

                        <div
                          className="absolute bottom-0 top-0 cursor-grab overflow-hidden active:cursor-grabbing"
                          style={{ left: handleW, right: handleW }}
                          onMouseDown={(e) =>
                            beginDrag(e, clip.id, "move", clip)
                          }
                          onContextMenu={(e) => openClipMenu(e, clip.id)}
                        >
                          {clip.trackKind === "video" && filmPath && (
                            <ClipFilmstrip
                              path={filmPath}
                              width={innerW}
                              height={filmH}
                              inPoint={clip.inPoint}
                              outPoint={clip.outPoint}
                              fallbackThumb={thumb}
                            />
                          )}

                          {clip.trackKind === "video" &&
                            !filmPath &&
                            thumb && (
                              <div
                                className="tl-filmstrip-fallback"
                                style={{ backgroundImage: `url(${thumb})` }}
                              />
                            )}

                          {showWave && clip.trackKind === "video" && (
                            <div className="tl-wave-overlay">
                              <ClipWaveform
                                path={wavePath}
                                width={innerW}
                                height={Math.max(
                                  14,
                                  Math.floor(clipH * 0.38),
                                )}
                                mode="overlay"
                                color="rgba(255,255,255,0.88)"
                                inPoint={clip.inPoint}
                                outPoint={clip.outPoint}
                                mediaDuration={mediaDur}
                                amplitude={clip.effects.volume ?? 1}
                              />
                            </div>
                          )}

                          {showWave && clip.trackKind === "audio" && (
                            <div className="tl-wave-fill">
                              <ClipWaveform
                                path={wavePath}
                                width={innerW}
                                height={clipH}
                                mode="fill"
                                color="rgba(90, 168, 255, 0.95)"
                                peakColor="rgba(255, 138, 64, 0.95)"
                                inPoint={clip.inPoint}
                                outPoint={clip.outPoint}
                                mediaDuration={mediaDur}
                                amplitude={clip.effects.volume ?? 1}
                              />
                            </div>
                          )}

                          {fadeInPx > 2 && (
                            <div
                              className="tl-fade"
                              style={{ width: fadeInPx }}
                              title={`Fade in ${fadeInSec.toFixed(2)}s`}
                            >
                              <svg
                                className="tl-fade-svg"
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                                aria-hidden
                              >
                                <path
                                  d="M0 100 C 25 100, 55 55, 100 0 L 0 0 Z"
                                  fill="rgba(0,0,0,0.58)"
                                />
                                <path
                                  d="M0 100 C 25 100, 55 55, 100 0"
                                  fill="none"
                                  stroke="rgba(255,255,255,0.45)"
                                  strokeWidth="1.5"
                                  vectorEffect="non-scaling-stroke"
                                />
                              </svg>
                            </div>
                          )}
                          {fadeOutPx > 2 && (
                            <div
                              className="tl-fade tl-fade-end"
                              style={{ width: fadeOutPx }}
                              title={`Fade out ${fadeOutSec.toFixed(2)}s`}
                            >
                              <svg
                                className="tl-fade-svg"
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                                aria-hidden
                              >
                                <path
                                  d="M100 100 C 75 100, 45 55, 0 0 L 100 0 Z"
                                  fill="rgba(0,0,0,0.58)"
                                />
                                <path
                                  d="M100 100 C 75 100, 45 55, 0 0"
                                  fill="none"
                                  stroke="rgba(255,255,255,0.45)"
                                  strokeWidth="1.5"
                                  vectorEffect="non-scaling-stroke"
                                />
                              </svg>
                            </div>
                          )}

                          {clip.trackKind === "text" && (
                            <div className="tl-clip-label thin">
                              <div className="truncate font-medium leading-none">
                                {clip.name}
                              </div>
                            </div>
                          )}

                          {kfTimes.map((t) => {
                            const x =
                              (t / Math.max(0.05, clip.duration)) * innerW;
                            if (x < 2 || x > innerW - 2) return null;
                            const absT = clip.start + t;
                            const active =
                              Math.abs(playhead - absT) <= 0.05;
                            return (
                              <button
                                key={`kf-${t}`}
                                type="button"
                                className={`tl-kf-mark ${active ? "on" : ""}`}
                                style={{ left: x }}
                                title={
                                  active
                                    ? "Keyframe (active) · Right-click or Del to remove"
                                    : "Click to jump · Right-click to delete"
                                }
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setPlaying(false);
                                  selectClip(clip.id);
                                  setPlayhead(absT);
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (track.locked) {
                                    setStatus("Track is locked");
                                    return;
                                  }
                                  pushHistory();
                                  removeKeyframesAtTime(clip.id, t);
                                  selectClip(clip.id);
                                  setPlayhead(absT);
                                }}
                              />
                            );
                          })}
                        </div>

                        <div
                          className="clip-trim clip-trim-right"
                          onMouseDown={(e) =>
                            beginDrag(e, clip.id, "trim-out", clip)
                          }
                          title="Trim end"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* CapCut-style draggable playhead */}
          <div
            className="tl-playhead"
            style={{
              left: TRACK_HEADER_W + playhead * zoom,
              height: 24 + tracksBodyHeight,
            }}
            onMouseDown={beginPlayheadScrub}
          >
            <div className="tl-playhead-handle" title="Drag playhead" />
            <div className="tl-playhead-line" />
          </div>
        </div>
      </div>

      {menu &&
        menuClip &&
        createPortal(
          <div
            ref={menuRef}
            className="ctx-menu"
            style={{ left: menu.x, top: menu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="ctx-item"
              onClick={() => {
                splitClipAtPlayhead(menu.clipId);
                setMenu(null);
              }}
            >
              <IconSplit size={14} />
              Split at playhead
              <span className="ctx-kbd">S</span>
            </button>
            {!isTextClip(menuClip) && (
              <button
                type="button"
                className="ctx-item"
                onClick={() => {
                  toggleClipReverse(menu.clipId);
                  setMenu(null);
                }}
              >
                <IconReverse size={14} />
                {menuClip.effects.reverse ? "Undo reverse" : "Reverse"}
              </button>
            )}
            {menuClip.trackKind === "video" && !isTextClip(menuClip) && (
              <button
                type="button"
                className="ctx-item"
                disabled={freezing}
                onClick={() => {
                  const id = menu.clipId;
                  setMenu(null);
                  void onFreeze(id);
                }}
              >
                <IconFreeze size={14} />
                {freezing ? "Freezing…" : "Freeze frame (2s)"}
              </button>
            )}
            <button
              type="button"
              className="ctx-item"
              onClick={() => {
                duplicateClip(menu.clipId);
                setMenu(null);
              }}
            >
              <IconCopy size={14} />
              Duplicate
              <span className="ctx-kbd">Ctrl+D</span>
            </button>
            <div className="ctx-sep" />
            <button
              type="button"
              className="ctx-item danger"
              onClick={() => {
                removeClip(menu.clipId);
                setMenu(null);
              }}
            >
              <IconTrash size={14} />
              Delete
              <span className="ctx-kbd">Del</span>
            </button>
          </div>,
          document.body,
        )}
    </section>
  );
}
