import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createFreezeClip } from "../lib/api";
import { isFxClip, isStillClip, isTextClip, TimelineClip } from "../types/editor";
import { useEditorStore } from "../store/editorStore";

function clampMenuPos(x: number, y: number, w: number, h: number) {
  const pad = 10;
  return {
    x: Math.min(Math.max(pad, x), Math.max(pad, window.innerWidth - w - pad)),
    y: Math.min(Math.max(pad, y), Math.max(pad, window.innerHeight - h - pad)),
  };
}
import {
  IconCopy,
  IconEye,
  IconEyeOff,
  IconFreeze,
  IconLock,
  IconMute,
  IconReverse,
  IconSplit,
  IconTrash,
  IconUnlock,
  IconVolume,
} from "./Icons";

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

const CLIP_H = 32;
const LANE_GAP = 4;
const LANE_PAD = 6;
const LANE_H = CLIP_H + LANE_GAP;
const TRACK_MIN_H = LANE_PAD * 2 + CLIP_H; // pad + one clip, no overflow
const TRACK_HEADER_W = 100;

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
  } = useEditorStore();

  const duration = timelineDuration();
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [menu, setMenu] = useState<CtxMenu | null>(null);
  const [freezing, setFreezing] = useState(false);
  const [dropTrackIndex, setDropTrackIndex] = useState<number | null>(null);

  const widthPx = useMemo(() => Math.max(800, duration * zoom), [duration, zoom]);

  /** Hide empty optional tracks; always keep V1 visible. */
  const trackLayouts = useMemo(() => {
    const kindOrder = { video: 0, fx: 1, audio: 2, text: 3 } as const;
    const visible = tracks
      .filter((track) => {
        const hasClips = clips.some((c) => c.trackIndex === track.index);
        if (track.kind === "video") return true;
        return hasClips;
      })
      .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.index - b.index);

    return visible.map((track) => {
      const trackClips = clips.filter((c) => c.trackIndex === track.index);
      const { lanes, laneCount } = assignLanes(trackClips);
      const lanesUsed = Math.max(1, laneCount);
      // Exact fit: top/bottom pad + clips + gaps between lanes only
      const height = LANE_PAD * 2 + lanesUsed * CLIP_H + (lanesUsed - 1) * LANE_GAP;
      return {
        track,
        trackClips,
        lanes,
        laneCount: lanesUsed,
        height: Math.max(TRACK_MIN_H, height),
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
        const over = trackIndexAtClientY(e.clientY);
        setDropTrackIndex(over);
        const target =
          over !== null
            ? state.tracks.find((t) => t.index === over)
            : undefined;
        const canDrop = target && target.kind === clip.trackKind;
        moveClip(
          drag.id,
          Math.max(0, drag.originStart + dTime),
          canDrop ? target.index : undefined,
        );
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
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, zoom, moveClip, updateClip]);

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
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--line)] px-3 py-1.5">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Timeline
        </div>
        <div className="text-[10px] text-[var(--muted)]">
          Ctrl+S save · Del delete · S split · Space play · Ctrl+D duplicate
        </div>
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          Zoom
          <input
            className="slider w-32"
            type="range"
            min={24}
            max={160}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
      </div>

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-auto"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).dataset.ruler === "1") {
            setPlaying(false);
            setPlayhead(timeFromClientX(e.clientX));
          }
        }}
      >
        <div style={{ width: widthPx + TRACK_HEADER_W, minHeight: 24 + tracksBodyHeight }}>
          <div className="sticky top-0 z-20 flex h-6 border-b border-[var(--line)] bg-[var(--bg-2)]">
            <div className="shrink-0 border-r border-[var(--line)]" style={{ width: TRACK_HEADER_W }} />
            <div className="relative flex-1" data-ruler="1" style={{ width: widthPx }}>
              {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-[var(--line)] text-[10px] text-[var(--muted)]"
                  style={{ left: i * zoom }}
                >
                  <span className="ml-1">{i}s</span>
                </div>
              ))}
            </div>
          </div>

          {trackLayouts.map(({ track, trackClips, lanes, laneCount, height }) => (
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
                    {track.kind === "video"
                      ? "V1"
                      : track.kind === "fx"
                        ? "F1"
                        : track.kind === "audio"
                          ? "A1"
                          : "T1"}
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
                {/* Lane guide lines */}
                {laneCount > 1 &&
                  Array.from({ length: laneCount - 1 }).map((_, i) => (
                    <div
                      key={`guide-${i}`}
                      className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-[var(--line)]/70"
                      style={{ top: LANE_PAD + (i + 1) * LANE_H - LANE_GAP / 2 }}
                    />
                  ))}

                {trackClips.map((clip) => {
                  const lane = lanes.get(clip.id) ?? 0;
                  const left = clip.start * zoom;
                  const width = Math.max(16, clip.duration * zoom);
                  const top = LANE_PAD + lane * LANE_H;
                  const selected = clip.id === selectedClipId;
                  const color =
                    clip.trackKind === "audio"
                      ? "var(--clip-a)"
                      : isFxClip(clip)
                        ? "var(--clip-fx)"
                        : isTextClip(clip)
                          ? "var(--clip-t)"
                          : "var(--clip-v)";
                  const handleW = 8;
                  const brightness = 1 + (lane % 3) * 0.08;

                  return (
                    <div
                      key={clip.id}
                      className="absolute overflow-hidden select-none text-[11px] text-white"
                      style={{
                        left,
                        width,
                        top,
                        height: CLIP_H,
                        borderRadius: 5,
                        background: laneTint(color, lane),
                        filter: `brightness(${brightness})`,
                        boxShadow: selected
                          ? "inset 0 0 0 1px rgba(255,255,255,0.7)"
                          : "inset 0 0 0 1px rgba(255,255,255,0.12)",
                        opacity: track.hidden ? 0.35 : track.muted ? 0.7 : 0.96,
                        zIndex: selected || drag?.id === clip.id ? 8 : 1 + lane,
                        cursor: track.locked ? "not-allowed" : undefined,
                      }}
                      title={`${clip.name} · ${clip.duration.toFixed(1)}s${track.locked ? " · locked" : " · right-click for tools"}`}
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
                        onMouseDown={(e) => beginDrag(e, clip.id, "trim-in", clip)}
                        onContextMenu={(e) => openClipMenu(e, clip.id)}
                        title="Trim start"
                      />

                      <div
                        className="absolute bottom-0 top-0 cursor-grab overflow-hidden px-2 active:cursor-grabbing"
                        style={{
                          left: handleW,
                          right: handleW,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          gap: 1,
                        }}
                        onMouseDown={(e) => beginDrag(e, clip.id, "move", clip)}
                        onContextMenu={(e) => openClipMenu(e, clip.id)}
                      >
                        <div className="truncate font-medium leading-none">
                          {clip.name}
                        </div>
                        <div className="truncate text-[10px] leading-none opacity-80">
                          {clip.duration.toFixed(1)}s · L{lane + 1}
                        </div>
                      </div>

                      <div
                        className="clip-trim clip-trim-right"
                        onMouseDown={(e) => beginDrag(e, clip.id, "trim-out", clip)}
                        title="Trim end"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div
            className="pointer-events-none absolute top-6 z-30 w-px bg-[var(--accent)]"
            style={{ left: TRACK_HEADER_W + playhead * zoom, height: tracksBodyHeight }}
          >
            <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-sm bg-[var(--accent)]" />
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
