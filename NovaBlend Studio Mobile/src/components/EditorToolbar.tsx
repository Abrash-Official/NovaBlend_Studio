import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEditorStore } from "../store/editorStore";
import { colors, spacing } from "../theme";
import { importMediaFromDevice } from "../lib/importMedia";
import { LibraryTool } from "../types/editor";

type Tool = { id: string; label: string; icon: string; onPress: () => void };

export function EditorToolbar() {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const clips = useEditorStore((s) => s.clips);
  const setLibraryTool = useEditorStore((s) => s.setLibraryTool);
  const setInspectorOpen = useEditorStore((s) => s.setInspectorOpen);
  const splitSelectedAtPlayhead = useEditorStore((s) => s.splitSelectedAtPlayhead);
  const removeSelectedClip = useEditorStore((s) => s.removeSelectedClip);
  const duplicateClip = useEditorStore((s) => s.duplicateClip);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const backgroundBlur = useEditorStore((s) => s.backgroundBlur);
  const setBackgroundBlur = useEditorStore((s) => s.setBackgroundBlur);
  const addTextClip = useEditorStore((s) => s.addTextClip);
  const aspect = useEditorStore((s) => s.aspect);
  const setAspect = useEditorStore((s) => s.setAspect);

  const clip = clips.find((c) => c.id === selectedClipId);

  const openLib = (t: LibraryTool) => setLibraryTool(t);

  const globalTools: Tool[] = [
    { id: "media", label: "Media", icon: "＋", onPress: () => void importMediaFromDevice() },
    { id: "edit", label: "Edit", icon: "✂", onPress: () => openLib("media") },
    { id: "audio", label: "Audio", icon: "♪", onPress: () => openLib("media") },
    { id: "text", label: "Text", icon: "T", onPress: () => addTextClip() },
    { id: "stickers", label: "Stickers", icon: "★", onPress: () => openLib("stickers") },
    { id: "effects", label: "Effects", icon: "✦", onPress: () => openLib("effects") },
    { id: "filters", label: "Filters", icon: "◎", onPress: () => openLib("filters") },
    { id: "captions", label: "Captions", icon: "▭", onPress: () => openLib("captions") },
    {
      id: "ratio",
      label: aspect,
      icon: "▭",
      onPress: () => {
        const order = ["9:16", "16:9", "1:1", "4:5", "21:9"] as const;
        const i = order.indexOf(aspect as (typeof order)[number]);
        setAspect(order[(i + 1) % order.length]);
      },
    },
    {
      id: "blur",
      label: backgroundBlur ? "Blur On" : "Blur",
      icon: "◌",
      onPress: () => setBackgroundBlur(!backgroundBlur),
    },
    { id: "undo", label: "Undo", icon: "↶", onPress: undo },
    { id: "redo", label: "Redo", icon: "↷", onPress: redo },
  ];

  const clipTools: Tool[] = [
    { id: "split", label: "Split", icon: "✂", onPress: splitSelectedAtPlayhead },
    {
      id: "speed",
      label: "Speed",
      icon: "⏩",
      onPress: () => setInspectorOpen(true),
    },
    {
      id: "volume",
      label: "Volume",
      icon: "🔊",
      onPress: () => setInspectorOpen(true),
    },
    {
      id: "adjust",
      label: "Adjust",
      icon: "⚙",
      onPress: () => setInspectorOpen(true),
    },
    {
      id: "anim",
      label: "Animation",
      icon: "✧",
      onPress: () => setInspectorOpen(true),
    },
    {
      id: "copy",
      label: "Copy",
      icon: "⧉",
      onPress: () => selectedClipId && duplicateClip(selectedClipId),
    },
    {
      id: "delete",
      label: "Delete",
      icon: "⌫",
      onPress: removeSelectedClip,
    },
    { id: "undo", label: "Undo", icon: "↶", onPress: undo },
  ];

  const tools = clip ? clipTools : globalTools;

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {tools.map((t) => (
          <Pressable key={t.id} style={styles.item} onPress={t.onPress}>
            <Text style={styles.icon}>{t.icon}</Text>
            <Text style={styles.label} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
    paddingVertical: 6,
  },
  row: {
    paddingHorizontal: spacing.sm,
    gap: 4,
    alignItems: "center",
  },
  item: {
    width: 64,
    alignItems: "center",
    paddingVertical: 6,
  },
  icon: {
    color: colors.text,
    fontSize: 18,
    marginBottom: 4,
    height: 22,
    textAlign: "center",
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
});
