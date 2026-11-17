import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEditorStore } from "../store/editorStore";
import {
  EFFECT_PRESETS,
  STICKER_PRESETS,
  TRANSITION_PRESETS,
} from "../types/editor";
import { colors, radii, spacing } from "../theme";
import { importMediaFromDevice } from "../lib/importMedia";

const TABS = [
  { id: "media", label: "Media" },
  { id: "text", label: "Text" },
  { id: "stickers", label: "Stickers" },
  { id: "effects", label: "Effects" },
  { id: "filters", label: "Filters" },
  { id: "transitions", label: "Transitions" },
  { id: "captions", label: "Captions" },
] as const;

export function LibrarySheet() {
  const open = useEditorStore((s) => s.libraryOpen);
  const setLibraryOpen = useEditorStore((s) => s.setLibraryOpen);
  const tool = useEditorStore((s) => s.libraryTool);
  const setLibraryTool = useEditorStore((s) => s.setLibraryTool);
  const media = useEditorStore((s) => s.media);
  const addClipFromMedia = useEditorStore((s) => s.addClipFromMedia);
  const addTextClip = useEditorStore((s) => s.addTextClip);
  const addFxClip = useEditorStore((s) => s.addFxClip);
  const addStickerClip = useEditorStore((s) => s.addStickerClip);
  const updateSelectedEffects = useEditorStore((s) => s.updateSelectedEffects);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  if (!open) return null;

  return (
    <Modal transparent animationType="slide" visible={open}>
      <Pressable style={styles.backdrop} onPress={() => setLibraryOpen(false)} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setLibraryTool(t.id)}
              style={[styles.tab, tool === t.id && styles.tabOn]}
            >
              <Text style={[styles.tabText, tool === t.id && styles.tabTextOn]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={{ paddingBottom: 36, gap: 10 }}>
          {tool === "media" && (
            <>
              <Pressable
                style={styles.primary}
                onPress={() => void importMediaFromDevice()}
              >
                <Text style={styles.primaryText}>Import from device</Text>
              </Pressable>
              {media.map((m) => (
                <Pressable
                  key={m.id}
                  style={styles.item}
                  onPress={() => {
                    addClipFromMedia(m.id);
                    setLibraryOpen(false);
                  }}
                >
                  <Text style={styles.itemTitle}>{m.name}</Text>
                  <Text style={styles.itemMeta}>
                    {m.hasVideo ? "Video" : "Audio"} · {m.duration.toFixed(1)}s ·{" "}
                    {m.readyState}
                  </Text>
                </Pressable>
              ))}
              {!media.length && (
                <Text style={styles.empty}>Import videos or audio to begin.</Text>
              )}
            </>
          )}

          {tool === "text" && (
            <Pressable
              style={styles.primary}
              onPress={() => addTextClip({ content: "Your text here" })}
            >
              <Text style={styles.primaryText}>Add text</Text>
            </Pressable>
          )}

          {tool === "captions" && (
            <Pressable
              style={styles.primary}
              onPress={() =>
                addTextClip({
                  content: "Caption",
                  fontSize: 48,
                  y: 0.82,
                  backgroundOpacity: 0.45,
                })
              }
            >
              <Text style={styles.primaryText}>Add caption</Text>
            </Pressable>
          )}

          {tool === "stickers" && (
            <View style={styles.grid}>
              {STICKER_PRESETS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={styles.sticker}
                  onPress={() => addStickerClip(emoji)}
                >
                  <Text style={{ fontSize: 28 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {(tool === "effects" || tool === "filters") && (
            <View style={styles.gridList}>
              {EFFECT_PRESETS.map((fx) => (
                <Pressable
                  key={fx.id}
                  style={styles.item}
                  onPress={() => {
                    if (tool === "filters") {
                      pushHistory();
                      updateSelectedEffects({
                        effect: fx.id,
                      });
                      setLibraryOpen(false);
                    } else {
                      addFxClip(fx.id);
                    }
                  }}
                >
                  <Text style={styles.itemTitle}>{fx.label}</Text>
                  <Text style={styles.itemMeta}>{fx.group}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {tool === "transitions" && (
            <View style={styles.gridList}>
              {TRANSITION_PRESETS.map((tr) => (
                <Pressable
                  key={tr.id}
                  style={styles.item}
                  onPress={() => {
                    pushHistory();
                    updateSelectedEffects({
                      fadeIn: tr.fadeIn,
                      fadeOut: tr.fadeOut,
                    });
                    setLibraryOpen(false);
                  }}
                >
                  <Text style={styles.itemTitle}>{tr.label}</Text>
                  <Text style={styles.itemMeta}>
                    in {tr.fadeIn}s · out {tr.fadeOut}s
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "70%",
    backgroundColor: colors.bgPanel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 10,
  },
  tabs: { gap: 8, paddingBottom: 12 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  tabTextOn: { color: colors.accent },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  item: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  itemTitle: { color: colors.text, fontWeight: "700" },
  itemMeta: { color: colors.textDim, fontSize: 11, marginTop: 3 },
  empty: { color: colors.textDim, textAlign: "center", marginTop: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sticker: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  gridList: { gap: 8 },
});
