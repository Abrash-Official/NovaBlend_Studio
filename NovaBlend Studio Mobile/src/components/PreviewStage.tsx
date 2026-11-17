import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEditorStore } from "../store/editorStore";
import {
  DEFAULT_TEXT,
  isTextClip,
  TimelineClip,
} from "../types/editor";
import { colors } from "../theme";

function lerp(
  keys: { time: number; value: number }[],
  t: number,
  fallback: number,
) {
  if (!keys?.length) return fallback;
  const sorted = [...keys].sort((a, b) => a.time - b.time);
  if (t <= sorted[0].time) return sorted[0].value;
  if (t >= sorted[sorted.length - 1].time)
    return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.time && t <= b.time) {
      const u = (t - a.time) / Math.max(1e-6, b.time - a.time);
      return a.value + (b.value - a.value) * u;
    }
  }
  return fallback;
}

export function PreviewStage() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const playhead = useEditorStore((s) => s.playhead);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const clips = useEditorStore((s) => s.clips);
  const tracks = useEditorStore((s) => s.tracks);
  const projectWidth = useEditorStore((s) => s.projectWidth);
  const projectHeight = useEditorStore((s) => s.projectHeight);
  const backgroundBlur = useEditorStore((s) => s.backgroundBlur);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectClip = useEditorStore((s) => s.selectClip);

  const activeVideos = useMemo(() => {
    return clips
      .filter((c) => {
        if (c.trackKind !== "video") return false;
        if (playhead < c.start || playhead >= c.start + c.duration) return false;
        const track = tracks.find((t) => t.index === c.trackIndex);
        return !track?.hidden;
      })
      .sort((a, b) => b.trackIndex - a.trackIndex);
  }, [clips, playhead, tracks]);

  const activeTexts = useMemo(
    () =>
      clips.filter((c) => {
        if (!isTextClip(c)) return false;
        if (playhead < c.start || playhead >= c.start + c.duration) return false;
        const track = tracks.find((t) => t.index === c.trackIndex);
        return !track?.hidden;
      }),
    [clips, playhead, tracks],
  );

  const primary =
    [...activeVideos].sort((a, b) => a.trackIndex - b.trackIndex)[0] || null;
  const bottom = activeVideos[0] || null;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    if (!isPlaying) return;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const end = useEditorStore.getState().timelineDuration();
      const next = useEditorStore.getState().playhead + dt;
      if (next >= end) {
        setPlaying(false);
        setPlayhead(Math.max(0, end - 0.01));
        return;
      }
      setPlayhead(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, setPlayhead, setPlaying]);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  }

  const ratio = projectWidth / Math.max(1, projectHeight);
  let stageW = box.w;
  let stageH = stageW / ratio;
  if (stageH > box.h && box.h > 0) {
    stageH = box.h;
    stageW = stageH * ratio;
  }

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <View
        style={[
          styles.stage,
          {
            width: stageW || "100%",
            height: stageH || undefined,
            aspectRatio: ratio,
          },
        ]}
      >
        {backgroundBlur && bottom?.previewPath ? (
          <BlurPlate uri={bottom.previewPath} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} />
        )}

        {activeVideos.map((clip) => (
          <LayerVideo
            key={clip.id}
            clip={clip}
            playhead={playhead}
            selected={clip.id === selectedClipId}
            isPrimary={clip.id === primary?.id}
            isPlaying={isPlaying}
            onSelect={() => selectClip(clip.id)}
          />
        ))}

        {activeTexts.map((clip) => {
          const text = clip.text || DEFAULT_TEXT();
          return (
            <Pressable
              key={clip.id}
              onPress={() => selectClip(clip.id)}
              style={[
                styles.textLayer,
                {
                  left: `${text.x * 100}%`,
                  top: `${text.y * 100}%`,
                  transform: [
                    { translateX: -50 },
                    { translateY: -50 },
                    { rotate: `${text.rotation}deg` },
                  ],
                  opacity: text.opacity,
                },
              ]}
            >
              <Text
                style={{
                  color: text.color,
                  fontSize: Math.max(14, text.fontSize * 0.22),
                  fontWeight: text.bold ? "800" : "600",
                  textAlign: text.align,
                }}
              >
                {text.content}
              </Text>
            </Pressable>
          );
        })}

        {!activeVideos.length && !activeTexts.length && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Add media to start</Text>
            <Text style={styles.emptySub}>Tap Media in the toolbar below</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function BlurPlate({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.pause();
  });
  return (
    <VideoView
      player={player}
      style={[StyleSheet.absoluteFill, { opacity: 0.55 }]}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function LayerVideo({
  clip,
  playhead,
  selected,
  isPrimary,
  isPlaying,
  onSelect,
}: {
  clip: TimelineClip;
  playhead: number;
  selected: boolean;
  isPrimary: boolean;
  isPlaying: boolean;
  onSelect: () => void;
}) {
  const uri = clip.previewPath || clip.mediaPath;
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = !isPrimary;
  });

  const local = Math.max(0, playhead - clip.start);
  const scale = lerp(clip.effects.scaleKeyframes || [], local, clip.effects.scale);
  const posX = lerp(clip.effects.posXKeyframes || [], local, clip.effects.posX ?? 0);
  const posY = lerp(clip.effects.posYKeyframes || [], local, clip.effects.posY ?? 0);
  const rot = lerp(
    clip.effects.rotationKeyframes || [],
    local,
    clip.effects.rotation,
  );

  useEffect(() => {
    player.muted = !isPrimary;
  }, [isPrimary, player]);

  useEffect(() => {
    const speed = Math.max(0.05, clip.effects.speed || 1);
    const mediaT =
      clip.inPoint + Math.max(0, playhead - clip.start) * speed;
    try {
      player.currentTime = Math.max(0, mediaT);
      if (isPlaying && isPrimary) player.play();
      else player.pause();
    } catch {
      /* ignore seek races */
    }
  }, [
    playhead,
    isPlaying,
    isPrimary,
    clip.inPoint,
    clip.start,
    clip.effects.speed,
    player,
  ]);

  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.layer,
        {
          transform: [
            { translateX: posX * 120 },
            { translateY: posY * 120 },
            { scale },
            { rotate: `${rot}deg` },
          ],
          borderColor: selected ? colors.accent : "transparent",
          zIndex: 1000 - clip.trackIndex,
        },
      ]}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  stage: {
    maxWidth: "100%",
    maxHeight: "100%",
    backgroundColor: "#000",
    overflow: "hidden",
  },
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: 2,
  },
  textLayer: {
    position: "absolute",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  empty: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: colors.textMuted, fontWeight: "700", fontSize: 14 },
  emptySub: { color: colors.textDim, fontSize: 12, marginTop: 4 },
});
