import Constants from "expo-constants";
import { useEditorStore } from "../store/editorStore";

/**
 * Free update notice: checks GitHub Releases and shows an in-app banner.
 * Does NOT auto-install on iOS. On Android, the link can open the APK release.
 */
export async function checkForAppUpdate(currentVersion = "1.0.0") {
  const api =
    (Constants.expoConfig?.extra as { githubReleasesApi?: string } | undefined)
      ?.githubReleasesApi ||
    "https://api.github.com/repos/Abrash-Official/NovaBlend_Studio/releases/latest";

  try {
    const res = await fetch(api, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      tag_name?: string;
      html_url?: string;
      body?: string;
    };
    const remote = (data.tag_name || "").replace(/^v/i, "");
    if (!remote || remote === currentVersion.replace(/^v/i, "")) {
      useEditorStore.getState().setUpdateAvailable(null);
      return;
    }
    // Simple semver-ish: any different tag counts as available
    useEditorStore.getState().setUpdateAvailable({
      version: remote,
      url: data.html_url || api.replace("/releases/latest", "/releases"),
      notes: (data.body || "A new version is available on GitHub.").slice(0, 280),
    });
  } catch {
    /* offline — ignore */
  }
}
