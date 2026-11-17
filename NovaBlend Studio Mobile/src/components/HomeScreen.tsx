import { LinearGradient } from "expo-linear-gradient";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "./SafeArea";
import { useState } from "react";
import { useEditorStore } from "../store/editorStore";
import { AspectRatioId } from "../types/editor";
import { colors, radii, spacing } from "../theme";
import { UpdateBanner } from "./UpdateBanner";
import { persistProjects } from "../lib/projects";

const ASPECTS: AspectRatioId[] = ["9:16", "16:9", "1:1", "4:5"];

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const projects = useEditorStore((s) => s.projects);
  const newProject = useEditorStore((s) => s.newProject);
  const openProject = useEditorStore((s) => s.openProject);
  const deleteProject = useEditorStore((s) => s.deleteProject);
  const [name, setName] = useState("Project 01");
  const [aspect, setAspect] = useState<AspectRatioId>("9:16");

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <LinearGradient
        colors={["#121826", "#0b0d12", "#0b0d12"]}
        style={StyleSheet.absoluteFill}
      />
      <UpdateBanner />

      <View style={styles.hero}>
        <Text style={styles.brand}>NovaBlend</Text>
        <Text style={styles.tag}>Mobile studio for iPhone & Android</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>New project</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Project name"
          placeholderTextColor={colors.textDim}
          style={styles.input}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {ASPECTS.map((a) => (
            <Pressable
              key={a}
              onPress={() => setAspect(a)}
              style={[styles.chip, aspect === a && styles.chipOn]}
            >
              <Text style={[styles.chipText, aspect === a && styles.chipTextOn]}>
                {a}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          style={styles.primary}
          onPress={() => newProject(name.trim() || "Untitled", aspect)}
        >
          <Text style={styles.primaryText}>Create project</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Recent</Text>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {!projects.length && (
          <Text style={styles.empty}>No saved projects yet.</Text>
        )}
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
              <Text style={styles.thumbText}>{p.aspect}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.projectName}>{p.name}</Text>
              <Text style={styles.meta}>
                {p.clipCount} clips · {new Date(p.savedAt).toLocaleString()}
              </Text>
            </View>
          </Pressable>
        ))}
        <Text style={styles.hint}>Long-press a project to delete</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  hero: { marginTop: spacing.lg, marginBottom: spacing.xl },
  brand: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tag: { color: colors.textMuted, marginTop: 6, fontSize: 14 },
  card: {
    backgroundColor: colors.bgPanel,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.md,
  },
  cardTitle: { color: colors.text, fontWeight: "700", fontSize: 16 },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontWeight: "600", fontSize: 12 },
  chipTextOn: { color: colors.accent },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  section: {
    color: colors.textMuted,
    fontWeight: "700",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  empty: { color: colors.textDim, fontSize: 13 },
  project: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    marginBottom: 10,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#1a2230",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbText: { color: colors.accent, fontWeight: "700", fontSize: 11 },
  projectName: { color: colors.text, fontWeight: "700", fontSize: 15 },
  meta: { color: colors.textDim, fontSize: 11, marginTop: 3 },
  hint: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
  },
});
