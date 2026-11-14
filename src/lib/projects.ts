import { join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { ProjectSnapshot } from "../types/editor";

const LAST_PROJECT = "last-project.txt";

export function slugifyProjectName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `project-${Date.now()}`;
}

export async function getProjectsDir() {
  const dir = await invoke<string>("get_projects_dir");
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

export async function getAppWorkdir() {
  return invoke<string>("get_app_workdir");
}

export async function projectFilePath(name: string) {
  const dir = await getProjectsDir();
  return join(dir, `${slugifyProjectName(name)}.nbs.json`);
}

export async function saveProjectSnapshot(snapshot: ProjectSnapshot) {
  const path = snapshot.filePath || (await projectFilePath(snapshot.name));
  const payload: ProjectSnapshot = {
    ...snapshot,
    version: 1,
    savedAt: new Date().toISOString(),
    filePath: path,
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
  return { ...data, filePath: path };
}

export async function listProjectFiles(): Promise<
  { name: string; path: string; savedAt: string }[]
> {
  const dir = await getProjectsDir();
  const entries = await readDir(dir);
  const out: { name: string; path: string; savedAt: string }[] = [];
  for (const entry of entries) {
    if (!entry.name?.endsWith(".nbs.json")) continue;
    const path = await join(dir, entry.name);
    try {
      const raw = await readTextFile(path);
      const snap = JSON.parse(raw) as ProjectSnapshot;
      out.push({
        name: snap.name || entry.name,
        path,
        savedAt: snap.savedAt || "",
      });
    } catch {
      out.push({ name: entry.name, path, savedAt: "" });
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
