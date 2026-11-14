import { useMemo, useRef, useState } from "react";
import { useEditorStore } from "../store/editorStore";

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
    timelineDuration,
    setPlaying,
  } = useEditorStore();

  const duration = timelineDuration();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    id: string;
    originX: number;
    originStart: number;
  } | null>(null);

  const widthPx = useMemo(() => Math.max(800, duration * zoom), [duration, zoom]);

  function timeFromClientX(clientX: number) {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft - 88;
    return Math.max(0, Math.min(duration, x / zoom));
  }

  return (
    <section className="panel mx-3 mb-2 flex flex-col overflow-hidden rounded-xl">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-1.5">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Timeline
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
        onMouseMove={(e) => {
          if (!drag) return;
          const dx = e.clientX - drag.originX;
          const newStart = drag.originStart + dx / zoom;
          moveClip(drag.id, newStart);
        }}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
      >
        <div style={{ width: widthPx + 88, minHeight: "100%" }}>
          {/* Ruler */}
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
                    const width = Math.max(8, clip.duration * zoom);
                    const selected = clip.id === selectedClipId;
                    const color =
                      clip.trackKind === "audio" ? "var(--clip-a)" : "var(--clip-v)";
                    return (
                      <div
                        key={clip.id}
                        className="absolute top-2 h-10 cursor-grab overflow-hidden rounded-md px-2 py-1 text-[11px] text-white shadow-sm active:cursor-grabbing"
                        style={{
                          left,
                          width,
                          background: color,
                          outline: selected ? "2px solid var(--accent)" : "none",
                          opacity: 0.95,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          selectClip(clip.id);
                          setDrag({
                            id: clip.id,
                            originX: e.clientX,
                            originStart: clip.start,
                          });
                        }}
                        title={clip.name}
                      >
                        <div className="truncate font-medium">{clip.name}</div>
                        <div className="opacity-80">
                          {clip.duration.toFixed(1)}s · {clip.effects.speed}x
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}

          {/* Playhead */}
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
