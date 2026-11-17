import Constants from "expo-constants";
import { Platform } from "react-native";
import { useEditorStore } from "../store/editorStore";

type GhRelease = {
  tag_name?: string;
  html_url?: string;
  body?: string;
  assets?: { name: string; browser_download_url: string; content_type?: string }[];
};

function localVersionCode() {
  const extra = Constants.expoConfig?.android?.versionCode;
  if (typeof extra === "number") return extra;
  return 1;
}

function parseCodeFromTag(tag: string) {
  const m =
    tag.match(/(?:mobile|android)[-_]?(\d+)/i) ||
    tag.match(/\+(\d+)\s*$/) ||
    tag.match(/[-_]v?(\d+)$/i);
  return m ? Number(m[1]) : NaN;
}

function pickMobileApk(assets: GhRelease["assets"]) {
  if (!assets?.length) return null;
  return (
    assets.find((a) => {
      const n = a.name.toLowerCase();
      return (
        n.endsWith(".apk") &&
        (n.includes("mobile") ||
          n.includes("android") ||
          n.includes("novablend-studio") ||
          n.includes("novablend_mobile") ||
          n.includes("app-release"))
      );
    }) || null
  );
}

/**
 * Only checks the *mobile* releases API (never the desktop repo feed).
 * Requires a mobile APK asset + higher versionCode. No APK → no banner.
 */
export async function checkForAppUpdate(_currentVersion?: string) {
  useEditorStore.getState().setUpdateAvailable(null);

  const extra = Constants.expoConfig?.extra as
    | {
        githubMobileReleasesApi?: string;
        enableUpdateCheck?: boolean;
      }
    | undefined;

  // Desktop githubReleasesApi is intentionally ignored to avoid false popups
  const api = extra?.githubMobileReleasesApi?.trim();
  if (!api || extra?.enableUpdateCheck === false) return;

  try {
    const res = await fetch(api, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) return;
    const data = (await res.json()) as GhRelease;
    const apk = pickMobileApk(data.assets);
    if (!apk) return;

    const remoteCode =
      parseCodeFromTag(data.tag_name || "") ||
      (() => {
        const m = apk.name.match(/(?:[-_]v?|versioncode[-_]?)(\d+)(?:\.apk)?$/i);
        return m ? Number(m[1]) : NaN;
      })();

    const local = localVersionCode();
    if (!Number.isFinite(remoteCode) || remoteCode <= local) return;

    useEditorStore.getState().setUpdateAvailable({
      version: data.tag_name?.replace(/^v/i, "") || String(remoteCode),
      url: apk.browser_download_url,
      notes:
        Platform.OS === "android"
          ? "Tap Update to download and install the new build automatically."
          : (data.body || "A new mobile build is available.").slice(0, 220),
      apkUrl: Platform.OS === "android" ? apk.browser_download_url : undefined,
      versionCode: remoteCode,
    });
  } catch {
    /* offline */
  }
}
