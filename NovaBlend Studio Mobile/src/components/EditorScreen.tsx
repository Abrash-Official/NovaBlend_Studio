import { useEffect } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "./SafeArea";
import { useEditorStore } from "../store/editorStore";
import { colors, radii, spacing } from "../theme";
import { PreviewStage } from "./PreviewStage";
import { MobileTimeline } from "./MobileTimeline";
import { InspectorSheet } from "./InspectorSheet";
import { LibrarySheet } from "./LibrarySheet";
import { UpdateBanner } from "./UpdateBanner";
import { autosaveCurrent, persistProjects } from "../lib/projects";
import { exportProjectPackage, exportVideoStatusMessage } from "../lib/exportProject";
import { importMediaFromDevice } from "../lib/importMedia";

export function EditorScreen() {
  const insets = useSafeAreaInsets();
  const projectName = useEditorStore((s) => s.projectName);
  const dirty = useEditorStore((s) => s.dirty);
  const status = useEditorStore((s) => s.status);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const setView = useEditorStore((s) => s.setView);
  const setLibraryOpen = useEditorStore((s) => s.setLibraryOpen);
  const backgroundBlur = useEditorStore((s) => s.backgroundBlur);
  const setBackgroundBlur = useEditorStore((s) => s.setBackgroundBlur);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const splitSelectedAtPlayhead = useEditorStore((s) => s.splitSelectedAtPlayhead);
  const removeSelectedClip = useEditorStore((s) => s.removeSelectedClip);
  const duplicateClip = useEditorStore((s) => s.duplicateClip);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const setAspect = useEditorStore((s) => s.setAspect);
  const aspect = useEditorStore((s) => s.aspect);

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      void autosaveCurrent();
    }, 1200);
    return () => clearTimeout(t);
  }, [dirty]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <UpdateBanner />

      <View style={styles.top}>
        <Pressable
          onPress={async () => {
            useEditorStore.getState().saveProject();
            await persistProjects();
            setView("home");
          }}
          style={styles.iconBtn}
        >
          <Text style={styles.iconText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {projectName}
          </Text>
          <Text style={styles.status} numberOfLines={1}>
            {dirty ? "Editing…" : "Saved"} · {status}
          </Text>
        </View>
        <Pressable
          style={[styles.chip, backgroundBlur && styles.chipOn]}
          onPress={() => setBackgroundBlur(!backgroundBlur)}
        >
          <Text style={[styles.chipText, backgroundBlur && styles.chipTextOn]}>
            Blur
          </Text>
        </Pressable>
        <Pressable
          style={styles.exportBtn}
          onPress={() => {
            Alert.alert("Export", exportVideoStatusMessage(), [
              { text: "Cancel", style: "cancel" },
              {
                text: "Share project",
                onPress: () => void exportProjectPackage(),
              },
            ]);
          }}
        >
          <Text style={styles.exportText}>Export</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Action label="Import" onPress={() => void importMediaFromDevice()} />
        <Action label="Library" onPress={() => setLibraryOpen(true)} />
        <Action label="Undo" onPress={undo} />
        <Action label="Redo" onPress={redo} />
        <Action label="Split" onPress={splitSelectedAtPlayhead} />
        <Action label="Delete" onPress={removeSelectedClip} />
        <Action
          label="Copy"
          onPress={() => selectedClipId && duplicateClip(selectedClipId)}
        />
        <Action
          label={aspect}
          onPress={() => {
            const order = ["9:16", "16:9", "1:1", "4:5", "21:9"] as const;
            const i = order.indexOf(aspect as (typeof order)[number]);
            setAspect(order[(i + 1) % order.length]);
          }}
        />
      </View>

      <PreviewStage />

      <View style={styles.transport}>
        <Pressable
          style={styles.play}
          onPress={() => {
            if (isPlaying) setPlaying(false);
            else setPlaying(true);
          }}
        >
          <Text style={styles.playText}>{isPlaying ? "Pause" : "Play"}</Text>
        </Pressable>
        <Pressable style={styles.reset} onPress={() => setPlayhead(0)}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <MobileTimeline />
      <InspectorSheet />
      <LibrarySheet />
      <View style={{ height: insets.bottom }} />
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.bgPanel,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  iconText: { color: colors.text, fontSize: 18, fontWeight: "700" },
  title: { color: colors.text, fontWeight: "800", fontSize: 16 },
  status: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontWeight: "700", fontSize: 11 },
  chipTextOn: { color: colors.accent },
  exportBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  exportText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
  },
  action: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  actionText: { color: colors.textMuted, fontWeight: "700", fontSize: 11 },
  transport: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
  },
  play: {
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  playText: { color: "#fff", fontWeight: "800" },
  reset: {
    backgroundColor: colors.bgPanel,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  resetText: { color: colors.text, fontWeight: "700" },
});
