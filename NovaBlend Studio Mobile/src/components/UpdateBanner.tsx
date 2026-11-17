import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { useEditorStore } from "../store/editorStore";
import { colors, radii, spacing } from "../theme";
import { installAndroidUpdate } from "../lib/installUpdate";

export function UpdateBanner() {
  const update = useEditorStore((s) => s.updateAvailable);
  const setUpdateAvailable = useEditorStore((s) => s.setUpdateAvailable);
  const [busy, setBusy] = useState(false);
  if (!update) return null;

  return (
    <View style={styles.wrap}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Update {update.version}</Text>
        <Text style={styles.notes} numberOfLines={2}>
          {update.notes}
        </Text>
      </View>
      <Pressable
        style={styles.btn}
        disabled={busy}
        onPress={async () => {
          const url = update.apkUrl || update.url;
          setBusy(true);
          try {
            if (update.apkUrl) await installAndroidUpdate(update.apkUrl);
            else await installAndroidUpdate(url);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <ActivityIndicator color="#000" size="small" />
        ) : (
          <Text style={styles.btnText}>Update</Text>
        )}
      </Pressable>
      <Pressable onPress={() => setUpdateAvailable(null)} hitSlop={8}>
        <Text style={styles.dismiss}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  title: { color: colors.text, fontWeight: "700", fontSize: 13 },
  notes: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  btn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    minWidth: 72,
    alignItems: "center",
  },
  btnText: { color: "#000", fontWeight: "800", fontSize: 12 },
  dismiss: { color: colors.textMuted, fontSize: 16, paddingHorizontal: 4 },
});
