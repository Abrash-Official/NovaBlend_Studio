import { Alert, Linking, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { useEditorStore } from "../store/editorStore";

/**
 * Android: download APK then open the system installer.
 * Requires REQUEST_INSTALL_PACKAGES (declared in app.json).
 */
export async function installAndroidUpdate(apkUrl: string) {
  if (Platform.OS !== "android") {
    await Linking.openURL(apkUrl);
    return;
  }

  const setStatus = useEditorStore.getState().setStatus;
  try {
    setStatus("Downloading update…");
    const dest = `${FileSystem.cacheDirectory}novablend-update.apk`;
    const result = await FileSystem.downloadAsync(apkUrl, dest);
    if (result.status !== 200) {
      throw new Error(`Download failed (${result.status})`);
    }

    setStatus("Opening installer…");
    const contentUri = await FileSystem.getContentUriAsync(result.uri);
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      flags: 1,
      type: "application/vnd.android.package-archive",
    });
    setStatus("Install the update when prompted");
  } catch (e) {
    setStatus(`Update failed: ${e}`);
    Alert.alert(
      "Update failed",
      "Could not install automatically. Open the download link instead?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open link", onPress: () => void Linking.openURL(apkUrl) },
      ],
    );
  }
}
