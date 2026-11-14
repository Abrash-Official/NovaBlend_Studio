import { useEffect, useMemo, useRef, useState } from "react";
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
      const mediaDur = media?.duration ?? Math.max(drag.originOut, 0.05);
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
    <section className="panel mx-3 mb-2 flex flex-col overflow-hidden rounded-md">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-1.5">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Timeline
        </div>
        <div className="text-[10px] text-[var(--muted)]">
          Drag clip to move · drag edges to trim
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
        className="relative flex-1 overflow-auto"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).dataset.ruler === "1") {
            setPlaying(false);
            setPlayhead(timeFromClientX(e.clientX));
          }
        }}
      >
        <div style={{ width: widthPx + 88, minHeight: "100%" }}>
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

          {tracks.map((track) => (
            <div key={track.id} className="flex h-14 border-b border-[var(--line)]">
              <div className="flex w-[88px] shrink-0 items-center border-r border-[var(--line)] bg-[var(--bg-2)] px-2 text-xs text-[var(--muted)]">
                {track.name}
              </div>
              <div className="relative" style={{ width: widthPx }}>
                {clips
                  .filter((c) => c.trackIndex === track.index)
                  .map((clip) => {
                    const left = clip.start * zoom;
                    const width = Math.max(16, clip.duration * zoom);
                    const selected = clip.id === selectedClipId;
                    const color =
                      clip.trackKind === "audio" ? "var(--clip-a)" : "var(--clip-v)";
                    const handleW = Math.min(10, Math.max(6, width * 0.12));

                    return (
                      <div
                        key={clip.id}
                        className="absolute top-2 h-10 select-none rounded-md text-[11px] text-white shadow-sm"
                        style={{
                          left,
                          width,
                          background: color,
                          outline: selected ? "2px solid var(--accent)" : "1px solid rgba(255,255,255,0.15)",
                          opacity: 0.96,
                          zIndex: selected || drag?.id === clip.id ? 5 : 1,
                        }}
                        title={`${clip.name} — drag to move, edges to trim`}
                      >
                        {/* Left trim handle */}
                        <div
                          className="absolute bottom-0 left-0 top-0 z-10 cursor-ew-resize rounded-l-md"
                          style={{
                            width: handleW,
                            background:
                              "linear-gradient(90deg, rgba(255,255,255,0.45), rgba(255,255,255,0.05))",
                          }}
                          onMouseDown={(e) => beginDrag(e, clip.id, "trim-in", clip)}
                        />

                        {/* Move body */}
                        <div
                          className="absolute bottom-0 top-0 cursor-grab overflow-hidden px-2 py-1 active:cursor-grabbing"
                          style={{ left: handleW, right: handleW }}
                          onMouseDown={(e) => beginDrag(e, clip.id, "move", clip)}
                        >
                          <div className="truncate font-medium leading-tight">{clip.name}</div>
                          <div className="truncate opacity-80">
                            {clip.duration.toFixed(1)}s · {clip.effects.speed}x
                          </div>
                        </div>

                        {/* Right trim handle */}
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
            className="pointer-events-none absolute bottom-0 top-6 z-30 w-px bg-[var(--accent)]"
            style={{ left: 88 + playhead * zoom }}
          >
            <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-sm bg-[var(--accent)]" />
          </div>
        </div>
      </div>
    </section>
  );
}
