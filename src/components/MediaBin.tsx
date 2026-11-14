import { convertFileSrc } from "@tauri-apps/api/core";
import { useEditorStore } from "../store/editorStore";

function formatEta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "calc…";
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s left`;
}

export function MediaBin() {
  const media = useEditorStore((s) => s.media);
  const addClipFromMedia = useEditorStore((s) => s.addClipFromMedia);
  const removeMedia = useEditorStore((s) => s.removeMedia);
  const processingCount = useEditorStore((s) => s.processingCount);

  return (
    <aside className="panel flex h-full flex-col overflow-hidden rounded-md">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-2 py-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Media Bin
        </div>
        {processingCount > 0 && (
          <div className="text-[10px] text-[var(--warn)]">Processing {processingCount}</div>
        )}
      </div>
      <div className="flex-1 space-y-1.5 overflow-auto p-1.5">
        {media.length === 0 && (
          <div className="rounded border border-dashed border-[var(--line)] p-3 text-center text-xs text-[var(--muted)]">
            Import media to begin.
          </div>
        )}
        {media.map((item) => {
          const busy = item.readyState === "processing";
          const errored = item.readyState === "error";
          const pct = Math.max(0, Math.min(100, item.progressPercent || 0));
          const thumb =
            item.thumbPath || (item.readyState === "ready" ? item.previewPath : "");
          return (
            <div
              key={item.id}
              className={`flex w-full gap-2 rounded border p-1.5 ${
                busy
                  ? "border-[var(--warn)]/40 bg-[var(--warn)]/5"
                  : errored
                    ? "border-[var(--danger)]/40 bg-[var(--danger)]/5"
                    : "border-[var(--line)] bg-[var(--bg-2)]"
              }`}
            >
              <button
                className="flex min-w-0 flex-1 gap-2 text-left disabled:cursor-wait"
                disabled={busy}
                onDoubleClick={() => !errored && addClipFromMedia(item.id)}
                onClick={() => !errored && !busy && addClipFromMedia(item.id)}
                title={busy ? "Wait until Ready" : "Click to add to timeline"}
              >
                <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded bg-black/40">
                  {item.hasVideo && item.readyState === "ready" && thumb ? (
                    thumb.toLowerCase().endsWith(".jpg") ||
                    thumb.toLowerCase().endsWith(".jpeg") ||
                    thumb.toLowerCase().endsWith(".png") ? (
                      <img
                        src={convertFileSrc(thumb)}
                        className="h-full w-full object-cover"
                        alt=""
                      />
                    ) : (
                      <video
                        src={convertFileSrc(thumb)}
                        className="h-full w-full object-cover"
                        muted
                        preload="metadata"
                      />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-[var(--muted)]">
                      {item.hasVideo ? (busy ? `${pct.toFixed(0)}%` : "VIDEO") : "AUDIO"}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium">{item.name}</div>
                  <div className="text-[10px] text-[var(--muted)]">
                    {item.duration.toFixed(1)}s
                    {item.hasVideo ? ` · ${item.width}×${item.height}` : ""}
                  </div>
                  {busy ? (
                    <div className="mt-1 space-y-1">
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${Math.max(2, pct)}%` }} />
                      </div>
                      <div className="text-[10px] text-[var(--warn)]">
                        {pct.toFixed(0)}% · {formatEta(item.progressEtaSeconds || 0)}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`truncate text-[10px] ${
                        errored ? "text-[var(--danger)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {item.statusMessage || item.codec}
                    </div>
                  )}
                </div>
              </button>
              <button
                className="btn btn-danger h-7 self-start px-2 text-[11px]"
                title="Remove from Media Bin"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  removeMedia(item.id);
                }}
              >
                Del
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
