import * as DocumentPicker from "expo-document-picker";
import { useEditorStore } from "../store/editorStore";

function uid() {
  return `media_${Math.random().toString(36).slice(2, 10)}`;
}

export async function importMediaFromDevice() {
  const { addMedia, setStatus, addClipFromMedia } = useEditorStore.getState();

  const result = await DocumentPicker.getDocumentAsync({
    type: ["video/*", "audio/*"],
    copyToCacheDirectory: true,
    multiple: true,
  });

  if (result.canceled || !result.assets?.length) {
    setStatus("Import cancelled");
    return;
  }

  for (const asset of result.assets) {
    const name = asset.name || "media";
    const uri = asset.uri;
    const mime = asset.mimeType || "";
    const isVideo =
      mime.startsWith("video") || /\.(mp4|mov|m4v|webm|mkv)$/i.test(name);
    const isAudio =
      mime.startsWith("audio") || /\.(mp3|wav|m4a|aac|flac)$/i.test(name);

    setStatus(`Importing ${name}…`);
    const id = uid();

    const hinted =
      typeof (asset as { duration?: number }).duration === "number"
        ? (asset as { duration?: number }).duration!
        : undefined;
    const duration = hinted && hinted > 0 ? hinted : 5;

    if (isVideo) {
      addMedia({
        id,
        name,
        path: uri,
        previewPath: uri,
        duration,
        width: 1920,
        height: 1080,
        hasVideo: true,
        hasAudio: true,
        codec: "device",
        fps: 30,
        readyState: "ready",
        statusMessage: "Ready",
        progressPercent: 100,
      });
      addClipFromMedia(id);
    } else if (isAudio) {
      addMedia({
        id,
        name,
        path: uri,
        previewPath: uri,
        duration,
        width: 0,
        height: 0,
        hasVideo: false,
        hasAudio: true,
        codec: "device",
        fps: 0,
        readyState: "ready",
        statusMessage: "Ready",
        progressPercent: 100,
      });
      addClipFromMedia(id);
    } else {
      setStatus(`Unsupported file: ${name}`);
    }
  }

  setStatus("Import complete");
}
