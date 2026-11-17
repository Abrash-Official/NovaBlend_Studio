import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useEditorStore } from "../store/editorStore";
import { DEFAULT_TEXT, isTextClip } from "../types/editor";
import { colors, radii, spacing } from "../theme";

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHead}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {value.toFixed(step < 1 ? 2 : 0)}
          {suffix || ""}
        </Text>
      </View>
      <View style={styles.stepRow}>
        <Pressable
          style={styles.stepBtn}
          onPress={() => onChange(Math.max(min, value - step))}
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${((value - min) / (max - min)) * 100}%` },
            ]}
          />
        </View>
        <Pressable
          style={styles.stepBtn}
          onPress={() => onChange(Math.min(max, value + step))}
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function InspectorSheet() {
  const open = useEditorStore((s) => s.inspectorOpen);
  const setInspectorOpen = useEditorStore((s) => s.setInspectorOpen);
  const clips = useEditorStore((s) => s.clips);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const updateSelectedEffects = useEditorStore((s) => s.updateSelectedEffects);
  const updateSelectedText = useEditorStore((s) => s.updateSelectedText);
  const nudgeClipLayer = useEditorStore((s) => s.nudgeClipLayer);
  const addQuickKeyframe = useEditorStore((s) => s.addQuickKeyframe);
  const playhead = useEditorStore((s) => s.playhead);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const clip = clips.find((c) => c.id === selectedClipId);
  if (!open || !clip) return null;

  const fx = clip.effects;
  const text = clip.text || DEFAULT_TEXT();
  const local = Math.max(0, playhead - clip.start);

  return (
    <Modal transparent animationType="slide" visible={open}>
      <Pressable style={styles.backdrop} onPress={() => setInspectorOpen(false)} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{clip.name || "Clip"}</Text>
        <Text style={styles.sub}>
          {clip.trackKind.toUpperCase()} · t={local.toFixed(2)}s
        </Text>

        <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: 8 }}>
          {isTextClip(clip) && (
            <>
              <Text style={styles.section}>Text</Text>
              <TextInput
                style={styles.input}
                value={text.content}
                onChangeText={(content) => {
                  pushHistory();
                  updateSelectedText({ content });
                }}
                placeholderTextColor={colors.textDim}
              />
              <SliderRow
                label="Size"
                value={text.fontSize}
                min={24}
                max={200}
                step={4}
                onChange={(fontSize) => updateSelectedText({ fontSize })}
              />
            </>
          )}

          {clip.trackKind === "video" && (
            <>
              <Text style={styles.section}>Transform</Text>
              <SliderRow
                label="Scale"
                value={fx.scale * 100}
                min={5}
                max={300}
                step={1}
                suffix="%"
                onChange={(v) => updateSelectedEffects({ scale: v / 100 })}
              />
              <SliderRow
                label="Pos X"
                value={(fx.posX ?? 0) * 100}
                min={-100}
                max={100}
                step={1}
                suffix="%"
                onChange={(v) => updateSelectedEffects({ posX: v / 100 })}
              />
              <SliderRow
                label="Pos Y"
                value={(fx.posY ?? 0) * 100}
                min={-100}
                max={100}
                step={1}
                suffix="%"
                onChange={(v) => updateSelectedEffects({ posY: v / 100 })}
              />
              <SliderRow
                label="Rotation"
                value={fx.rotation}
                min={-180}
                max={180}
                step={1}
                suffix="°"
                onChange={(rotation) => updateSelectedEffects({ rotation })}
              />
              <SliderRow
                label="Opacity"
                value={fx.opacity * 100}
                min={0}
                max={100}
                step={1}
                suffix="%"
                onChange={(v) => updateSelectedEffects({ opacity: v / 100 })}
              />

              <Text style={styles.section}>Color</Text>
              <SliderRow
                label="Brightness"
                value={fx.brightness}
                min={-0.5}
                max={0.5}
                step={0.02}
                onChange={(brightness) => updateSelectedEffects({ brightness })}
              />
              <SliderRow
                label="Contrast"
                value={fx.contrast}
                min={0.5}
                max={2}
                step={0.05}
                onChange={(contrast) => updateSelectedEffects({ contrast })}
              />
              <SliderRow
                label="Saturation"
                value={fx.saturation}
                min={0}
                max={2}
                step={0.05}
                onChange={(saturation) => updateSelectedEffects({ saturation })}
              />

              <View style={styles.rowBtns}>
                <Pressable
                  style={styles.btn}
                  onPress={() => nudgeClipLayer("forward")}
                >
                  <Text style={styles.btnText}>Forward</Text>
                </Pressable>
                <Pressable
                  style={styles.btn}
                  onPress={() => nudgeClipLayer("backward")}
                >
                  <Text style={styles.btnText}>Backward</Text>
                </Pressable>
                <Pressable style={styles.btn} onPress={() => addQuickKeyframe()}>
                  <Text style={styles.btnText}>Keyframe</Text>
                </Pressable>
              </View>
            </>
          )}

          {(clip.trackKind === "video" || clip.trackKind === "audio") && (
            <>
              <Text style={styles.section}>Speed & Audio</Text>
              <SliderRow
                label="Speed"
                value={fx.speed}
                min={0.25}
                max={4}
                step={0.05}
                onChange={(speed) => updateSelectedEffects({ speed })}
              />
              <SliderRow
                label="Volume"
                value={(fx.volume ?? 1) * 100}
                min={0}
                max={200}
                step={5}
                suffix="%"
                onChange={(v) => updateSelectedEffects({ volume: v / 100 })}
              />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "72%",
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
  title: { color: colors.text, fontWeight: "800", fontSize: 17 },
  sub: { color: colors.textDim, fontSize: 12, marginBottom: 10 },
  section: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sliderRow: { gap: 6 },
  sliderHead: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  value: { color: colors.text, fontSize: 12, fontVariant: ["tabular-nums"] },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  stepText: { color: colors.text, fontSize: 18, fontWeight: "700" },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgElevated,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: colors.accent },
  rowBtns: { flexDirection: "row", gap: 8, marginTop: 8 },
  btn: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnText: { color: colors.text, fontWeight: "700", fontSize: 12 },
});
