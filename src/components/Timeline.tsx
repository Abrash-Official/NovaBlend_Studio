import { useEffect, useMemo, useRef, useState } from "react";
import { isTextClip, TimelineClip } from "../types/editor";
import { useEditorStore } from "../store/editorStore";

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

const CLIP_H = 36;
const LANE_GAP = 6;
const LANE_PAD = 6;
const LANE_H = CLIP_H + LANE_GAP;

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
  } = useEditorStore();

  const duration = timelineDuration();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const widthPx = useMemo(() => Math.max(800, duration * zoom), [duration, zoom]);

  const trackLayouts = useMemo(() => {
    return tracks.map((track) => {
      const trackClips = clips.filter((c) => c.trackIndex === track.index);
      const { lanes, laneCount } = assignLanes(trackClips);
      const height = LANE_PAD * 2 + laneCount * LANE_H - LANE_GAP;
      return { track, trackClips, lanes, laneCount, height: Math.max(52, height) };
    });
  }, [tracks, clips]);

  const tracksBodyHeight = useMemo(
    () => trackLayouts.reduce((sum, t) => sum + t.height, 0),
    [trackLayouts],
  );

  function timeFromClientX(clientX: number) {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft - 88;
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
      const mediaDur = isTextClip(clip)
        ? Math.max(drag.originOut + 120, 600)
        : (media?.duration ?? Math.max(drag.originOut, 0.05));
      const minLen = 0.05;

      if (drag.mode === "move") {
        moveClip(drag.id, Math.max(0, drag.originStart + dTime));
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

    const onUp = () => setDrag(null);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, zoom, moveClip, updateClip]);

  function beginDrag(
    e: React.MouseEvent,
    clipId: string,
    mode: DragMode,
    clip: {
      start: number;
      inPoint: number;
      outPoint: number;
      duration: number;
    },
  ) {
    e.preventDefault();
    e.stopPropagation();
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

  return (
    <section className="panel mx-3 mb-2 flex min-h-0 flex-col overflow-hidden rounded-md">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--line)] px-3 py-1.5">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Timeline
        </div>
        <div className="text-[10px] text-[var(--muted)]">
          Overlaps stack on new lanes · drag edges to trim
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
        <div style={{ width: widthPx + 88, minHeight: 24 + tracksBodyHeight }}>
          <div className="sticky top-0 z-20 flex h-6 border-b border-[var(--line)] bg-[var(--bg-2)]">
            <div className="w-[88px] shrink-0 border-r border-[var(--line)]" />
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
              className="flex border-b border-[var(--line)]"
              style={{ height }}
            >
              <div className="flex w-[88px] shrink-0 flex-col justify-center border-r border-[var(--line)] bg-[var(--bg-2)] px-2 text-xs text-[var(--muted)]">
                <div>{track.name}</div>
                {laneCount > 1 && (
                  <div className="text-[10px] text-[var(--warn)]">{laneCount} lanes</div>
                )}
              </div>
              <div className="relative" style={{ width: widthPx, height }}>
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
                      : isTextClip(clip)
                        ? "var(--clip-t)"
                        : "var(--clip-v)";
                  const handleW = Math.min(10, Math.max(6, width * 0.12));
                  const brightness = 1 + (lane % 3) * 0.08;

                  return (
                    <div
                      key={clip.id}
                      className="absolute select-none rounded-md text-[11px] text-white shadow-sm"
                      style={{
                        left,
                        width,
                        top,
                        height: CLIP_H,
                        background: laneTint(color, lane),
                        filter: `brightness(${brightness})`,
                        outline: selected
                          ? "2px solid var(--accent)"
                          : "1px solid rgba(255,255,255,0.15)",
                        opacity: 0.96,
                        zIndex: selected || drag?.id === clip.id ? 8 : 1 + lane,
                      }}
                      title={`${clip.name} · lane ${lane + 1} — drag to move, edges to trim`}
                    >
                      <div
                        className="absolute bottom-0 left-0 top-0 z-10 cursor-ew-resize rounded-l-md"
                        style={{
                          width: handleW,
                          background:
                            "linear-gradient(90deg, rgba(255,255,255,0.45), rgba(255,255,255,0.05))",
                        }}
                        onMouseDown={(e) => beginDrag(e, clip.id, "trim-in", clip)}
                      />

                      <div
                        className="absolute bottom-0 top-0 cursor-grab overflow-hidden px-2 py-1 active:cursor-grabbing"
                        style={{ left: handleW, right: handleW }}
                        onMouseDown={(e) => beginDrag(e, clip.id, "move", clip)}
                      >
                        <div className="truncate font-medium leading-tight">{clip.name}</div>
                        <div className="truncate opacity-80">
                          {clip.duration.toFixed(1)}s · L{lane + 1}
                        </div>
                      </div>

                      <div
                        className="absolute bottom-0 right-0 top-0 z-10 cursor-ew-resize rounded-r-md"
                        style={{
                          width: handleW,
                          background:
                            "linear-gradient(270deg, rgba(255,255,255,0.45), rgba(255,255,255,0.05))",
                        }}
                        onMouseDown={(e) => beginDrag(e, clip.id, "trim-out", clip)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div
            className="pointer-events-none absolute top-6 z-30 w-px bg-[var(--accent)]"
            style={{ left: 88 + playhead * zoom, height: tracksBodyHeight }}
          >
            <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-sm bg-[var(--accent)]" />
          </div>
        </div>
      </div>
    </section>
  );
}
