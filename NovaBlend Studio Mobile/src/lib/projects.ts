import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEditorStore } from "../store/editorStore";

const KEY = "novablend.projects.v1";

export async function persistProjects() {
  const projects = useEditorStore.getState().projects;
  await AsyncStorage.setItem(KEY, JSON.stringify(projects));
}

export async function hydrateProjects() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      useEditorStore.getState().loadProjects(list);
    }
  } catch {
    /* ignore corrupt cache */
  }
}

export async function autosaveCurrent() {
  useEditorStore.getState().saveProject();
  await persistProjects();
}
