import { convertFileSrc } from "@tauri-apps/api/core";
import { requestCreateProxy } from "../lib/importMediaFiles";
import { useEditorStore } from "../store/editorStore";
import { IconTrash } from "./Icons";

function formatEta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "calc…";
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s left`;
}

export function MediaBin({ embedded = false }: { embedded?: boolean }) {
  const media = useEditorStore((s) => s.media);
  const addClipFromMedia = useEditorStore((s) => s.addClipFromMedia);
  const removeMedia = useEditorStore((s) => s.removeMedia);
  const processingCount = useEditorStore((s) => s.processingCount);

  const body = (
    <>
      <div className="flex items-center justify-between border-b border-[var(--line)] px-2 py-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Project Media
        </div>
        {processingCount > 0 && (
          <div className="text-[10px] text-[var(--warn)]">Processing {processingCount}</div>
        )}
      </div>
      <div className="flex-1 space-y-1.5 overflow-auto p-1.5">
        {media.length === 0 && (
          <div
            className="border border-dashed border-[var(--line)] p-3 text-center text-xs text-[var(--muted)]"
            style={{ borderRadius: "var(--radius)" }}
          >
            Import media to begin.
          </div>
        )}
        {media.map((item) => {
          const building = item.proxyStatus === "building";
          const busy = item.readyState === "processing";
          const errored = item.readyState === "error";
          const pct = Math.max(0, Math.min(100, item.progressPercent || 0));
          const thumb =
            item.thumbPath || (item.readyState === "ready" ? item.previewPath : "");
          const canProxy =
            item.hasVideo &&
            item.proxyStatus !== "building" &&
            item.proxyStatus !== "full" &&
            item.readyState !== "error";
          return (
            <div
              key={item.id}
              className={`flex w-full gap-2 border p-1.5 ${
                building || busy
                  ? "border-[var(--warn)]/40 bg-[var(--warn)]/5"
                  : errored
                    ? "border-[var(--danger)]/40 bg-[var(--danger)]/5"
                    : "border-[var(--line)] bg-[var(--bg-2)]"
              }`}
              style={{ borderRadius: "var(--radius)" }}
            >
              <button
                className="flex min-w-0 flex-1 gap-2 text-left"
                disabled={errored}
                onDoubleClick={() => !errored && addClipFromMedia(item.id)}
                onClick={() => !errored && addClipFromMedia(item.id)}
                title="Click to add to timeline"
              >
                <div
                  className="relative h-12 w-16 shrink-0 overflow-hidden bg-black/40"
                  style={{ borderRadius: "var(--radius)" }}
                >
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
                  {building || busy ? (
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
              <div className="flex shrink-0 flex-col gap-1">
                {canProxy && (
                  <button
                    type="button"
                    className="btn h-7 px-1.5 text-[9px]"
                    title="Create lighter H.264 edit proxy"
                    onClick={(e) => {
                      e.stopPropagation();
                      void requestCreateProxy(item.id);
                    }}
                  >
                    Proxy
                  </button>
                )}
                <button
                  className="btn btn-icon btn-danger h-7 w-7 p-0"
                  title="Remove from Media Bin"
                  disabled={building}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMedia(item.id);
                  }}
                >
                  <IconTrash size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex h-full min-h-0 flex-col overflow-hidden">{body}</div>;
  }

  return (
    <aside className="panel flex h-full flex-col overflow-hidden">{body}</aside>
  );
}
