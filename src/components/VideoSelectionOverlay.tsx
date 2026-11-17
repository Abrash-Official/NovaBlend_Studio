import { useEffect, useRef } from "react";
import { useEditorStore } from "../store/editorStore";
import { VideoBound } from "./CropOverlay";

type Corner = "tl" | "tr" | "bl" | "br";

type Props = {
  bound: VideoBound | null;
  visible: boolean;
};

/** Corner-only resize handles (no border stroke). Preview UI only — never exported. */
export function VideoSelectionOverlay({ bound, visible }: Props) {
  const updateSelectedEffects = useEditorStore((s) => s.updateSelectedEffects);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);

  const dragRef = useRef<{
    corner: Corner;
    originX: number;
    originY: number;
    startScale: number;
    centerX: number;
    centerY: number;
    startDist: number;
  } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dist = Math.hypot(e.clientX - d.centerX, e.clientY - d.centerY);
      if (d.startDist < 4) return;
      const ratio = dist / d.startDist;
      const next = Math.min(4, Math.max(0.15, d.startScale * ratio));
      updateSelectedEffects({ scale: Number(next.toFixed(3)) });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [updateSelectedEffects]);

  if (!visible || !bound || bound.w < 0.01 || bound.h < 0.01) return null;

  const beginResize = (corner: Corner, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = useEditorStore
      .getState()
      .clips.find((c) => c.id === selectedClipId);
    if (!clip) return;
    if (useEditorStore.getState().isClipLocked(clip.id)) {
      useEditorStore.getState().setStatus("Track is locked");
      return;
    }
    const parent = (e.currentTarget as HTMLElement).offsetParent as HTMLElement | null;
    const stage = parent?.parentElement;
    const rect = (stage || parent)?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + (bound.x + bound.w / 2) * rect.width;
    const centerY = rect.top + (bound.y + bound.h / 2) * rect.height;
    const startDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
    const startScale = clip.effects.scale ?? 1;

    setPlaying(false);
    pushHistory();
    dragRef.current = {
      corner,
      originX: e.clientX,
      originY: e.clientY,
      startScale,
      centerX,
      centerY,
      startDist: Math.max(8, startDist),
    };
  };

  return (
    <div
      className="video-select-box"
      style={{
        left: `${bound.x * 100}%`,
        top: `${bound.y * 100}%`,
        width: `${bound.w * 100}%`,
        height: `${bound.h * 100}%`,
      }}
    >
      {(["tl", "tr", "bl", "br"] as Corner[]).map((c) => (
        <button
          key={c}
          type="button"
          className={`video-select-corner ${c}`}
          title="Drag to resize"
          onMouseDown={(e) => beginResize(c, e)}
        />
      ))}
    </div>
  );
}
