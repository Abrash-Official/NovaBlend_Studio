import { useEffect, useState } from "react";
import { extractMediaAudio, probeMedia } from "../lib/api";
import { useEditorStore } from "../store/editorStore";
import {
  BLEND_MODES,
  DEFAULT_EFFECTS,
  KeyframeProp,
  TimelineClip,
  isStillClip,
  isTextClip,
  keyframesFor,
} from "../types/editor";
import { NumberSlider } from "./ui/NumberSlider";
import { KeyframeButton } from "./ui/KeyframeButton";
import { IconAudio, IconCopy, IconTrash } from "./Icons";

type TabId = "video" | "audio" | "speed" | "color" | "mask";

function volumeToDb(v: number) {
  if (v <= 0.001) return "-∞";
  const db = 20 * Math.log10(v);
  return `${db >= 0 ? "+" : ""}${db.toFixed(1)}`;
}

export function ClipInspector({
  clip,
  locked,
}: {
  clip: TimelineClip;
  locked: boolean;
}) {
  const isMaskClip = clip.trackKind === "fx" && clip.effects?.effect === "mask";
  const [tab, setTab] = useState<TabId>(isMaskClip ? "mask" : "video");
  const [busy, setBusy] = useState(false);
  const [pendingShape, setPendingShape] = useState<
    "box" | "circle" | "rounded" | "square"
  >((clip.effects?.maskShape as "box" | "circle" | "rounded" | "square") || "box");

  useEffect(() => {
    setTab(isMaskClip ? "mask" : "video");
    setPendingShape(
      (clip.effects?.maskShape as "box" | "circle" | "rounded" | "square") ||
        "box",
    );
  }, [clip.id, isMaskClip, clip.effects?.maskShape]);
  const fx = { ...DEFAULT_EFFECTS(), ...clip.effects };
  const updateSelectedEffects = useEditorStore((s) => s.updateSelectedEffects);
  const updateClip = useEditorStore((s) => s.updateClip);
  const trimSelected = useEditorStore((s) => s.trimSelected);
  const duplicateClip = useEditorStore((s) => s.duplicateClip);
  const removeSelectedClip = useEditorStore((s) => s.removeSelectedClip);
  const addMedia = useEditorStore((s) => s.addMedia);
  const addClipFromMedia = useEditorStore((s) => s.addClipFromMedia);
  const addMaskClip = useEditorStore((s) => s.addMaskClip);
  const setStatus = useEditorStore((s) => s.setStatus);
  const bumpProcessing = useEditorStore((s) => s.bumpProcessing);
  const tracks = useEditorStore((s) => s.tracks);
  const playhead = useEditorStore((s) => s.playhead);
  const toggleKeyframe = useEditorStore((s) => s.toggleKeyframe);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const localT = Math.max(
    0,
    Math.min(clip.duration, playhead - clip.start),
  );

  function kfActive(prop: KeyframeProp) {
    return keyframesFor(fx, prop).some((k) => Math.abs(k.time - localT) <= 0.05);
  }

  function kfToggle(prop: KeyframeProp, value: number) {
    if (playhead < clip.start || playhead > clip.start + clip.duration) {
      setStatus("Move playhead onto this clip to set a keyframe");
      return;
    }
    pushHistory();
    toggleKeyframe(prop, localT, value);
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "video", label: "Video" },
    { id: "audio", label: "Audio" },
    { id: "speed", label: "Speed" },
    { id: "color", label: "Color" },
    { id: "mask", label: "Mask" },
  ];

  function resetTransform() {
    updateSelectedEffects({
      scale: 1,
      posX: 0,
      posY: 0,
      rotation: 0,
      opacity: 1,
      blendMode: "normal",
    });
  }

  function resetColor() {
    updateSelectedEffects({
      brightness: 0,
      contrast: 1,
      saturation: 1,
      sharpness: 0,
      temperature: 0,
      tint: 0,
      vignetteAmount: 0,
      softBlur: 0,
    });
  }

  async function extractAudio() {
    if (locked) {
      setStatus("Track is locked");
      return;
    }
    if (isTextClip(clip) || !clip.hasAudio || isStillClip(clip)) {
      setStatus("This clip has no audio to extract");
      return;
    }
    const src = clip.mediaPath || clip.previewPath;
    if (!src) {
      setStatus("No media path on this clip");
      return;
    }
    const videoId = clip.id;
    const videoStart = clip.start;
    const videoDuration = clip.duration;
    const videoIn = clip.inPoint;
    const videoOut = clip.outPoint;
    const videoVol = clip.effects?.volume ?? 1;

    setBusy(true);
    bumpProcessing(1);
    setStatus("Extracting audio onto A1…");
    try {
      const audioPath = await extractMediaAudio({
        path: src,
        inPoint: videoIn,
        outPoint: videoOut,
      });
      const probe = await probeMedia(audioPath);
      const id = `media_${Math.random().toString(36).slice(2, 10)}`;
      const name = `${clip.name.replace(/\.[^.]+$/, "") || "Clip"} · audio`;
      const audioDur =
        probe.duration || Math.max(0.05, videoOut - videoIn);
      addMedia({
        id,
        name,
        path: probe.path || audioPath,
        previewPath: probe.path || audioPath,
        duration: audioDur,
        width: 0,
        height: 0,
        hasVideo: false,
        hasAudio: true,
        codec: probe.codec || "mp3",
        fps: 0,
        readyState: "ready",
        statusMessage: "Ready",
        progressPercent: 100,
      });
      const audioTrack = tracks.find((t) => t.kind === "audio")?.index ?? 3;
      addClipFromMedia(id, audioTrack);

      // Align extracted clip to the video, mute/detach audio from V1
      const state = useEditorStore.getState();
      const audioClip = state.clips.find((c) => c.id === state.selectedClipId);
      if (audioClip && audioClip.trackKind === "audio") {
        const matchSpeed = Math.max(
          0.05,
          audioDur / Math.max(0.05, videoDuration),
        );
        updateClip(audioClip.id, {
          start: videoStart,
          inPoint: 0,
          outPoint: audioDur,
          effects: {
            ...DEFAULT_EFFECTS(),
            ...audioClip.effects,
            volume: videoVol > 0.01 ? videoVol : 1,
            speed: matchSpeed,
          },
        });
      }
      updateClip(videoId, {
        hasAudio: false,
        effects: {
          ...DEFAULT_EFFECTS(),
          ...clip.effects,
          volume: 0,
        },
      });
      if (audioClip) state.selectClip(audioClip.id);
      setStatus(`Audio on A1 · video sound removed from V1`);
      setTab("audio");
    } catch (e) {
      setStatus(`Extract failed: ${e}`);
    } finally {
      bumpProcessing(-1);
      setBusy(false);
    }
  }

  const srcDur = Math.max(0.05, clip.outPoint - clip.inPoint);
  const timelineDur = clip.duration;
  const shape =
    (fx.maskShape as "box" | "circle" | "rounded" | "square") || "box";
  const hasMask = isMaskClip || fx.maskEnabled;

  return (
    <aside className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-2 py-2">
        <span className="inspector-badge">{isMaskClip ? "Mask" : "Video"}</span>
        <div className="min-w-0 flex-1 truncate text-[12px] font-medium" title={clip.name}>
          {clip.name}
        </div>
        <button
          type="button"
          className="btn btn-ghost h-7 w-7 p-0"
          title="Duplicate (Ctrl+D)"
          disabled={locked}
          onClick={() => duplicateClip(clip.id)}
        >
          <IconCopy size={13} />
        </button>
        <button
          type="button"
          className="btn btn-icon btn-danger h-7 w-7 p-0"
          title="Delete (Del)"
          disabled={locked}
          onClick={() => removeSelectedClip()}
        >
          <IconTrash size={13} />
        </button>
      </div>

      <div className="inspector-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`inspector-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className={`flex-1 overflow-auto p-3 ${locked ? "pointer-events-none opacity-55" : ""}`}
      >
        {locked && (
          <p className="mb-2 text-[11px] text-[var(--warn)]">
            Track locked — unlock to edit.
          </p>
        )}

        {tab === "video" && (
          <>
            <div className="inspector-card">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Transform &amp; Position
                </div>
                <button type="button" className="btn btn-ghost text-[10px]" onClick={resetTransform}>
                  Reset
                </button>
              </div>
              <NumberSlider
                label="Scale"
                min={0.1}
                max={3}
                step={0.01}
                value={fx.scale}
                format={(v) => String(Math.round(v * 100))}
                parse={(raw) => {
                  const n = Number(raw);
                  return Number.isFinite(n) ? n / 100 : null;
                }}
                suffix="%"
                onChange={(scale) => updateSelectedEffects({ scale })}
                endSlot={
                  <KeyframeButton
                    active={kfActive("scale")}
                    disabled={locked}
                    onClick={() => kfToggle("scale", fx.scale)}
                  />
                }
              />
              <NumberSlider
                label="Pos X"
                min={-0.5}
                max={0.5}
                step={0.01}
                value={fx.posX ?? 0}
                format={(v) => String(Math.round(v * 100))}
                parse={(raw) => {
                  const n = Number(raw);
                  return Number.isFinite(n) ? n / 100 : null;
                }}
                suffix="%"
                onChange={(posX) => updateSelectedEffects({ posX })}
                endSlot={
                  <KeyframeButton
                    active={kfActive("posX")}
                    disabled={locked}
                    onClick={() => kfToggle("posX", fx.posX ?? 0)}
                  />
                }
              />
              <NumberSlider
                label="Pos Y"
                min={-0.5}
                max={0.5}
                step={0.01}
                value={fx.posY ?? 0}
                format={(v) => String(Math.round(v * 100))}
                parse={(raw) => {
                  const n = Number(raw);
                  return Number.isFinite(n) ? n / 100 : null;
                }}
                suffix="%"
                onChange={(posY) => updateSelectedEffects({ posY })}
                endSlot={
                  <KeyframeButton
                    active={kfActive("posY")}
                    disabled={locked}
                    onClick={() => kfToggle("posY", fx.posY ?? 0)}
                  />
                }
              />
              <div className="mb-3 flex flex-wrap gap-1">
                {(
                  [
                    ["Center", 0, 0],
                    ["Left", -0.25, 0],
                    ["Right", 0.25, 0],
                    ["Top", 0, -0.25],
                    ["Bottom", 0, 0.25],
                  ] as const
                ).map(([label, x, y]) => (
                  <button
                    key={label}
                    type="button"
                    className="btn text-[10px]"
                    onClick={() => updateSelectedEffects({ posX: x, posY: y })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <NumberSlider
                label="Rotation"
                min={-180}
                max={180}
                step={1}
                value={fx.rotation}
                format={(v) => String(Math.round(v))}
                suffix="°"
                onChange={(rotation) => updateSelectedEffects({ rotation })}
                endSlot={
                  <KeyframeButton
                    active={kfActive("rotation")}
                    disabled={locked}
                    onClick={() => kfToggle("rotation", fx.rotation)}
                  />
                }
              />
              <NumberSlider
                label="Opacity"
                min={0}
                max={1}
                step={0.01}
                value={fx.opacity}
                format={(v) => String(Math.round(v * 100))}
                parse={(raw) => {
                  const n = Number(raw);
                  return Number.isFinite(n) ? n / 100 : null;
                }}
                suffix="%"
                onChange={(opacity) => updateSelectedEffects({ opacity })}
                endSlot={
                  <KeyframeButton
                    active={kfActive("opacity")}
                    disabled={locked}
                    onClick={() => kfToggle("opacity", fx.opacity)}
                  />
                }
              />
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Diamond adds/removes a keyframe at the playhead for that property.
              </p>
            </div>

            <div className="inspector-card mt-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Blend Mode
              </div>
              <div className="grid grid-cols-2 gap-1">
                {BLEND_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`btn text-[10px] capitalize ${fx.blendMode === m ? "btn-accent" : ""}`}
                    onClick={() => updateSelectedEffects({ blendMode: m })}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="inspector-card mt-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Flip
              </div>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={fx.mirrorH}
                    onChange={(e) =>
                      updateSelectedEffects({ mirrorH: e.target.checked })
                    }
                  />
                  Mirror H
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={fx.mirrorV}
                    onChange={(e) =>
                      updateSelectedEffects({ mirrorV: e.target.checked })
                    }
                  />
                  Flip V
                </label>
              </div>
            </div>

            <div className="inspector-card mt-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Trim
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button className="btn" onClick={() => trimSelected("in", 0.1)}>
                  In +0.1
                </button>
                <button className="btn" onClick={() => trimSelected("in", -0.1)}>
                  In −0.1
                </button>
                <button className="btn" onClick={() => trimSelected("out", 0.1)}>
                  Out +0.1
                </button>
                <button className="btn" onClick={() => trimSelected("out", -0.1)}>
                  Out −0.1
                </button>
              </div>
            </div>
          </>
        )}

        {tab === "audio" && (
          <div className="inspector-card">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Audio Adjustments
            </div>
            {!clip.hasAudio ? (
              <div className="mb-3 rounded border border-[var(--line)] bg-[var(--bg-1)] px-2 py-2 text-[11px] text-[var(--muted)]">
                Video sound detached — edit the clip on <strong>A1</strong> for
                volume, voice changer, and speed. Waveform no longer shows on V1.
                <button
                  type="button"
                  className="btn mt-2 w-full justify-center"
                  onClick={() =>
                    updateClip(clip.id, {
                      hasAudio: true,
                      effects: { ...fx, volume: fx.volume < 0.01 ? 1 : fx.volume },
                    })
                  }
                >
                  Restore video audio
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-accent mb-3 w-full justify-center gap-2"
                disabled={busy || isStillClip(clip)}
                onClick={() => void extractAudio()}
              >
                <IconAudio size={14} />
                {busy ? "Extracting…" : "Extract Audio to Track"}
              </button>
            )}
            {clip.hasAudio && (
              <>
                <NumberSlider
                  label="Volume"
                  min={0}
                  max={2}
                  step={0.01}
                  value={fx.volume ?? 1}
                  format={(v) => volumeToDb(v)}
                  parse={(raw) => {
                    const cleaned = raw.replace(/[^\d.\-+eE]/g, "").trim();
                    if (cleaned === "" || cleaned === "-∞" || cleaned === "-Inf")
                      return 0;
                    const n = Number(cleaned);
                    if (!Number.isFinite(n)) return null;
                    return Math.pow(10, n / 20);
                  }}
                  suffix="dB"
                  onChange={(volume) => updateSelectedEffects({ volume })}
                />
                <button
                  type="button"
                  className={`btn mb-3 w-full ${fx.volume < 0.01 ? "btn-accent" : ""}`}
                  onClick={() =>
                    updateSelectedEffects({
                      volume: (fx.volume ?? 1) < 0.01 ? 1 : 0,
                    })
                  }
                >
                  {(fx.volume ?? 1) < 0.01 ? "Unmute Audio" : "Mute Audio"}
                </button>
                <NumberSlider
                  label="Fade In"
                  min={0}
                  max={3}
                  step={0.05}
                  value={fx.audioFadeIn ?? 0}
                  suffix="s"
                  onChange={(audioFadeIn) =>
                    updateSelectedEffects({ audioFadeIn })
                  }
                />
                <NumberSlider
                  label="Fade Out"
                  min={0}
                  max={3}
                  step={0.05}
                  value={fx.audioFadeOut ?? 0}
                  suffix="s"
                  onChange={(audioFadeOut) =>
                    updateSelectedEffects({ audioFadeOut })
                  }
                />
              </>
            )}
          </div>
        )}

        {tab === "speed" && (
          <div className="inspector-card">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Speed &amp; Duration
              </div>
              <span className="font-[var(--font-mono)] text-[11px]">
                {fx.speed.toFixed(2)}x
              </span>
            </div>
            <NumberSlider
              label="Playback Speed"
              min={0.25}
              max={4}
              step={0.01}
              value={fx.speed}
              suffix="x"
              onChange={(speed) => {
                updateSelectedEffects({ speed });
                updateClip(clip.id, {
                  duration: srcDur / Math.max(0.05, speed),
                });
              }}
            />
            <div className="mb-3 flex flex-wrap gap-1">
              {[0.5, 0.7, 0.75, 1, 1.5, 2].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`btn text-[10px] ${Math.abs(fx.speed - s) < 0.005 ? "btn-accent" : ""}`}
                  onClick={() => {
                    updateSelectedEffects({ speed: s });
                    updateClip(clip.id, { duration: srcDur / s });
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
            <div className="mb-3 space-y-1 text-[11px] text-[var(--muted)]">
              <div className="flex justify-between">
                <span>Source</span>
                <span className="font-[var(--font-mono)]">{srcDur.toFixed(2)}s</span>
              </div>
              <div className="flex justify-between">
                <span>Timeline</span>
                <span className="font-[var(--font-mono)] text-[var(--accent)]">
                  {timelineDur.toFixed(2)}s
                </span>
              </div>
            </div>
            <label className="flex items-center justify-between text-xs">
              <span>Reverse clip</span>
              <input
                type="checkbox"
                checked={fx.reverse}
                onChange={(e) =>
                  updateSelectedEffects({ reverse: e.target.checked })
                }
              />
            </label>
          </div>
        )}

        {tab === "color" && (
          <div className="inspector-card">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Color Adjustments
              </div>
              <button type="button" className="btn btn-ghost text-[10px]" onClick={resetColor}>
                Reset
              </button>
            </div>
            <NumberSlider
              label="Exposure"
              min={-0.5}
              max={0.5}
              step={0.01}
              value={fx.brightness}
              onChange={(brightness) => updateSelectedEffects({ brightness })}
            />
            <NumberSlider
              label="Contrast"
              min={0.4}
              max={2.2}
              step={0.01}
              value={fx.contrast}
              onChange={(contrast) => updateSelectedEffects({ contrast })}
            />
            <NumberSlider
              label="Saturation"
              min={0}
              max={2.5}
              step={0.01}
              value={fx.saturation}
              onChange={(saturation) => updateSelectedEffects({ saturation })}
            />
            <NumberSlider
              label="Temp"
              min={-1}
              max={1}
              step={0.01}
              value={fx.temperature ?? 0}
              onChange={(temperature) => updateSelectedEffects({ temperature })}
            />
            <NumberSlider
              label="Tint"
              min={-1}
              max={1}
              step={0.01}
              value={fx.tint ?? 0}
              onChange={(tint) => updateSelectedEffects({ tint })}
            />
            <NumberSlider
              label="Sharpness"
              min={0}
              max={2}
              step={0.01}
              value={fx.sharpness ?? 0}
              onChange={(sharpness) => updateSelectedEffects({ sharpness })}
            />
            <NumberSlider
              label="Vignette"
              min={0}
              max={1}
              step={0.01}
              value={fx.vignetteAmount ?? 0}
              format={(v) => String(Math.round(v * 100))}
              parse={(raw) => {
                const n = Number(raw);
                return Number.isFinite(n) ? n / 100 : null;
              }}
              suffix="%"
              onChange={(vignetteAmount) =>
                updateSelectedEffects({ vignetteAmount })
              }
            />
            <NumberSlider
              label="Blur"
              min={0}
              max={12}
              step={0.1}
              value={fx.softBlur ?? 0}
              suffix="px"
              onChange={(softBlur) => updateSelectedEffects({ softBlur })}
            />
          </div>
        )}

        {tab === "mask" && (
          <div className="inspector-card">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Masking
              </div>
              <span
                className={`text-[10px] font-semibold ${hasMask ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
              >
                {hasMask ? "On timeline" : "Off"}
              </span>
            </div>

            {!hasMask ? (
              <>
                <p className="mb-3 text-[11px] text-[var(--muted)]">
                  Pick a shape, then add a mask clip on the FX track (F1). Trim it on the timeline like any other clip.
                </p>
                <div className="mb-3 text-[11px] font-semibold text-[var(--muted)]">
                  Shape
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["box", "Rect"],
                      ["square", "Square"],
                      ["rounded", "Round"],
                      ["circle", "Circle"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`mask-shape-btn ${pendingShape === id ? "active" : ""}`}
                      onClick={() => setPendingShape(id)}
                      title={label}
                    >
                      <span className={`mask-shape-icon ${id}`} />
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-accent w-full justify-center"
                  onClick={() => addMaskClip(pendingShape)}
                >
                  + Add Mask
                </button>
              </>
            ) : (
              <>
                <div className="mb-3 text-[11px] font-semibold text-[var(--muted)]">
                  Shape
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["box", "Rect"],
                      ["square", "Square"],
                      ["rounded", "Round"],
                      ["circle", "Circle"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`mask-shape-btn ${shape === id ? "active" : ""}`}
                      onClick={() => {
                        updateSelectedEffects({
                          maskShape: id,
                          maskEnabled: true,
                          effect: isMaskClip ? "mask" : fx.effect,
                        });
                        if (isMaskClip) {
                          updateClip(clip.id, {
                            name: `Mask · ${label}`,
                          });
                        }
                      }}
                      title={label}
                    >
                      <span className={`mask-shape-icon ${id}`} />
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mb-2 text-[11px] text-[var(--muted)]">
                  Drag crop edges on the preview (Crop tool), or use the sliders below.
                </p>
                <NumberSlider
                  label="Feather"
                  min={0}
                  max={40}
                  step={1}
                  value={fx.maskFeather}
                  onChange={(maskFeather) =>
                    updateSelectedEffects({ maskFeather, maskEnabled: true })
                  }
                />
                <div className="field-label">Crop window</div>
                <NumberSlider
                  label="Crop X"
                  min={0}
                  max={0.4}
                  step={0.01}
                  value={fx.cropX}
                  onChange={(cropX) => updateSelectedEffects({ cropX })}
                />
                <NumberSlider
                  label="Crop Y"
                  min={0}
                  max={0.4}
                  step={0.01}
                  value={fx.cropY}
                  onChange={(cropY) => updateSelectedEffects({ cropY })}
                />
                <NumberSlider
                  label="Crop W"
                  min={0.4}
                  max={1}
                  step={0.01}
                  value={fx.cropW}
                  onChange={(cropW) => updateSelectedEffects({ cropW })}
                />
                <NumberSlider
                  label="Crop H"
                  min={0.4}
                  max={1}
                  step={0.01}
                  value={fx.cropH}
                  onChange={(cropH) => updateSelectedEffects({ cropH })}
                />
                {isMaskClip && (
                  <button
                    type="button"
                    className="btn btn-danger mt-2 w-full justify-center"
                    onClick={() => removeSelectedClip()}
                  >
                    Remove Mask from Timeline
                  </button>
                )}
                {!isMaskClip && (
                  <button
                    type="button"
                    className="btn mt-2 w-full justify-center"
                    onClick={() =>
                      updateSelectedEffects({
                        maskEnabled: false,
                        maskShape: "box",
                      })
                    }
                  >
                    Disable Clip Mask
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
