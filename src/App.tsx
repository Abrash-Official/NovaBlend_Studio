import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { ExportDialog } from "./components/ExportDialog";
import { HomeScreen } from "./components/HomeScreen";
import { LeftLibrary } from "./components/LeftLibrary";
import { PreviewPlayer } from "./components/PreviewPlayer";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { Timeline } from "./components/Timeline";
import { Toolbar } from "./components/Toolbar";
import { useEditorHotkeys } from "./hooks/useEditorHotkeys";
import { useEditorStore } from "./store/editorStore";

type ResizeAxis = "left" | "right" | "timeline" | null;

export default function App() {
  const view = useEditorStore((s) => s.view);
  const status = useEditorStore((s) => s.status);
  const processingCount = useEditorStore((s) => s.processingCount);
  const exporting = useEditorStore((s) => s.exporting);
  const exportPercent = useEditorStore((s) => s.exportPercent);
  const projectName = useEditorStore((s) => s.projectName);
  const dirty = useEditorStore((s) => s.dirty);
  const projectPath = useEditorStore((s) => s.projectPath);
  const leftWidth = useEditorStore((s) => s.layoutLeftWidth);
  const rightWidth = useEditorStore((s) => s.layoutRightWidth);
  const timelineHeight = useEditorStore((s) => s.layoutTimelineHeight);
  const setLayoutSize = useEditorStore((s) => s.setLayoutSize);

  const [resizing, setResizing] = useState<ResizeAxis>(null);
  const dragRef = useRef<{ axis: ResizeAxis; start: number; value: number } | null>(
    null,
  );

  const onResizeStart = useCallback(
    (axis: Exclude<ResizeAxis, null>, clientPos: number) => {
      const value =
        axis === "left"
          ? leftWidth
          : axis === "right"
            ? rightWidth
            : timelineHeight;
      dragRef.current = { axis, start: clientPos, value };
      setResizing(axis);
    },
    [leftWidth, rightWidth, timelineHeight],
  );

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d?.axis) return;
      if (d.axis === "left") {
        setLayoutSize({ leftWidth: d.value + (e.clientX - d.start) });
      } else if (d.axis === "right") {
        setLayoutSize({ rightWidth: d.value - (e.clientX - d.start) });
      } else if (d.axis === "timeline") {
        setLayoutSize({ timelineHeight: d.value - (e.clientY - d.start) });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      setResizing(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor =
      resizing === "timeline" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing, setLayoutSize]);

  useEditorHotkeys(view === "editor");

  if (view === "home") {
    return <HomeScreen />;
  }

  return (
    <div
      className="app-shell"
      style={
        {
          "--left-w": `${leftWidth}px`,
          "--right-w": `${rightWidth}px`,
          "--timeline-h": `${timelineHeight}px`,
        } as CSSProperties
      }
    >
      <Toolbar />
      <ExportDialog />

      <main className="editor-main">
        <LeftLibrary />
        <div
          className={`resize-handle-col ${resizing === "left" ? "active" : ""}`}
          title="Drag to resize library"
          onMouseDown={(e) => {
            e.preventDefault();
            onResizeStart("left", e.clientX);
          }}
        />
        <PreviewPlayer />
        <div
          className={`resize-handle-col ${resizing === "right" ? "active" : ""}`}
          title="Drag to resize properties"
          onMouseDown={(e) => {
            e.preventDefault();
            onResizeStart("right", e.clientX);
          }}
        />
        <PropertiesPanel />
      </main>

      <div
        className={`resize-handle-row ${resizing === "timeline" ? "active" : ""}`}
        title="Drag to resize timeline"
        onMouseDown={(e) => {
          e.preventDefault();
          onResizeStart("timeline", e.clientY);
        }}
      />

      <Timeline />

      <footer className="flex items-center gap-2 border-t border-[var(--line)] bg-[var(--bg-1)] px-2 text-[10px] text-[var(--muted)]">
        <span className="truncate">
          {processingCount > 0 || exporting ? (
            <span className="text-[var(--warn)]">
              {exporting ? `Export ${exportPercent.toFixed(0)}% · ${status}` : status}
            </span>
          ) : (
            status
          )}
        </span>
        <span className="ml-auto shrink-0 truncate" title={projectPath || undefined}>
          {projectName}
          {dirty ? "*" : ""}
          {projectPath ? " · saved" : " · unsaved"}
        </span>
      </footer>
    </div>
  );
}
