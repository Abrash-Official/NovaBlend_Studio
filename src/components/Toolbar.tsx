import { ask, open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useEditorStore } from "../store/editorStore";
import { ASPECT_PRESETS, AspectRatioId, isTextClip } from "../types/editor";
import {
  createPreviewProxy,
  extractMediaAudio,
  PreviewProgressEvent,
  previewThumbPath,
  probeMedia,
} from "../lib/api";
import {
  getProjectsDir,
  listProjectFiles,
  loadProjectSnapshot,
  saveProjectSnapshot,
} from "../lib/projects";
import {
  IconAdd,
  IconAudio,
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
    setExporting,
    setShowExportDialog,
    setStatus,
    selectedClipId,
    projectName,
    setProjectName,
    dirty,
    loadSnapshot,
    toSnapshot,
    bumpProcessing,
    setView,
    setPlaying,
  } = useEditorStore();

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

  async function persistProject() {
    const snap = toSnapshot();
    const saved = await saveProjectSnapshot(snap);
    const dir = await getProjectsDir();
    useEditorStore.setState({
      projectPath: saved.filePath || null,
      projectName: saved.name,
      dirty: false,
      status: `Saved to ${dir}`,
    });
  }

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
    try {
      let name = projectName;
      if (!name || name === "Untitled Project") {
        const typed = window.prompt("Name this project", "My Video 1");
        if (!typed) return;
        name = typed;
        setProjectName(name);
      }
      useEditorStore.setState({ projectName: name });
      await persistProject();
    } catch (e) {
      setStatus(`Save failed: ${e}`);
    }
  }

  async function onOpenProject() {
    try {
      if (dirty) {
        const ok = await ask("Discard unsaved changes and open another project?", {
          title: "Open Project",
          kind: "warning",
        });
        if (!ok) return;
      }
      const listed = await listProjectFiles();
      if (!listed.length) {
        const selected = await open({
          multiple: false,
          filters: [{ name: "NovaBlend Project", extensions: ["json"] }],
          defaultPath: await getProjectsDir(),
        });
        if (!selected || Array.isArray(selected)) return;
        loadSnapshot(await loadProjectSnapshot(selected));
        return;
      }
      const labels = listed
        .map((p, i) => `${i + 1}. ${p.name}${p.savedAt ? ` (${p.savedAt.slice(0, 19)})` : ""}`)
        .join("\n");
      const choice = window.prompt(
        `Projects folder:\n${await getProjectsDir()}\n\nOpen number:\n${labels}\n\nBlank = browse`,
        "1",
      );
      if (choice === null) return;
      if (!choice.trim()) {
        const selected = await open({
          multiple: false,
          filters: [{ name: "NovaBlend Project", extensions: ["json"] }],
          defaultPath: await getProjectsDir(),
        });
        if (!selected || Array.isArray(selected)) return;
        loadSnapshot(await loadProjectSnapshot(selected));
        return;
      }
      const idx = Number(choice) - 1;
      if (!listed[idx]) {
        setStatus("Invalid project number");
        return;
      }
      loadSnapshot(await loadProjectSnapshot(listed[idx].path));
    } catch (e) {
      setStatus(`Open failed: ${e}`);
    }
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

  async function doExtractAudio() {
    const state = useEditorStore.getState();
    const selected =
      (state.selectedClipId &&
        state.clips.find((c) => c.id === state.selectedClipId)) ||
      state.clips.find(
        (c) =>
          !isTextClip(c) &&
          c.hasAudio &&
          state.playhead >= c.start &&
          state.playhead < c.start + c.duration,
      ) ||
      state.clips.find((c) => !isTextClip(c) && c.hasAudio);

    if (!selected || isTextClip(selected) || !selected.hasAudio) {
      setStatus("Select a video/audio clip that has sound, then Extract Audio");
      return;
    }
    if (selected.isStill) {
      setStatus("Freeze frames have no audio to extract");
      return;
    }

    const src = selected.mediaPath || selected.previewPath;
    if (!src) {
      setStatus("No media path on this clip");
      return;
    }

    setExporting(true);
    bumpProcessing(1);
    setStatus("Extracting audio into Media Bin…");
    try {
      const audioPath = await extractMediaAudio({
        path: src,
        inPoint: selected.inPoint,
        outPoint: selected.outPoint,
      });
      const probe = await probeMedia(audioPath);
      const id = uid();
      const name = `${selected.name.replace(/\.[^.]+$/, "") || "Clip"} · audio`;
      addMedia({
        id,
        name,
        path: probe.path || audioPath,
        previewPath: probe.path || audioPath,
        duration: probe.duration || Math.max(0.05, selected.outPoint - selected.inPoint),
        width: 0,
        height: 0,
        hasVideo: false,
        hasAudio: true,
        codec: probe.codec || "mp3",
        fps: 0,
        readyState: "ready",
        statusMessage: "Ready",
        progressPercent: 100,
      });
      const audioTrack =
        state.tracks.find((t) => t.kind === "audio")?.index ?? 3;
      addClipFromMedia(id, audioTrack);
      setStatus(`Audio added to Media Bin + A1: ${name}`);
    } catch (e) {
      setStatus(`Extract failed: ${e}`);
    } finally {
      bumpProcessing(-1);
      setExporting(false);
    }
  }

  const processingMedia = useEditorStore((s) =>
    s.media.find((m) => m.readyState === "processing"),
  );

  return (
    <header className="flex items-center gap-1.5 border-b border-[var(--line)] bg-[var(--bg-1)] px-2">
      <div className="mr-1 flex min-w-0 items-center gap-1.5">
        <img src="/icon.svg" alt="" className="h-5 w-5 rounded-sm" />
        <div className="min-w-0 leading-tight">
          <div className="text-[12px] font-semibold">NovaBlend</div>
          <div className="max-w-[120px] truncate text-[10px] text-[var(--muted)]" title={projectName}>
            {projectName}
            {dirty ? "*" : ""}
          </div>
        </div>
      </div>

      <div
        className="flex items-center gap-0.5 border border-[var(--line)] bg-[var(--bg-2)] p-0.5"
        style={{ borderRadius: "var(--radius)" }}
      >
        <button className="btn btn-ghost" onClick={onGoHome} title="Projects home">
          Home
        </button>
        <button className="btn btn-ghost" onClick={onNewProject} title="Create another project">
          New
        </button>
        <button className="btn btn-ghost" onClick={onOpenProject}>
          Open
        </button>
        <button className="btn btn-ghost" onClick={onSaveProject}>
          Save
        </button>
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
        onClick={() => addTextClip()}
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
      <button
        className="btn btn-icon"
        onClick={doExtractAudio}
        disabled={exporting}
        title="Extract audio"
      >
        <IconAudio size={14} />
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
    </header>
  );
}
