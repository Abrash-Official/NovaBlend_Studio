import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEditorStore } from "../store/editorStore";
import { colors, radii, spacing } from "../theme";

const TRACK_H = 48;
const RULER_H = 20;

function formatClock(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

/**
 * CapCut-style timeline: fixed center playhead; drag the strip under the needle.
 */
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
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const duration = useEditorStore((s) => s.timelineDuration());

  const scrollRef = useRef<ScrollView>(null);
  const [viewportW, setViewportW] = useState(0);
  const scrubbing = useRef(false);
  const syncing = useRef(false);

  const pad = Math.max(0, viewportW / 2);
  const contentW = Math.max(duration * zoom + 1, 1);
  const totalW = contentW + pad * 2;

  const videoTracks = useMemo(
    () =>
      [...tracks]
        .filter(
          (t) =>
            t.kind === "video" ||
            t.kind === "audio" ||
            t.kind === "text" ||
            t.kind === "fx",
        )
        .sort((a, b) => {
          const order = { text: 0, fx: 1, video: 2, audio: 3 } as const;
          return order[a.kind] - order[b.kind] || a.index - b.index;
        }),
    [tracks],
  );

  // Keep scroll aligned to playhead (playback + programmatic seeks)
  useEffect(() => {
    if (!viewportW || scrubbing.current) return;
    syncing.current = true;
    const x = playhead * zoom;
    scrollRef.current?.scrollTo({ x, animated: !isPlaying });
    const t = setTimeout(() => {
      syncing.current = false;
    }, 40);
    return () => clearTimeout(t);
  }, [playhead, zoom, viewportW, isPlaying]);

  function onLayout(e: LayoutChangeEvent) {
    setViewportW(e.nativeEvent.layout.width);
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (syncing.current) return;
    const x = e.nativeEvent.contentOffset.x;
    const t = Math.max(0, Math.min(duration, x / zoom));
    setPlayhead(t);
  }

  return (
    <View style={styles.root}>
      <View style={styles.tools}>
        <Text style={styles.clock}>{formatClock(playhead)}</Text>
        <Text style={styles.dur}>/ {formatClock(duration)}</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          style={styles.toolBtn}
          onPress={() => setZoom(Math.max(20, zoom - 12))}
        >
          <Text style={styles.toolText}>−</Text>
        </Pressable>
        <Pressable
          style={styles.toolBtn}
          onPress={() => setZoom(Math.min(160, zoom + 12))}
        >
          <Text style={styles.toolText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.stage} onLayout={onLayout}>
        {/* Fixed center needle */}
        <View pointerEvents="none" style={styles.needleWrap}>
          <View style={styles.needleHead} />
          <View style={styles.needle} />
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          bounces={false}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            scrubbing.current = true;
            useEditorStore.getState().setPlaying(false);
          }}
          onScrollEndDrag={() => {
            scrubbing.current = false;
          }}
          onMomentumScrollEnd={() => {
            scrubbing.current = false;
          }}
          onScroll={onScroll}
          contentContainerStyle={{ width: totalW, paddingHorizontal: pad }}
        >
          <View style={{ width: contentW }}>
            <View style={[styles.ruler, { width: contentW, height: RULER_H }]}>
              {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                <View key={i} style={[styles.tick, { left: i * zoom }]}>
                  <View style={styles.tickMark} />
                  <Text style={styles.tickText}>{i}s</Text>
                </View>
              ))}
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
                <View key={track.id} style={[styles.lane, { width: contentW }]}>
                  <Text style={styles.laneLabel} pointerEvents="none">
                    {track.name}
                  </Text>
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
                          width: Math.max(24, clip.duration * zoom),
                          backgroundColor: color + "40",
                          borderColor:
                            clip.id === selectedClipId ? "#fff" : color,
                        },
                      ]}
                    >
                      <Text numberOfLines={1} style={styles.clipText}>
                        {clip.name || clip.text?.content || track.kind}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 200,
    backgroundColor: colors.bg,
  },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    gap: 6,
  },
  clock: {
    color: colors.text,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    fontSize: 12,
  },
  dur: { color: colors.textDim, fontSize: 11, fontVariant: ["tabular-nums"] },
  toolBtn: {
    width: 30,
    height: 26,
    borderRadius: 6,
    backgroundColor: colors.bgChip,
    alignItems: "center",
    justifyContent: "center",
  },
  toolText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  stage: {
    flex: 1,
    position: "relative",
  },
  needleWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    marginLeft: -1,
    width: 2,
    zIndex: 20,
    alignItems: "center",
  },
  needleHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.playhead,
    marginBottom: -2,
  },
  needle: {
    flex: 1,
    width: 2,
    backgroundColor: colors.playhead,
  },
  ruler: { position: "relative", marginBottom: 2 },
  tick: { position: "absolute", top: 0 },
  tickMark: {
    width: 1,
    height: 6,
    backgroundColor: colors.textDim,
    marginBottom: 2,
  },
  tickText: { color: colors.textDim, fontSize: 9 },
  lane: {
    height: TRACK_H,
    marginBottom: 4,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.sm,
    position: "relative",
    overflow: "hidden",
  },
  laneLabel: {
    position: "absolute",
    left: 6,
    top: 4,
    color: colors.textDim,
    fontSize: 9,
    fontWeight: "700",
    zIndex: 1,
    opacity: 0.55,
  },
  clip: {
    position: "absolute",
    top: 8,
    bottom: 8,
    borderRadius: 6,
    borderWidth: 1.5,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  clipText: { color: colors.text, fontSize: 10, fontWeight: "600" },
});
