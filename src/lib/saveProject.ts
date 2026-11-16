import { getProjectsDir, saveProjectSnapshot } from "./projects";
import { useEditorStore } from "../store/editorStore";

/** Persist the open project (same path as the toolbar Save button). */
export async function saveCurrentProject(opts?: {
  promptIfUntitled?: boolean;
  silent?: boolean;
}) {
  const s = useEditorStore.getState();
  let name = s.projectName;
  if (opts?.promptIfUntitled !== false) {
    if (!name || name === "Untitled Project") {
      const typed = window.prompt("Name this project", "My Video 1");
      if (!typed) return false;
      name = typed.trim() || "My Video 1";
      s.setProjectName(name);
    }
  } else if (!name?.trim()) {
    name = "Untitled Project";
  }
  useEditorStore.setState({ projectName: name });
  try {
    const snap = useEditorStore.getState().toSnapshot();
    const saved = await saveProjectSnapshot(snap);
    const dir = await getProjectsDir();
    const now = Date.now();
    useEditorStore.setState({
      projectPath: saved.filePath || null,
      projectName: saved.name,
      dirty: false,
      lastAutoSavedAt: now,
      status: opts?.silent ? "Auto saved" : `Saved to ${dir}`,
    });
    return true;
  } catch (e) {
    if (!opts?.silent) {
      useEditorStore.getState().setStatus(`Save failed: ${e}`);
    }
    return false;
  }
}
