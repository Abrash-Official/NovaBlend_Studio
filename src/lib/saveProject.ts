import { getProjectsDir, saveProjectSnapshot } from "./projects";
import { useEditorStore } from "../store/editorStore";

/** Persist the open project (same path as the toolbar Save button). */
export async function saveCurrentProject(opts?: { promptIfUntitled?: boolean }) {
  const s = useEditorStore.getState();
  let name = s.projectName;
  if (opts?.promptIfUntitled !== false) {
    if (!name || name === "Untitled Project") {
      const typed = window.prompt("Name this project", "My Video 1");
      if (!typed) return false;
      name = typed.trim() || "My Video 1";
      s.setProjectName(name);
    }
  }
  useEditorStore.setState({ projectName: name });
  try {
    const snap = useEditorStore.getState().toSnapshot();
    const saved = await saveProjectSnapshot(snap);
    const dir = await getProjectsDir();
    useEditorStore.setState({
      projectPath: saved.filePath || null,
      projectName: saved.name,
      dirty: false,
      status: `Saved to ${dir}`,
    });
    return true;
  } catch (e) {
    useEditorStore.getState().setStatus(`Save failed: ${e}`);
    return false;
  }
}
