import { save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import { AspectRatioId, ExportFps } from "../types/editor";
import { exportTimeline } from "../lib/api";

type ResPreset = "720" | "1080" | "2k" | "4k" | "custom";

function formatEta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "…";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s`;
}

function sizeFromPreset(aspect: AspectRatioId, preset: ResPreset): { width: number; height: number } {
  const [aw, ah] = aspect.split(":").map(Number);
  const long =
    preset === "720" ? 1280 : preset === "1080" ? 1920 : preset === "2k" ? 2560 : 3840;
  if (aw >= ah) {
    return {
      width: long,
      height: Math.max(16, Math.round((long * ah) / aw / 2) * 2),
    };
  }
  return {
    width: Math.max(16, Math.round((long * aw) / ah / 2) * 2),
    height: long,
  };
}

export function ExportDialog() {
  const {
    showExportDialog,
    setShowExportDialog,
    clips,
    aspect,
    fps,
    setFps,
    projectWidth,
    projectHeight,
    setProjectSize,
    backgroundBlur,
    projectName,
    exporting,
    setExporting,
    exportPercent,
    exportEtaSeconds,
    exportMessage,
    setExportProgress,
    setStatus,
  } = useEditorStore();

  const [resPreset, setResPreset] = useState<ResPreset>("1080");
  const [customW, setCustomW] = useState(projectWidth);
  const [customH, setCustomH] = useState(projectHeight);
  const [localFps, setLocalFps] = useState<ExportFps>((fps as ExportFps) || 30);

  useEffect(() => {
    if (!showExportDialog) return;
    setLocalFps((fps as ExportFps) || 30);
    setCustomW(projectWidth);
    setCustomH(projectHeight);
  }, [showExportDialog, fps, projectWidth, projectHeight]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<{ percent: number; etaSeconds: number; message: string }>(
      "export-progress",
      (event) => {
        setExportProgress(
          event.payload.percent,
          event.payload.etaSeconds,
          event.payload.message,
        );
        setStatus(`Export: ${event.payload.message}`);
      },
    ).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [setExportProgress, setStatus]);

  const previewSize = useMemo(() => {
    if (resPreset === "custom") {
      return {
        width: Math.max(16, Math.round(customW / 2) * 2),
        height: Math.max(16, Math.round(customH / 2) * 2),
      };
    }
    return sizeFromPreset(aspect, resPreset);
  }, [aspect, resPreset, customW, customH]);

  if (!showExportDialog) return null;

  async function startExport() {
    if (!clips.length) {
      setStatus("Add clips to the timeline before exporting");
      return;
    }
    const outputPath = await save({
      filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
      defaultPath: `${projectName || "novablend-export"}.mp4`,
    });
    if (!outputPath) return;

    setFps(localFps);
    setProjectSize(previewSize.width, previewSize.height);
    setExporting(true);
    setExportProgress(1, 0, "Starting export…");
    setStatus(`Exporting ${previewSize.width}×${previewSize.height} @ ${localFps}fps…`);

    try {
      const result = await exportTimeline({
        clips,
        outputPath,
        width: previewSize.width,
        height: previewSize.height,
        fps: localFps,
        backgroundBlur,
      });
      setExportProgress(100, 0, "Done");
      setStatus(result.message + (result.outputPath ? ` → ${result.outputPath}` : ""));
      setShowExportDialog(false);
    } catch (e) {
      const raw = String(e);
      setStatus(`Export failed: ${raw.slice(0, 220)}`);
      window.alert(`Export failed\n\n${raw.slice(0, 1800)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--bg-1)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Export Video</div>
            <div className="text-[11px] text-[var(--muted)]">
              Choose frame rate and resolution, then export
            </div>
          </div>
          <button
            className="btn btn-ghost"
            disabled={exporting}
            onClick={() => setShowExportDialog(false)}
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div>
            <div className="field-label">Frame rate (FPS)</div>
            <div className="flex gap-2">
              {([25, 30, 60] as ExportFps[]).map((v) => (
                <button
                  key={v}
                  className={`btn flex-1 ${localFps === v ? "btn-accent" : ""}`}
                  disabled={exporting}
                  onClick={() => setLocalFps(v)}
                >
                  {v} fps
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="field-label">Resolution</div>
            <div className="grid grid-cols-5 gap-1.5">
              {(
                [
                  ["720", "720p"],
                  ["1080", "1080p"],
                  ["2k", "2K"],
                  ["4k", "4K"],
                  ["custom", "Custom"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={`btn ${resPreset === id ? "btn-accent" : ""}`}
                  disabled={exporting}
                  onClick={() => setResPreset(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {resPreset === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="toolbar-select w-24"
                  type="number"
                  min={16}
                  step={2}
                  value={customW}
                  disabled={exporting}
                  onChange={(e) => setCustomW(Number(e.target.value) || 16)}
                />
                <span className="text-[var(--muted)]">×</span>
                <input
                  className="toolbar-select w-24"
                  type="number"
                  min={16}
                  step={2}
                  value={customH}
                  disabled={exporting}
                  onChange={(e) => setCustomH(Number(e.target.value) || 16)}
                />
              </div>
            )}
            <div className="mt-2 text-[11px] text-[var(--muted)]">
              Output: {previewSize.width}×{previewSize.height} · {localFps} fps · aspect {aspect}
            </div>
          </div>

          {exporting && (
            <div className="space-y-1.5 rounded border border-[var(--line)] bg-[var(--bg-2)] p-3">
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--warn)]">{exportMessage || "Exporting…"}</span>
                <span className="font-[var(--font-mono)]">
                  {exportPercent.toFixed(0)}% · ETA {formatEta(exportEtaSeconds)}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.max(2, exportPercent)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--line)] px-4 py-3">
          <button
            className="btn"
            disabled={exporting}
            onClick={() => setShowExportDialog(false)}
          >
            Cancel
          </button>
          <button className="btn btn-accent" disabled={exporting} onClick={startExport}>
            {exporting ? "Exporting…" : "Start Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
