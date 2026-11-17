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
import { EditorToolbar } from "./EditorToolbar";
import { InspectorSheet } from "./InspectorSheet";
import { LibrarySheet } from "./LibrarySheet";
import { UpdateBanner } from "./UpdateBanner";
import { autosaveCurrent, persistProjects } from "../lib/projects";
import {
  exportProjectPackage,
  exportVideoStatusMessage,
} from "../lib/exportProject";

export function EditorScreen() {
  const insets = useSafeAreaInsets();
  const projectName = useEditorStore((s) => s.projectName);
  const dirty = useEditorStore((s) => s.dirty);
  const status = useEditorStore((s) => s.status);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const setView = useEditorStore((s) => s.setView);

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      void autosaveCurrent();
    }, 1200);
    return () => clearTimeout(t);
  }, [dirty]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* CapCut: thin top chrome */}
      <View style={styles.top}>
        <Pressable
          onPress={async () => {
            useEditorStore.getState().saveProject();
            await persistProjects();
            setView("home");
          }}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <Text style={styles.iconText}>←</Text>
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {projectName}
          </Text>
          <Text style={styles.status} numberOfLines={1}>
            {dirty ? "Editing" : "Saved"}
            {status ? ` · ${status}` : ""}
          </Text>
        </View>
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

      <UpdateBanner />

      {/* Preview ~ top third */}
      <View style={styles.previewBlock}>
        <PreviewStage />
        <View style={styles.transport}>
          <Pressable style={styles.transportBtn} onPress={() => setPlayhead(0)}>
            <Text style={styles.transportIcon}>⏮</Text>
          </Pressable>
          <Pressable
            style={styles.playBtn}
            onPress={() => setPlaying(!isPlaying)}
          >
            <Text style={styles.playIcon}>{isPlaying ? "⏸" : "▶"}</Text>
          </Pressable>
          <Pressable
            style={styles.transportBtn}
            onPress={() => {
              const end = useEditorStore.getState().timelineDuration();
              setPlayhead(end);
            }}
          >
            <Text style={styles.transportIcon}>⏭</Text>
          </Pressable>
        </View>
      </View>

      {/* Timeline scrolls under center playhead */}
      <MobileTimeline />

      {/* Contextual bottom tools */}
      <EditorToolbar />
      <View style={{ height: Math.max(insets.bottom, 8) }} />

      <InspectorSheet />
      <LibrarySheet />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: 6,
    minHeight: 44,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { color: colors.text, fontSize: 22, fontWeight: "600" },
  titleWrap: { flex: 1 },
  title: { color: colors.text, fontWeight: "700", fontSize: 15 },
  status: { color: colors.textDim, fontSize: 10, marginTop: 1 },
  exportBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  exportText: { color: "#000", fontWeight: "800", fontSize: 12 },
  previewBlock: {
    height: "38%",
    minHeight: 200,
    maxHeight: 340,
  },
  transport: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingVertical: 6,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgChip,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: { color: colors.text, fontSize: 16 },
  transportBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  transportIcon: { color: colors.textMuted, fontSize: 14 },
});
