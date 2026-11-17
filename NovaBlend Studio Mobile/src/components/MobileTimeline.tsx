import { useMemo, useRef } from "react";
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEditorStore } from "../store/editorStore";
import { colors, radii, spacing } from "../theme";

const HEADER_W = 44;
const TRACK_H = 52;

function formatClock(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function MobileTimeline() {
  const clips = useEditorStore((s) => s.clips);
  const tracks = useEditorStore((s) => s.tracks);
  const playhead = useEditorStore((s) => s.playhead);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectClip = useEditorStore((s) => s.selectClip);
  const moveClip = useEditorStore((s) => s.moveClip);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const duration = useEditorStore((s) => s.timelineDuration());

  const widthPx = Math.max(320, duration * zoom + 80);

  const videoTracks = useMemo(
    () =>
      tracks
        .filter((t) => t.kind === "video" || t.kind === "audio" || t.kind === "text" || t.kind === "fx")
        .sort((a, b) => {
          const order = { text: 0, fx: 1, video: 2, audio: 3 } as const;
          return order[a.kind] - order[b.kind] || a.index - b.index;
        }),
    [tracks],
  );

  const scrubber = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        setPlayhead(Math.max(0, Math.min(duration, x / zoom)));
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX;
        setPlayhead(Math.max(0, Math.min(duration, x / zoom)));
      },
    }),
  ).current;

  return (
    <View style={styles.root}>
      <View style={styles.tools}>
        <Text style={styles.clock}>{formatClock(playhead)}</Text>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.toolBtn} onPress={() => setZoom(zoom - 8)}>
          <Text style={styles.toolText}>−</Text>
        </Pressable>
        <Pressable style={styles.toolBtn} onPress={() => setZoom(zoom + 8)}>
          <Text style={styles.toolText}>+</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        style={{ flex: 1 }}
        contentContainerStyle={{ minWidth: HEADER_W + widthPx }}
      >
        <View>
          <View
            style={[styles.ruler, { width: widthPx, marginLeft: HEADER_W }]}
            {...scrubber.panHandlers}
          >
            {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
              <View key={i} style={[styles.tick, { left: i * zoom }]}>
                <Text style={styles.tickText}>{i}s</Text>
              </View>
            ))}
            <View style={[styles.playhead, { left: playhead * zoom }]} />
          </View>

          {videoTracks.map((track) => {
            const trackClips = clips.filter((c) => c.trackIndex === track.index);
            const color =
              track.kind === "video"
                ? colors.video
                : track.kind === "audio"
                  ? colors.audio
                  : track.kind === "text"
                    ? colors.textTrack
                    : colors.fx;
            return (
              <View key={track.id} style={styles.row}>
                <View style={styles.header}>
                  <Text style={styles.headerText}>{track.name}</Text>
                </View>
                <View style={[styles.lane, { width: widthPx }]}>
                  {trackClips.map((clip) => (
                    <Pressable
                      key={clip.id}
                      onPress={() => selectClip(clip.id)}
                      onLongPress={() => {
                        pushHistory();
                        moveClip(clip.id, Math.max(0, clip.start + 0.25));
                      }}
                      style={[
                        styles.clip,
                        {
                          left: clip.start * zoom,
                          width: Math.max(28, clip.duration * zoom),
                          backgroundColor: color + "33",
                          borderColor:
                            clip.id === selectedClipId ? colors.accent : color,
                        },
                      ]}
                    >
                      <Text numberOfLines={1} style={styles.clipText}>
                        {clip.name || clip.text?.content || track.kind}
                      </Text>
                    </Pressable>
                  ))}
                  <View
                    pointerEvents="none"
                    style={[styles.playheadTall, { left: playhead * zoom }]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 210,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bgElevated,
  },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: 8,
  },
  clock: { color: colors.text, fontWeight: "700", fontVariant: ["tabular-nums"] },
  toolBtn: {
    width: 32,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.bgPanel,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  toolText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  ruler: {
    height: 22,
    marginBottom: 4,
    position: "relative",
  },
  tick: { position: "absolute", top: 0 },
  tickText: { color: colors.textDim, fontSize: 9 },
  playhead: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.playhead,
  },
  playheadTall: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.playhead,
    opacity: 0.9,
  },
  row: { flexDirection: "row", height: TRACK_H, marginBottom: 4 },
  header: {
    width: HEADER_W,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  lane: {
    height: TRACK_H,
    backgroundColor: colors.bgPanel,
    borderRadius: radii.sm,
    position: "relative",
    overflow: "hidden",
  },
  clip: {
    position: "absolute",
    top: 6,
    bottom: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  clipText: { color: colors.text, fontSize: 10, fontWeight: "600" },
});
