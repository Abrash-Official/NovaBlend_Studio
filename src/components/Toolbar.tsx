import { ask, open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import { ASPECT_PRESETS, AspectRatioId } from "../types/editor";
import {
  createPreviewProxy,
  PreviewProgressEvent,
  previewThumbPath,
  probeMedia,
} from "../lib/api";
import { saveCurrentProject } from "../lib/saveProject";
import { OpenProjectDialog } from "./OpenProjectDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import {
  IconAdd,
  IconImport,
  IconSplit,
  IconText,
  IconTrash,
} from "./Icons";

function uid() {
  return `media_${Math.random().toString(36).slice(2, 10)}`;
}

function formatEta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "…";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s`;
}

export function Toolbar() {
  const {
    addMedia,
    updateMedia,
    addClipFromMedia,
    addTextClip,
    splitSelectedAtPlayhead,
    removeSelectedClip,
    aspect,
    setAspect,
    backgroundBlur,
    setBackgroundBlur,
    clips,
    exporting,
    setShowExportDialog,
    setStatus,
    selectedClipId,
    projectName,
    dirty,
    bumpProcessing,
    setView,
    setPlaying,
    lastAutoSavedAt,
  } = useEditorStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openProjectOpen, setOpenProjectOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menuOpen]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<PreviewProgressEvent>("preview-progress", (event) => {
      const { sourcePath, percent, etaSeconds, message } = event.payload;
      const media = useEditorStore.getState().media.find((m) => m.path === sourcePath);
      if (!media) return;
      updateMedia(media.id, {
        progressPercent: percent,
        progressEtaSeconds: etaSeconds,
        statusMessage: message,
      });
      setStatus(`Processing “${media.name}”: ${message}`);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [setStatus, updateMedia]);

  async function onGoHome() {
    if (dirty) {
      const ok = await ask("Leave editor? Unsaved changes will be lost unless you Save first.", {
        title: "Back to projects",
        kind: "warning",
      });
      if (!ok) return;
    }
    setPlaying(false);
    setView("home");
  }

  async function onNewProject() {
    if (dirty) {
      const discard = await ask(
        "Unsaved changes will be lost. Go to Home to create a new project?",
        { title: "New Project", kind: "warning" },
      );
      if (!discard) return;
    }
    setPlaying(false);
    setView("home");
  }

  async function onSaveProject() {
    await saveCurrentProject();
  }

  function onOpenProject() {
    setOpenProjectOpen(true);
  }

  async function importMedia() {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: "Media",
          extensions: ["mp4", "mov", "mkv", "webm", "avi", "mp3", "wav", "aac", "m4a"],
        },
      ],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];

    for (const path of paths) {
      const name = path.split(/[/\\]/).pop() || "media";
      const id = uid();
      try {
        const probe = await probeMedia(path);
        addMedia({
          id,
          name,
          path: probe.path,
          previewPath: probe.path,
          duration: probe.duration || 5,
          width: probe.width,
          height: probe.height,
          hasVideo: probe.hasVideo,
          hasAudio: probe.hasAudio,
          codec: probe.codec,
          fps: probe.fps || 30,
          readyState: probe.hasVideo ? "processing" : "ready",
          statusMessage: probe.hasVideo ? "Starting…" : "Ready",
          progressPercent: probe.hasVideo ? 0 : 100,
          progressEtaSeconds: probe.hasVideo ? probe.duration : 0,
        });

        if (!probe.hasVideo) {
          setStatus(`Ready: ${name}`);
          continue;
        }

        bumpProcessing(1);
        setStatus(`Processing “${name}”…`);

        try {
          const previewPath = await createPreviewProxy(probe.path);
          let thumbPath: string | undefined;
          try {
            thumbPath = (await previewThumbPath(previewPath)) || undefined;
          } catch {
            /* optional */
          }
          updateMedia(id, {
            previewPath,
            thumbPath,
            readyState: "ready",
            statusMessage:
              previewPath === probe.path ? "Ready" : "Ready · H.264 preview",
            progressPercent: 100,
            progressEtaSeconds: 0,
          });
          setStatus(`Ready: ${name}`);
        } catch (e) {
          updateMedia(id, {
            readyState: "error",
            statusMessage: `Failed: ${e}`,
            progressPercent: 0,
          });
          setStatus(`Preview failed for ${name}: ${e}`);
        } finally {
          bumpProcessing(-1);
        }
      } catch (e) {
        setStatus(`Import failed: ${e}`);
      }
    }
  }

  const processingMedia = useEditorStore((s) =>
    s.media.find((m) => m.readyState === "processing"),
  );

  const autoLabel =
    lastAutoSavedAt && !dirty
      ? "Auto saved"
      : dirty
        ? "Unsaved changes"
        : lastAutoSavedAt
          ? "Auto saved"
          : "Ready";

  return (
    <header className="flex items-center gap-1.5 border-b border-[var(--line)] bg-[var(--bg-1)] px-2">
      <div className="relative mr-1" ref={menuRef}>
        <button
          type="button"
          className={`btn ${menuOpen ? "btn-accent" : ""}`}
          onClick={() => setMenuOpen((v) => !v)}
        >
          Menu
        </button>
        {menuOpen && (
          <div className="main-menu">
            <div className="main-menu-section">File</div>
            <button
              type="button"
              className="main-menu-item"
              onClick={() => {
                setMenuOpen(false);
                void onNewProject();
              }}
            >
              New Project
            </button>
            <button
              type="button"
              className="main-menu-item"
              onClick={() => {
                setMenuOpen(false);
                void onOpenProject();
              }}
            >
              Open Project…
            </button>
            <button
              type="button"
              className="main-menu-item"
              onClick={() => {
                setMenuOpen(false);
                void onSaveProject();
              }}
            >
              Save Project
              <span className="main-menu-kbd">Ctrl+S</span>
            </button>
            <button
              type="button"
              className="main-menu-item accent"
              onClick={() => {
                setMenuOpen(false);
                if (!clips.length) {
                  setStatus("Add clips to the timeline before exporting");
                  return;
                }
                setShowExportDialog(true);
              }}
            >
              Export Video…
            </button>
            <div className="main-menu-sep" />
            <button
              type="button"
              className="main-menu-item"
              onClick={() => {
                setMenuOpen(false);
                void onGoHome();
              }}
            >
              Projects Dashboard
            </button>
            <div className="main-menu-section">Help</div>
            <button
              type="button"
              className="main-menu-item"
              onClick={() => {
                setMenuOpen(false);
                setShortcutsOpen(true);
              }}
            >
              Keyboard Shortcuts
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn"
        title="Back to projects"
        onClick={() => void onGoHome()}
      >
        ← Projects
      </button>

      <div className="mx-1 h-4 w-px bg-[var(--line)]" />

      <div className="min-w-0 max-w-[160px] truncate text-[12px] font-medium" title={projectName}>
        {projectName}
        {dirty ? "*" : ""}
      </div>

      <div className="mx-1 h-4 w-px bg-[var(--line)]" />

      <button className="btn btn-icon" onClick={importMedia} disabled={exporting} title="Import media">
        <IconImport size={14} />
        Import
      </button>
      <button
        className="btn btn-icon"
        title="Add ready media to timeline"
        onClick={() => {
          const media = useEditorStore.getState().media.find((m) => m.readyState === "ready");
          if (media) addClipFromMedia(media.id);
          else setStatus("No ready media — wait for processing");
        }}
      >
        <IconAdd size={14} />
        Add
      </button>
      <button
        className="btn btn-icon btn-text-tool"
        title="Add text overlay"
        onClick={() => {
          useEditorStore.getState().setLibraryTool("text");
          addTextClip();
        }}
      >
        <IconText size={14} />
        Text
      </button>
      <button
        className="btn btn-icon"
        onClick={splitSelectedAtPlayhead}
        disabled={!selectedClipId}
        title="Split selected at playhead"
      >
        <IconSplit size={14} />
      </button>
      <button
        className="btn btn-icon btn-danger"
        onClick={removeSelectedClip}
        disabled={!selectedClipId}
        title="Delete selected clip"
      >
        <IconTrash size={14} />
      </button>

      <div className="mx-1 h-4 w-px bg-[var(--line)]" />

      <label className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
        Aspect
        <select
          className="toolbar-select"
          value={aspect}
          onChange={(e) => setAspect(e.target.value as AspectRatioId)}
        >
          {(Object.keys(ASPECT_PRESETS) as AspectRatioId[]).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
        <input
          type="checkbox"
          checked={backgroundBlur}
          onChange={(e) => setBackgroundBlur(e.target.checked)}
        />
        Blur
      </label>

      <div className="min-w-0 flex-1 px-2">
        {processingMedia && (
          <div className="flex items-center gap-2">
            <div className="progress-track max-w-[220px] flex-1">
              <div
                className="progress-fill"
                style={{ width: `${Math.max(2, processingMedia.progressPercent || 0)}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-[10px] text-[var(--warn)]">
              {(processingMedia.progressPercent || 0).toFixed(0)}% · ETA{" "}
              {formatEta(processingMedia.progressEtaSeconds || 0)}
            </span>
          </div>
        )}
      </div>

      <div
        className={`autosave-pill ${dirty ? "pending" : "ok"}`}
        title={
          lastAutoSavedAt
            ? `Last auto-save ${new Date(lastAutoSavedAt).toLocaleTimeString()}`
            : "Auto-save runs while you edit"
        }
      >
        <span className="autosave-dot" />
        {autoLabel}
      </div>

      <button
        className="btn btn-accent shrink-0"
        onClick={() => {
          if (!clips.length) {
            setStatus("Add clips to the timeline before exporting");
            return;
          }
          setShowExportDialog(true);
        }}
        disabled={exporting}
      >
        {exporting ? "Exporting…" : "Export"}
      </button>

      <OpenProjectDialog
        open={openProjectOpen}
        onClose={() => setOpenProjectOpen(false)}
      />
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </header>
  );
}
