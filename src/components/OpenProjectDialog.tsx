import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import {
  getProjectsDir,
  listProjectFiles,
  loadProjectSnapshot,
  type ProjectListItem,
} from "../lib/projects";
import { useEditorStore } from "../store/editorStore";

export function OpenProjectDialog({
  open: isOpen,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const loadSnapshot = useEditorStore((s) => s.loadSnapshot);
  const setStatus = useEditorStore((s) => s.setStatus);
  const dirty = useEditorStore((s) => s.dirty);
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [dir, setDir] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    void (async () => {
      try {
        setDir(await getProjectsDir());
        setItems(await listProjectFiles());
      } catch (e) {
        setStatus(`Could not list projects: ${e}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, setStatus]);

  if (!isOpen) return null;

  async function openPath(path: string) {
    try {
      loadSnapshot(await loadProjectSnapshot(path));
      onClose();
    } catch (e) {
      setStatus(`Open failed: ${e}`);
    }
  }

  async function browse() {
    const picked = await open({
      multiple: false,
      filters: [{ name: "NovaBlend Project", extensions: ["json"] }],
      defaultPath: dir || undefined,
    });
    if (!picked || Array.isArray(picked)) return;
    await openPath(picked);
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal-card"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Open project"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Open Project</div>
            <div className="truncate text-[11px] text-[var(--muted)]" title={dir}>
              {dir || "Projects folder"}
            </div>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        {dirty && (
          <div className="mb-2 rounded border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-2 py-1.5 text-[11px] text-[var(--warn)]">
            Opening another project replaces the current editor session.
          </div>
        )}

        <div className="modal-list">
          {loading && (
            <div className="p-4 text-center text-[12px] text-[var(--muted)]">Loading…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="p-4 text-center text-[12px] text-[var(--muted)]">
              No projects in this folder yet.
            </div>
          )}
          {items.map((p) => (
            <button
              key={p.path}
              type="button"
              className={`modal-list-item ${selected === p.path ? "active" : ""}`}
              onClick={() => setSelected(p.path)}
              onDoubleClick={() => void openPath(p.path)}
            >
              <div className="truncate text-[12px] font-medium">{p.name}</div>
              <div className="truncate text-[10px] text-[var(--muted)]">
                {p.savedAt ? p.savedAt.replace("T", " ").slice(0, 19) : "—"}
                {typeof p.clipCount === "number" ? ` · ${p.clipCount} clips` : ""}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => void browse()}>
            Browse file…
          </button>
          <div className="flex-1" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-accent"
            disabled={!selected}
            onClick={() => selected && void openPath(selected)}
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
