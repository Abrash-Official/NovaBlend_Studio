import { ask } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import { PreviewProgressEvent } from "../lib/api";
import { importMediaFiles } from "../lib/importMediaFiles";
import { saveCurrentProject } from "../lib/saveProject";
import { OpenProjectDialog } from "./OpenProjectDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { IconImport } from "./Icons";

function formatEta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "…";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s`;
}

export function Toolbar() {
  const {
    updateMedia,
    backgroundBlur,
    setBackgroundBlur,
    clips,
    exporting,
    setShowExportDialog,
    setStatus,
    projectName,
    dirty,
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
    const { open } = await import("@tauri-apps/plugin-dialog");
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
    await importMediaFiles(paths);
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

  async function winAction(kind: "min" | "max" | "close") {
    try {
      const win = getCurrentWindow();
      if (kind === "min") await win.minimize();
      else if (kind === "max") await win.toggleMaximize();
      else await win.close();
    } catch (e) {
      setStatus(`Window control failed: ${e}`);
    }
  }

  return (
    <header className="titlebar flex items-center gap-1.5 border-b border-[var(--line)] bg-[var(--bg-1)] px-2">
      <div className="titlebar-brand" data-tauri-drag-region>
        <img src="/icon.svg" alt="" className="titlebar-logo-img" draggable={false} />
        <span className="titlebar-name" data-tauri-drag-region>
          NovaBlend
        </span>
      </div>

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

      <button
        className="btn btn-icon"
        onClick={() => void importMedia()}
        disabled={exporting}
        title="Import media"
      >
        <IconImport size={14} />
        Import
      </button>

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

      <div className="titlebar-spacer" data-tauri-drag-region />

      <div className="window-controls">
        <button
          type="button"
          className="win-btn"
          title="Minimize"
          onClick={() => void winAction("min")}
        >
          ─
        </button>
        <button
          type="button"
          className="win-btn"
          title="Maximize"
          onClick={() => void winAction("max")}
        >
          □
        </button>
        <button
          type="button"
          className="win-btn win-close"
          title="Close"
          onClick={() => void winAction("close")}
        >
          ×
        </button>
      </div>

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
