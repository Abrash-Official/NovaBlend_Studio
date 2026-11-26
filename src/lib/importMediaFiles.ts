import {
  previewThumbPath,
  probeMedia,
  startBackgroundProxy,
} from "./api";
import { canNativeDecode } from "./mediaUrl";
import { useEditorStore } from "../store/editorStore";

function uid() {
  return `media_${Math.random().toString(36).slice(2, 10)}`;
}

const MEDIA_EXT = /\.(mp4|mov|mkv|webm|avi|mp3|wav|aac|m4a|flac|ogg)$/i;

export function isMediaPath(path: string) {
  return MEDIA_EXT.test(path);
}

function isHevc(codec: string) {
  const c = codec.toLowerCase();
  return c.includes("hevc") || c.includes("h265") || c.includes("h.265") || c.includes("hvc1");
}

function isBrowserFriendly(codec: string) {
  const c = codec.toLowerCase();
  return (
    c.includes("h264") ||
    c.includes("avc") ||
    c.includes("vp8") ||
    c.includes("vp9") ||
    c.includes("av01") ||
    c.includes("av1")
  );
}

/** Import local file paths into the media bin (shared by Import button + drag/drop). */
export async function importMediaFiles(paths: string[]) {
  const { addMedia, updateMedia, bumpProcessing, setStatus } =
    useEditorStore.getState();

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

      // Instant Ready — editable on timeline immediately (CapCut-like)
      addMedia({
        id,
        name,
        path: probe.path,
        previewPath: probe.path,
        duration: probe.duration || 5,
        width: probe.width,
        height: probe.height,
        codedWidth: probe.codedWidth,
        codedHeight: probe.codedHeight,
        rotation: probe.rotation ?? 0,
        hasVideo: probe.hasVideo,
        hasAudio: probe.hasAudio,
        codec: probe.codec,
        fps: probe.fps || 30,
        readyState: "ready",
        statusMessage: probe.hasVideo ? "Ready" : "Ready",
        progressPercent: 100,
        progressEtaSeconds: 0,
        proxyStatus: "none",
      });

      if (!probe.hasVideo) {
        setStatus(`Ready: ${name}`);
        continue;
      }

      if (isBrowserFriendly(probe.codec)) {
        updateMedia(id, {
          proxyStatus: "native",
          statusMessage: "Ready",
        });
        setStatus(`Ready: ${name}`);
        continue;
      }

      // HEVC / exotic: try native WebView2 hardware decode first
      if (isHevc(probe.codec) || !isBrowserFriendly(probe.codec)) {
        setStatus(`Checking hardware decode: ${name}…`);
        const nativeOk = await canNativeDecode(probe.path, 1500);
        if (nativeOk) {
          updateMedia(id, {
            previewPath: probe.path,
            proxyStatus: "native",
            statusMessage: "Ready · native HEVC",
            progressPercent: 100,
          });
          setStatus(`Ready (native): ${name}`);
          continue;
        }
      }

      // Background: edit head (~60s) then full proxy — non-blocking
      bumpProcessing(1);
      updateMedia(id, {
        proxyStatus: "building",
        statusMessage: "Building edit proxy…",
        progressPercent: 2,
      });
      setStatus(`Proxy for “${name}” (timeline already editable)…`);

      void (async () => {
        try {
          await startBackgroundProxy(probe.path);
          // Hot-swap handled by proxy-ready listener in Toolbar / App
          let thumbPath: string | undefined;
          try {
            const state = useEditorStore.getState();
            const item = state.media.find((m) => m.id === id);
            if (item?.previewPath) {
              thumbPath =
                (await previewThumbPath(item.previewPath)) || undefined;
            }
          } catch {
            /* optional */
          }
          if (thumbPath) {
            updateMedia(id, { thumbPath });
          }
        } catch (e) {
          updateMedia(id, {
            statusMessage: `Proxy failed (native path kept): ${e}`,
            proxyStatus: "none",
            progressPercent: 100,
          });
          setStatus(`Proxy failed for ${name}: ${e}`);
        } finally {
          bumpProcessing(-1);
        }
      })();
    } catch (e) {
      setStatus(`Import failed: ${e}`);
    }
  }
}

/** Manual "Create Proxy" from Media Bin. */
export async function requestCreateProxy(mediaId: string) {
  const { media, updateMedia, bumpProcessing, setStatus } =
    useEditorStore.getState();
  const item = media.find((m) => m.id === mediaId);
  if (!item?.path || !item.hasVideo) return;
  if (item.proxyStatus === "building" || item.proxyStatus === "full") return;

  bumpProcessing(1);
  updateMedia(mediaId, {
    proxyStatus: "building",
    statusMessage: "Building edit proxy…",
    progressPercent: 2,
  });
  setStatus(`Creating proxy: ${item.name}`);
  try {
    await startBackgroundProxy(item.path);
  } catch (e) {
    updateMedia(mediaId, {
      statusMessage: `Proxy failed: ${e}`,
      proxyStatus: item.proxyStatus || "none",
    });
  } finally {
    bumpProcessing(-1);
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
              p = p.slice(1);
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
