import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useEditorStore } from "../store/editorStore";
import { colors, radii, spacing } from "../theme";

export function UpdateBanner() {
  const update = useEditorStore((s) => s.updateAvailable);
  const setUpdateAvailable = useEditorStore((s) => s.setUpdateAvailable);
  if (!update) return null;

  return (
    <View style={styles.wrap}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Update {update.version} available</Text>
        <Text style={styles.notes} numberOfLines={2}>
          {update.notes}
        </Text>
      </View>
      <Pressable
        style={styles.btn}
        onPress={() => Linking.openURL(update.url)}
      >
        <Text style={styles.btnText}>Open</Text>
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
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  title: { color: colors.text, fontWeight: "700", fontSize: 13 },
  notes: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  btn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  dismiss: { color: colors.textMuted, fontSize: 16, paddingHorizontal: 4 },
});
