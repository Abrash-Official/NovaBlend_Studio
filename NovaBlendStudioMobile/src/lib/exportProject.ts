import * as Sharing from "expo-sharing";
import {
  cacheDirectory,
  documentDirectory,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import { useEditorStore } from "../store/editorStore";

/**
 * Mobile export (phase 1): shares a project package.
 * Full FFmpeg MP4 render will be wired when you ask to build native binaries.
 */
export async function exportProjectPackage() {
  const state = useEditorStore.getState();
  if (!state.clips.length) {
    state.setStatus("Add clips before exporting");
    return { ok: false as const, message: "Timeline empty" };
  }

  state.setStatus("Preparing export package…");
  const snap = state.toSnapshot();
  const payload = JSON.stringify(snap, null, 2);

  try {
    const base = cacheDirectory || documentDirectory || "";
    if (!base) {
      state.setStatus("Storage unavailable");
      return { ok: false as const, message: "No cache directory" };
    }

    const path = `${base}novablend-${Date.now()}.novablend.json`;
    await writeAsStringAsync(path, payload);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, {
        mimeType: "application/json",
        dialogTitle: "Share NovaBlend project",
        UTI: "public.json",
      });
      state.setStatus(
        "Project shared. MP4 render lands in the next native build step.",
      );
      return { ok: true as const, message: "Shared project package" };
    }

    state.setStatus("Sharing not available on this device");
    return { ok: false as const, message: "Sharing unavailable" };
  } catch (e) {
    state.setStatus(`Export failed: ${e}`);
    return { ok: false as const, message: String(e) };
  }
}

export function exportVideoStatusMessage() {
  return "MP4 export needs the native build step (FFmpeg). Project package export works now.";
}
