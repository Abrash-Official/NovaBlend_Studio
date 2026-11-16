import {
  createPreviewProxy,
  previewThumbPath,
  probeMedia,
} from "./api";
import { useEditorStore } from "../store/editorStore";

function uid() {
  return `media_${Math.random().toString(36).slice(2, 10)}`;
}

const MEDIA_EXT = /\.(mp4|mov|mkv|webm|avi|mp3|wav|aac|m4a|flac|ogg)$/i;

export function isMediaPath(path: string) {
  return MEDIA_EXT.test(path);
}

/** Import local file paths into the media bin (shared by Import button + drag/drop). */
export async function importMediaFiles(paths: string[]) {
  const {
    addMedia,
    updateMedia,
    bumpProcessing,
    setStatus,
  } = useEditorStore.getState();

  const usable = paths.filter(isMediaPath);
  if (!usable.length) {
    setStatus("Drop video or audio files (mp4, mov, mp3, wav…)");
    return;
  }

  for (const path of usable) {
    const name = path.split(/[/\\]/).pop() || "media";
    const id = uid();
    try {
      const probe = await probeMedia(path);
      addMedia({
        id,
        name,
        path: probe.path,
        previewPath: probe.path,
        duration: probe.duration || 5,
        width: probe.width,
        height: probe.height,
        hasVideo: probe.hasVideo,
        hasAudio: probe.hasAudio,
        codec: probe.codec,
        fps: probe.fps || 30,
        readyState: probe.hasVideo ? "processing" : "ready",
        statusMessage: probe.hasVideo ? "Starting…" : "Ready",
        progressPercent: probe.hasVideo ? 0 : 100,
        progressEtaSeconds: probe.hasVideo ? probe.duration : 0,
      });

      if (!probe.hasVideo) {
        setStatus(`Ready: ${name}`);
        continue;
      }

      bumpProcessing(1);
      setStatus(`Processing “${name}”…`);

      try {
        const previewPath = await createPreviewProxy(probe.path);
        let thumbPath: string | undefined;
        try {
          thumbPath = (await previewThumbPath(previewPath)) || undefined;
        } catch {
          /* optional */
        }
        updateMedia(id, {
          previewPath,
          thumbPath,
          readyState: "ready",
          statusMessage:
            previewPath === probe.path ? "Ready" : "Ready · H.264 preview",
          progressPercent: 100,
          progressEtaSeconds: 0,
        });
        setStatus(`Ready: ${name}`);
      } catch (e) {
        updateMedia(id, {
          readyState: "error",
          statusMessage: `Failed: ${e}`,
          progressPercent: 0,
        });
        setStatus(`Preview failed for ${name}: ${e}`);
      } finally {
        bumpProcessing(-1);
      }
    } catch (e) {
      setStatus(`Import failed: ${e}`);
    }
  }
}

/** Resolve file paths from a browser/Tauri drop event. */
export async function pathsFromDrop(e: DragEvent): Promise<string[]> {
  const paths: string[] = [];
  const files = e.dataTransfer?.files;
  if (files?.length) {
    for (let i = 0; i < files.length; i++) {
      const f = files[i] as File & { path?: string };
      if (f.path) paths.push(f.path);
    }
  }
  // Tauri 2 drag-drop may expose paths via dataTransfer items
  if (!paths.length && e.dataTransfer) {
    try {
      const raw = e.dataTransfer.getData("text/uri-list");
      if (raw) {
        for (const line of raw.split(/\r?\n/)) {
          const t = line.trim();
          if (!t || t.startsWith("#")) continue;
          if (t.startsWith("file:///")) {
            let p = decodeURIComponent(t.replace(/^file:\/\/\//, ""));
            if (/^[A-Za-z]:/.test(p) === false && p.startsWith("/")) {
              // unix
            } else if (p.startsWith("/")) {
              p = p.slice(1); // Windows /C:/...
            }
            paths.push(p.replace(/\//g, "\\"));
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  return paths;
}
