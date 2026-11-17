import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import { ClipEffects } from "../types/editor";

export type VideoBound = {
  /** Normalized 0–1 within the canvas / composition */
  x: number;
  y: number;
  w: number;
  h: number;
};

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "move";

const SHAPES: { id: ClipEffects["maskShape"]; label: string }[] = [
  { id: "box", label: "Rect" },
  { id: "square", label: "Square" },
  { id: "rounded", label: "Round" },
  { id: "circle", label: "Circle" },
];

function clampCrop(c: {
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  shape: ClipEffects["maskShape"];
}) {
  let { cropX, cropY, cropW, cropH } = c;
  cropW = Math.min(1, Math.max(0.08, cropW));
  cropH = Math.min(1, Math.max(0.08, cropH));
  if (c.shape === "square" || c.shape === "circle") {
    const side = Math.min(cropW, cropH);
    cropW = side;
    cropH = side;
  }
  cropX = Math.min(Math.max(0, cropX), 1 - cropW);
  cropY = Math.min(Math.max(0, cropY), 1 - cropH);
  return { cropX, cropY, cropW, cropH };
}

type Props = {
  /** Selected video’s drawn rectangle (composition-normalized). */
  videoBound: VideoBound | null;
};

/**
 * CapCut-style crop: overlay is scoped to the video’s own bounds
 * (not the full 9:16/16:9 stage), so the border hugs the media.
 */
export function CropOverlay({ videoBound }: Props) {
  const cropEditing = useEditorStore((s) => s.cropEditing);
  const setCropEditing = useEditorStore((s) => s.setCropEditing);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const clip = useEditorStore((s) =>
    s.clips.find((c) => c.id === s.selectedClipId),
  );
  const updateSelectedEffects = useEditorStore((s) => s.updateSelectedEffects);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const setStatus = useEditorStore((s) => s.setStatus);

  const areaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    handle: Handle;
    originX: number;
    originY: number;
    start: { cropX: number; cropY: number; cropW: number; cropH: number };
  } | null>(null);
  const [local, setLocal] = useState({
    cropX: 0,
    cropY: 0,
    cropW: 1,
    cropH: 1,
  });

  const fx = clip?.effects;
  const shape = (fx?.maskShape || "box") as ClipEffects["maskShape"];
  const enabled = !!fx?.maskEnabled && !!clip && !!videoBound;

  useEffect(() => {
    if (!fx) return;
    setLocal({
      cropX: fx.cropX ?? 0,
      cropY: fx.cropY ?? 0,
      cropW: fx.cropW ?? 1,
      cropH: fx.cropH ?? 1,
    });
  }, [fx?.cropX, fx?.cropY, fx?.cropW, fx?.cropH, selectedClipId]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      const el = areaRef.current;
      if (!d || !el) return;
      const rect = el.getBoundingClientRect();
      const dx = (e.clientX - d.originX) / Math.max(1, rect.width);
      const dy = (e.clientY - d.originY) / Math.max(1, rect.height);
      let { cropX, cropY, cropW, cropH } = d.start;

      switch (d.handle) {
        case "move":
          cropX = d.start.cropX + dx;
          cropY = d.start.cropY + dy;
          break;
        case "e":
          cropW = d.start.cropW + dx;
          break;
        case "w":
          cropX = d.start.cropX + dx;
          cropW = d.start.cropW - dx;
          break;
        case "s":
          cropH = d.start.cropH + dy;
          break;
        case "n":
          cropY = d.start.cropY + dy;
          cropH = d.start.cropH - dy;
          break;
        case "se":
          cropW = d.start.cropW + dx;
          cropH = d.start.cropH + dy;
          break;
        case "sw":
          cropX = d.start.cropX + dx;
          cropW = d.start.cropW - dx;
          cropH = d.start.cropH + dy;
          break;
        case "ne":
          cropW = d.start.cropW + dx;
          cropY = d.start.cropY + dy;
          cropH = d.start.cropH - dy;
          break;
        case "nw":
          cropX = d.start.cropX + dx;
          cropW = d.start.cropW - dx;
          cropY = d.start.cropY + dy;
          cropH = d.start.cropH - dy;
          break;
      }
      const next = clampCrop({ cropX, cropY, cropW, cropH, shape });
      setLocal(next);
      updateSelectedEffects(next);
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
  }, [shape, updateSelectedEffects]);

  if (!cropEditing || !enabled || !videoBound) return null;

  const begin = (handle: Handle, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    pushHistory();
    dragRef.current = {
      handle,
      originX: e.clientX,
      originY: e.clientY,
      start: { ...local },
    };
  };

  const setShape = (id: ClipEffects["maskShape"]) => {
    pushHistory();
    let next = clampCrop({ ...local, shape: id });
    if (id === "square" || id === "circle") {
      const side = Math.min(next.cropW, next.cropH);
      next = {
        cropX: next.cropX + (next.cropW - side) / 2,
        cropY: next.cropY + (next.cropH - side) / 2,
        cropW: side,
        cropH: side,
      };
      next = clampCrop({ ...next, shape: id });
    }
    setLocal(next);
    updateSelectedEffects({ maskShape: id, maskEnabled: true, ...next });
    setStatus(`Crop shape: ${id}`);
  };

  const radius =
    shape === "circle"
      ? "50%"
      : shape === "rounded"
        ? "18%"
        : shape === "square"
          ? "4px"
          : "2px";

  // Map crop % (relative to video) into composition % using videoBound
  const winLeft = videoBound.x + local.cropX * videoBound.w;
  const winTop = videoBound.y + local.cropY * videoBound.h;
  const winW = local.cropW * videoBound.w;
  const winH = local.cropH * videoBound.h;

  return (
    <div className="crop-overlay">
      <div className="crop-toolbar">
        {SHAPES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`crop-shape-btn ${shape === s.id ? "on" : ""}`}
            onClick={() => setShape(s.id)}
          >
            <span className={`crop-shape-ico ${s.id}`} />
            {s.label}
          </button>
        ))}
        <button
          type="button"
          className="crop-shape-btn done"
          onClick={() => {
            setCropEditing(false);
            setStatus("Crop applied");
          }}
        >
          Done
        </button>
      </div>

      {/* Video frame outline (CapCut-style media border) */}
      <div
        className="crop-video-frame"
        style={{
          left: `${videoBound.x * 100}%`,
          top: `${videoBound.y * 100}%`,
          width: `${videoBound.w * 100}%`,
          height: `${videoBound.h * 100}%`,
        }}
      />

      {/* Dim only inside the video rect, outside the crop window */}
      <div
        ref={areaRef}
        className="crop-video-area"
        style={{
          left: `${videoBound.x * 100}%`,
          top: `${videoBound.y * 100}%`,
          width: `${videoBound.w * 100}%`,
          height: `${videoBound.h * 100}%`,
        }}
      >
        <div
          className="crop-dim"
          style={{ left: 0, top: 0, right: 0, height: `${local.cropY * 100}%` }}
        />
        <div
          className="crop-dim"
          style={{
            left: 0,
            top: `${(local.cropY + local.cropH) * 100}%`,
            right: 0,
            bottom: 0,
          }}
        />
        <div
          className="crop-dim"
          style={{
            left: 0,
            top: `${local.cropY * 100}%`,
            width: `${local.cropX * 100}%`,
            height: `${local.cropH * 100}%`,
          }}
        />
        <div
          className="crop-dim"
          style={{
            left: `${(local.cropX + local.cropW) * 100}%`,
            top: `${local.cropY * 100}%`,
            right: 0,
            height: `${local.cropH * 100}%`,
          }}
        />
      </div>

      <div
        className={`crop-window ${shape}`}
        style={{
          left: `${winLeft * 100}%`,
          top: `${winTop * 100}%`,
          width: `${winW * 100}%`,
          height: `${winH * 100}%`,
          borderRadius: radius,
        }}
        onMouseDown={(e) => begin("move", e)}
      >
        {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as Handle[]).map((h) => (
          <div
            key={h}
            className={`crop-handle crop-handle-${h}`}
            onMouseDown={(e) => begin(h, e)}
          />
        ))}
      </div>
    </div>
  );
}
