import { dirname, join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { AspectRatioId, ProjectSnapshot } from "../types/editor";

const LAST_PROJECT = "last-project.txt";
const PROJECTS_DIR_FILE = "projects-dir.txt";

export type ProjectListItem = {
  name: string;
  path: string;
  savedAt: string;
  aspect: AspectRatioId | string;
  clipCount: number;
  duration: number;
  coverPath?: string;
};

export function slugifyProjectName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `project-${Date.now()}`;
}

export async function getAppWorkdir() {
  return invoke<string>("get_app_workdir");
}

async function defaultProjectsDir() {
  const dir = await invoke<string>("get_projects_dir");
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

/** Active projects folder (custom override or next-to-exe default). */
export async function getProjectsDir() {
  const workdir = await getAppWorkdir();
  const marker = await join(workdir, PROJECTS_DIR_FILE);
  if (await exists(marker)) {
    const custom = (await readTextFile(marker)).trim();
    if (custom) {
      if (!(await exists(custom))) {
        await mkdir(custom, { recursive: true });
      }
      return custom;
    }
  }
  return defaultProjectsDir();
}

export async function setProjectsDir(path: string) {
  const trimmed = path.trim();
  if (!trimmed) throw new Error("Invalid projects folder");
  if (!(await exists(trimmed))) {
    await mkdir(trimmed, { recursive: true });
  }
  const workdir = await getAppWorkdir();
  await writeTextFile(await join(workdir, PROJECTS_DIR_FILE), trimmed);
  return trimmed;
}

export async function projectFilePath(name: string) {
  const dir = await getProjectsDir();
  return join(dir, `${slugifyProjectName(name)}.nbs.json`);
}

function isImagePath(p: string) {
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(p);
}

/** Pick a cover image from project media / stills. */
export function resolveCoverPath(snap: ProjectSnapshot): string | undefined {
  if (snap.coverPath && isImagePath(snap.coverPath)) return snap.coverPath;

  for (const clip of snap.clips || []) {
    if (clip.stillPath && isImagePath(clip.stillPath)) return clip.stillPath;
  }

  for (const m of snap.media || []) {
    if (m.thumbPath && isImagePath(m.thumbPath)) return m.thumbPath;
    if (m.stillPath && isImagePath(m.stillPath)) return m.stillPath;
  }

  // Fall back to a video preview path — UI can show <video> poster frame
  for (const m of snap.media || []) {
    if (m.hasVideo && (m.thumbPath || m.previewPath || m.path)) {
      return m.thumbPath || m.previewPath || m.path;
    }
  }

  for (const clip of snap.clips || []) {
    if (clip.previewPath || clip.mediaPath) {
      return clip.previewPath || clip.mediaPath;
    }
  }

  return undefined;
}

function snapshotDuration(snap: ProjectSnapshot) {
  if (!snap.clips?.length) return 0;
  return snap.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
}

function toListItem(path: string, snap: ProjectSnapshot, fallbackName: string): ProjectListItem {
  return {
    name: snap.name || fallbackName,
    path,
    savedAt: snap.savedAt || "",
    aspect: snap.aspect || "16:9",
    clipCount: snap.clips?.length || 0,
    duration: snapshotDuration(snap),
    coverPath: resolveCoverPath(snap),
  };
}

export async function saveProjectSnapshot(snapshot: ProjectSnapshot) {
  const path = snapshot.filePath || (await projectFilePath(snapshot.name));
  const coverPath = resolveCoverPath(snapshot) || snapshot.coverPath;
  const payload: ProjectSnapshot = {
    ...snapshot,
    version: 1,
    savedAt: new Date().toISOString(),
    filePath: path,
    coverPath,
  };
  await writeTextFile(path, JSON.stringify(payload, null, 2));

  const workdir = await getAppWorkdir();
  await writeTextFile(await join(workdir, LAST_PROJECT), path);
  return payload;
}

export async function loadProjectSnapshot(path: string): Promise<ProjectSnapshot> {
  const raw = await readTextFile(path);
  const data = JSON.parse(raw) as ProjectSnapshot;
  if (!data || data.version !== 1) {
    throw new Error("Unsupported project file");
  }
  const workdir = await getAppWorkdir();
  await writeTextFile(await join(workdir, LAST_PROJECT), path);
  return { ...data, filePath: path, coverPath: resolveCoverPath(data) || data.coverPath };
}

export async function listProjectFiles(): Promise<ProjectListItem[]> {
  const dir = await getProjectsDir();
  const entries = await readDir(dir);
  const out: ProjectListItem[] = [];
  for (const entry of entries) {
    if (!entry.name?.endsWith(".nbs.json")) continue;
    const path = await join(dir, entry.name);
    try {
      const raw = await readTextFile(path);
      const snap = JSON.parse(raw) as ProjectSnapshot;
      out.push(toListItem(path, snap, entry.name));
    } catch {
      out.push({
        name: entry.name,
        path,
        savedAt: "",
        aspect: "16:9",
        clipCount: 0,
        duration: 0,
      });
    }
  }
  return out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export async function loadLastProjectPath(): Promise<string | null> {
  const workdir = await getAppWorkdir();
  const marker = await join(workdir, LAST_PROJECT);
  if (!(await exists(marker))) return null;
  const path = (await readTextFile(marker)).trim();
  if (!path || !(await exists(path))) return null;
  return path;
}

export async function deleteProjectFile(path: string) {
  if (!(await exists(path))) return;
  await remove(path);
  const workdir = await getAppWorkdir();
  const marker = await join(workdir, LAST_PROJECT);
  if (await exists(marker)) {
    const last = (await readTextFile(marker)).trim();
    if (last === path) {
      await writeTextFile(marker, "");
    }
  }
}

export async function renameProjectFile(path: string, newName: string) {
  const name = newName.trim();
  if (!name) throw new Error("Name cannot be empty");
  const snap = await loadProjectSnapshot(path);
  const dir = await dirname(path);
  const nextPath = await join(dir, `${slugifyProjectName(name)}.nbs.json`);
  if (nextPath !== path && (await exists(nextPath))) {
    throw new Error("A project with that name already exists");
  }
  const updated: ProjectSnapshot = {
    ...snap,
    name,
    filePath: nextPath,
    savedAt: new Date().toISOString(),
    coverPath: resolveCoverPath(snap) || snap.coverPath,
  };
  await writeTextFile(nextPath, JSON.stringify(updated, null, 2));
  if (nextPath !== path) {
    await remove(path);
  }
  const workdir = await getAppWorkdir();
  await writeTextFile(await join(workdir, LAST_PROJECT), nextPath);
  return updated;
}

export async function duplicateProjectFile(path: string) {
  const snap = await loadProjectSnapshot(path);
  const dir = await dirname(path);
  let base = `${snap.name} Copy`;
  let nextPath = await join(dir, `${slugifyProjectName(base)}.nbs.json`);
  let i = 2;
  while (await exists(nextPath)) {
    base = `${snap.name} Copy ${i}`;
    nextPath = await join(dir, `${slugifyProjectName(base)}.nbs.json`);
    i += 1;
  }
  const copy: ProjectSnapshot = {
    ...snap,
    name: base,
    filePath: nextPath,
    savedAt: new Date().toISOString(),
    coverPath: resolveCoverPath(snap) || snap.coverPath,
  };
  await writeTextFile(nextPath, JSON.stringify(copy, null, 2));
  return copy;
}

export async function revealProjectInFolder(path: string) {
  await revealItemInDir(path);
}

export function formatRelativeSavedAt(iso: string) {
  if (!iso) return "Unknown";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso.slice(0, 10);
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days}d ago`;
  return new Date(t).toLocaleDateString();
}

export function formatDurationShort(seconds: number) {
  if (!seconds || seconds < 0.05) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
