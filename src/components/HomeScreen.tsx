import { convertFileSrc } from "@tauri-apps/api/core";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import { ASPECT_PRESETS, AspectRatioId } from "../types/editor";
import {
  deleteProjectFile,
  duplicateProjectFile,
  formatDurationShort,
  formatRelativeSavedAt,
  getProjectsDir,
  listProjectFiles,
  loadProjectSnapshot,
  ProjectListItem,
  renameProjectFile,
  revealProjectInFolder,
  saveProjectSnapshot,
  setProjectsDir,
} from "../lib/projects";
import {
  IconAdd,
  IconCopy,
  IconFolder,
  IconImport,
  IconMore,
  IconRename,
  IconReveal,
  IconTrash,
} from "./Icons";

const HOME_ASPECTS: AspectRatioId[] = ["16:9", "9:16", "1:1", "21:9"];

const ASPECT_HINT: Record<AspectRatioId, string> = {
  "16:9": "YouTube / Widescreen",
  "9:16": "TikTok / Reels / Shorts",
  "1:1": "Square / Feed",
  "4:5": "Portrait feed",
  "21:9": "Ultrawide / Cinema",
};

function nextDefaultName(existing: ProjectListItem[]) {
  const n = existing.length + 1;
  return `Project ${String(n).padStart(2, "0")}`;
}

function aspectRatioCss(aspect: string) {
  if (aspect === "9:16") return "9 / 16";
  if (aspect === "1:1") return "1 / 1";
  if (aspect === "21:9") return "21 / 9";
  if (aspect === "4:5") return "4 / 5";
  return "16 / 9";
}

function isImageCover(path?: string) {
  return !!path && /\.(jpe?g|png|webp|gif|bmp)$/i.test(path);
}

function ProjectCover({
  coverPath,
  aspect,
  duration,
}: {
  coverPath?: string;
  aspect: string;
  duration: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = coverPath && !failed ? convertFileSrc(coverPath) : null;
  const showVideo = src && !isImageCover(coverPath);

  return (
    <div className="home-thumb" style={{ aspectRatio: aspectRatioCss(aspect) }}>
      {src && !showVideo && (
        <img
          src={src}
          alt=""
          className="home-thumb-media"
          onError={() => setFailed(true)}
        />
      )}
      {src && showVideo && (
        <video
          src={src}
          className="home-thumb-media"
          muted
          preload="metadata"
          onError={() => setFailed(true)}
        />
      )}
      {(!src || failed) && <div className="home-thumb-mark">N</div>}
      <div className="home-thumb-badge">{aspect}</div>
      <div className="home-thumb-time">{formatDurationShort(duration)}</div>
    </div>
  );
}

function ProjectCard({
  project,
  busy,
  menuOpen,
  onToggleMenu,
  onOpen,
  onRename,
  onDuplicate,
  onReveal,
  onDelete,
}: {
  project: ProjectListItem;
  busy: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onReveal: () => void;
  onDelete: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onToggleMenu();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen, onToggleMenu]);

  return (
    <div className="home-card">
      <button
        type="button"
        className="home-card-main"
        disabled={busy}
        onClick={onOpen}
        title={project.path}
      >
        <ProjectCover
          coverPath={project.coverPath}
          aspect={String(project.aspect)}
          duration={project.duration}
        />
      </button>

      <div className="home-card-meta">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{project.name}</div>
          <div className="truncate text-[11px] text-[var(--muted)]">
            {formatRelativeSavedAt(project.savedAt)} · {project.clipCount} clip
            {project.clipCount === 1 ? "" : "s"}
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="btn btn-icon home-card-more"
            title="Project options"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
          >
            <IconMore size={14} />
          </button>

          {menuOpen && (
            <div className="home-card-menu" onMouseDown={(e) => e.stopPropagation()}>
              <button type="button" className="ctx-item" onClick={onOpen}>
                <IconFolder size={14} />
                Open Project
              </button>
              <button type="button" className="ctx-item" onClick={onRename}>
                <IconRename size={14} />
                Rename
              </button>
              <button type="button" className="ctx-item" onClick={onDuplicate}>
                <IconCopy size={14} />
                Duplicate
              </button>
              <button type="button" className="ctx-item" onClick={onReveal}>
                <IconReveal size={14} />
                Show in Folder
              </button>
              <div className="ctx-sep" />
              <button type="button" className="ctx-item danger" onClick={onDelete}>
                <IconTrash size={14} />
                Delete Project
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HomeScreen() {
  const newProject = useEditorStore((s) => s.newProject);
  const loadSnapshot = useEditorStore((s) => s.loadSnapshot);
  const toSnapshot = useEditorStore((s) => s.toSnapshot);
  const setStatus = useEditorStore((s) => s.setStatus);

  const [projectsDir, setProjectsDirState] = useState("…");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aspect, setAspect] = useState<AspectRatioId>("16:9");
  const [projectName, setProjectName] = useState("Project 01");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuPath, setMenuPath] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dir = await getProjectsDir();
      setProjectsDirState(dir);
      const listed = await listProjectFiles();
      setProjects(listed);
      setProjectName(nextDefaultName(listed));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  async function onChangeProjectsDir() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Choose projects folder",
        defaultPath: projectsDir !== "…" ? projectsDir : undefined,
      });
      if (!selected || Array.isArray(selected)) return;
      const dir = await setProjectsDir(selected);
      setProjectsDirState(dir);
      await refresh();
      setStatus(`Projects folder: ${dir}`);
    } catch (e) {
      setError(String(e));
    }
  }

  async function onCreate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const name = projectName.trim() || nextDefaultName(projects);
      newProject(name, aspect);
      const saved = await saveProjectSnapshot(toSnapshot());
      useEditorStore.setState({
        projectPath: saved.filePath || null,
        projectName: saved.name,
        dirty: false,
        status: `Created “${saved.name}”`,
        view: "editor",
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onOpenPath(path: string) {
    if (busy) return;
    setBusy(true);
    setMenuPath(null);
    setError(null);
    try {
      const snap = await loadProjectSnapshot(path);
      loadSnapshot(snap);
      setStatus(`Opened “${snap.name}”`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onBrowseFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "NovaBlend Project", extensions: ["json"] }],
        defaultPath: projectsDir !== "…" ? projectsDir : undefined,
        title: "Open project",
      });
      if (!selected || Array.isArray(selected)) return;
      await onOpenPath(selected);
    } catch (e) {
      setError(String(e));
    }
  }

  async function onRename(path: string, currentName: string) {
    setMenuPath(null);
    const next = window.prompt("Rename project", currentName);
    if (next === null) return;
    if (!next.trim() || next.trim() === currentName) return;
    setBusy(true);
    try {
      await renameProjectFile(path, next.trim());
      await refresh();
      setStatus(`Renamed to “${next.trim()}”`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDuplicate(path: string) {
    setMenuPath(null);
    setBusy(true);
    try {
      const copy = await duplicateProjectFile(path);
      await refresh();
      setStatus(`Duplicated as “${copy.name}”`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReveal(path: string) {
    setMenuPath(null);
    try {
      await revealProjectInFolder(path);
    } catch (e) {
      setError(String(e));
    }
  }

  async function onDelete(path: string, name: string) {
    setMenuPath(null);
    const ok = await ask(`Delete project “${name}”? This cannot be undone.`, {
      title: "Delete Project",
      kind: "warning",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteProjectFile(path);
      await refresh();
      setStatus(`Deleted “${name}”`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="home-shell">
      <header className="home-top">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/icon.svg" alt="" className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold tracking-wide">NovaBlend Studio</div>
            <div className="text-[11px] text-[var(--muted)]">v1.0.0</div>
          </div>
        </div>

        <div className="home-path">
          <span className="home-path-label">Projects</span>
          <span className="home-path-value" title={projectsDir}>
            {projectsDir}
          </span>
          <button type="button" className="btn btn-icon home-path-btn" onClick={onChangeProjectsDir}>
            Change
          </button>
        </div>
      </header>

      <div className="home-main">
        <section className="home-hero">
          <div className="home-hero-copy">
            <div className="home-brand">NovaBlend</div>
            <h1 className="home-title">Create New Project</h1>
            <p className="home-sub">
              Pick a canvas ratio, name your project, then jump into the timeline editor.
            </p>

            <div className="home-field">
              <label className="field-label">Project name</label>
              <input
                className="home-input"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name"
              />
            </div>

            <div className="home-field">
              <label className="field-label">Aspect ratio</label>
              <div className="home-aspects">
                {HOME_ASPECTS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`home-aspect${aspect === id ? " active" : ""}`}
                    onClick={() => setAspect(id)}
                  >
                    {id}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-[var(--muted)]">
                Preset: <span className="text-[var(--text)]">{ASPECT_HINT[aspect]}</span>
                {" · "}
                {ASPECT_PRESETS[aspect].width}×{ASPECT_PRESETS[aspect].height}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-accent home-cta"
              disabled={busy}
              onClick={() => void onCreate()}
            >
              <IconAdd size={16} />
              {busy ? "Creating…" : "New Project"}
            </button>
          </div>

          <aside className="home-open-card">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Open Existing File
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
              Browse and open any <code className="text-[var(--text)]">.nbs.json</code> project from
              your computer.
            </p>
            <button
              type="button"
              className="btn btn-icon home-browse mt-4 w-full justify-center"
              onClick={() => void onBrowseFile()}
              disabled={busy}
            >
              <IconImport size={15} />
              Browse Files…
            </button>
          </aside>
        </section>

        <section className="home-recent">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-semibold">
              Recent Projects
              <span className="ml-2 text-[11px] font-normal text-[var(--muted)]">
                {filtered.length}
              </span>
            </div>
            <div className="ml-auto">
              <input
                className="home-input home-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 text-[12px] text-[var(--danger)]">{error}</div>
          )}

          {loading ? (
            <div className="mt-6 text-[13px] text-[var(--muted)]">Loading projects…</div>
          ) : filtered.length === 0 ? (
            <div className="home-empty">
              No projects yet in this folder. Create one above — your work saves here when you hit
              Save.
            </div>
          ) : (
            <div className="home-grid">
              {filtered.map((p) => (
                <ProjectCard
                  key={p.path}
                  project={p}
                  busy={busy}
                  menuOpen={menuPath === p.path}
                  onToggleMenu={() =>
                    setMenuPath((cur) => (cur === p.path ? null : p.path))
                  }
                  onOpen={() => void onOpenPath(p.path)}
                  onRename={() => void onRename(p.path, p.name)}
                  onDuplicate={() => void onDuplicate(p.path)}
                  onReveal={() => void onReveal(p.path)}
                  onDelete={() => void onDelete(p.path, p.name)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
