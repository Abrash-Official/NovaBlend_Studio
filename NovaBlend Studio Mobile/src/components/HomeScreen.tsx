import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "./SafeArea";
import { useEditorStore } from "../store/editorStore";
import { colors, radii, spacing } from "../theme";
import { UpdateBanner } from "./UpdateBanner";
import { persistProjects } from "../lib/projects";

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const projects = useEditorStore((s) => s.projects);
  const newProject = useEditorStore((s) => s.newProject);
  const openProject = useEditorStore((s) => s.openProject);
  const deleteProject = useEditorStore((s) => s.deleteProject);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.brand}>NovaBlend</Text>
        <Text style={styles.sub}>Projects</Text>
      </View>

      <UpdateBanner />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 32,
        }}
      >
        <Pressable
          style={styles.newCard}
          onPress={() => newProject("New video", "9:16")}
        >
          <View style={styles.plusCircle}>
            <Text style={styles.plus}>+</Text>
          </View>
          <Text style={styles.newTitle}>New video</Text>
          <Text style={styles.newHint}>Start a CapCut-style edit</Text>
        </Pressable>

        <View style={styles.rowActions}>
          <Pressable
            style={styles.miniCard}
            onPress={() => newProject("Story 9:16", "9:16")}
          >
            <Text style={styles.miniLabel}>9:16</Text>
            <Text style={styles.miniHint}>TikTok / Reels</Text>
          </Pressable>
          <Pressable
            style={styles.miniCard}
            onPress={() => newProject("Wide 16:9", "16:9")}
          >
            <Text style={styles.miniLabel}>16:9</Text>
            <Text style={styles.miniHint}>YouTube</Text>
          </Pressable>
          <Pressable
            style={styles.miniCard}
            onPress={() => newProject("Square 1:1", "1:1")}
          >
            <Text style={styles.miniLabel}>1:1</Text>
            <Text style={styles.miniHint}>Feed</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Recent projects</Text>
        {!projects.length && (
          <Text style={styles.empty}>No projects yet — tap New video.</Text>
        )}
        <View style={styles.grid}>
          {projects.map((p) => (
            <Pressable
              key={p.id}
              style={styles.project}
              onPress={() => openProject(p.id)}
              onLongPress={async () => {
                deleteProject(p.id);
                await persistProjects();
              }}
            >
              <View style={styles.thumb}>
                <Text style={styles.thumbRatio}>{p.aspect}</Text>
              </View>
              <Text style={styles.projectName} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.meta}>
                {p.clipCount} clips · {new Date(p.savedAt).toLocaleDateString()}
              </Text>
            </Pressable>
          ))}
        </View>
        {!!projects.length && (
          <Text style={styles.hint}>Long-press a project to delete</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  brand: { color: colors.text, fontSize: 28, fontWeight: "800" },
  sub: { color: colors.textDim, marginTop: 2, fontSize: 13 },
  newCard: {
    marginTop: spacing.md,
    backgroundColor: colors.bgPanel,
    borderRadius: radii.lg,
    paddingVertical: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  plusCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  plus: { color: "#000", fontSize: 32, fontWeight: "700", marginTop: -2 },
  newTitle: { color: colors.text, fontWeight: "800", fontSize: 17 },
  newHint: { color: colors.textDim, marginTop: 4, fontSize: 12 },
  rowActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.md,
  },
  miniCard: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  miniLabel: { color: colors.text, fontWeight: "800", fontSize: 15 },
  miniHint: { color: colors.textDim, fontSize: 10, marginTop: 4 },
  section: {
    color: colors.textMuted,
    fontWeight: "700",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    fontSize: 13,
  },
  empty: { color: colors.textDim, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  project: { width: "47%" },
  thumb: {
    aspectRatio: 9 / 14,
    borderRadius: radii.md,
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbRatio: { color: colors.accent, fontWeight: "800", fontSize: 13 },
  projectName: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 13,
    marginTop: 8,
  },
  meta: { color: colors.textDim, fontSize: 10, marginTop: 2 },
  hint: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: "center",
    marginTop: 16,
  },
});
