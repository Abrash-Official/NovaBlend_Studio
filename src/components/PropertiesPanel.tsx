import { useEditorStore } from "../store/editorStore";
import { EFFECT_PRESETS } from "../types/editor";

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-[var(--muted)]">{label}</span>
        <span className="font-[var(--font-mono)]">{value.toFixed(2)}</span>
      </div>
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function PropertiesPanel() {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const clips = useEditorStore((s) => s.clips);
  const updateSelectedEffects = useEditorStore((s) => s.updateSelectedEffects);
  const updateClip = useEditorStore((s) => s.updateClip);
  const trimSelected = useEditorStore((s) => s.trimSelected);
  const addKeyframe = useEditorStore((s) => s.addKeyframe);
  const playhead = useEditorStore((s) => s.playhead);

  const clip = clips.find((c) => c.id === selectedClipId);
  const fx = clip?.effects;

  if (!clip || !fx) {
    return (
      <aside className="panel flex h-full flex-col overflow-hidden rounded-xl">
        <div className="border-b border-[var(--line)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Properties
        </div>
        <div className="p-4 text-sm text-[var(--muted)]">
          Select a clip on the timeline to edit properties, filters, and keyframes.
        </div>
      </aside>
    );
  }

  const localTime = Math.max(0, playhead - clip.start);

  return (
    <aside className="panel flex h-full flex-col overflow-hidden rounded-xl">
      <div className="border-b border-[var(--line)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Properties
      </div>
      <div className="flex-1 overflow-auto p-3">
        <div className="mb-3 truncate text-sm font-semibold">{clip.name}</div>

        <div className="field-label">Trim</div>
        <div className="mb-3 flex gap-2">
          <button className="btn flex-1" onClick={() => trimSelected("in", 0.1)}>
            In +0.1
          </button>
          <button className="btn flex-1" onClick={() => trimSelected("in", -0.1)}>
            In −0.1
          </button>
        </div>
        <div className="mb-4 flex gap-2">
          <button className="btn flex-1" onClick={() => trimSelected("out", 0.1)}>
            Out +0.1
          </button>
          <button className="btn flex-1" onClick={() => trimSelected("out", -0.1)}>
            Out −0.1
          </button>
        </div>

        <SliderRow
          label="Speed"
          min={0.25}
          max={4}
          step={0.05}
          value={fx.speed}
          onChange={(speed) => {
            updateSelectedEffects({ speed });
            const srcDur = clip.outPoint - clip.inPoint;
            updateClip(clip.id, { duration: srcDur / Math.max(0.05, speed) });
          }}
        />
        <SliderRow
          label="Scale"
          min={0.1}
          max={3}
          step={0.01}
          value={fx.scale}
          onChange={(scale) => updateSelectedEffects({ scale })}
        />
        <SliderRow
          label="Rotation"
          min={-180}
          max={180}
          step={1}
          value={fx.rotation}
          onChange={(rotation) => updateSelectedEffects({ rotation })}
        />
        <SliderRow
          label="Opacity"
          min={0}
          max={1}
          step={0.01}
          value={fx.opacity}
          onChange={(opacity) => updateSelectedEffects({ opacity })}
        />
        <SliderRow
          label="Brightness"
          min={-0.5}
          max={0.5}
          step={0.01}
          value={fx.brightness}
          onChange={(brightness) => updateSelectedEffects({ brightness })}
        />
        <SliderRow
          label="Contrast"
          min={0.5}
          max={2}
          step={0.01}
          value={fx.contrast}
          onChange={(contrast) => updateSelectedEffects({ contrast })}
        />
        <SliderRow
          label="Saturation"
          min={0}
          max={2}
          step={0.01}
          value={fx.saturation}
          onChange={(saturation) => updateSelectedEffects({ saturation })}
        />
        <SliderRow
          label="Motion Blur"
          min={0}
          max={1}
          step={0.01}
          value={fx.motionBlur}
          onChange={(motionBlur) => updateSelectedEffects({ motionBlur })}
        />

        <div className="field-label">Crop</div>
        <SliderRow
          label="Crop X"
          min={0}
          max={0.5}
          step={0.01}
          value={fx.cropX}
          onChange={(cropX) => updateSelectedEffects({ cropX })}
        />
        <SliderRow
          label="Crop Y"
          min={0}
          max={0.5}
          step={0.01}
          value={fx.cropY}
          onChange={(cropY) => updateSelectedEffects({ cropY })}
        />
        <SliderRow
          label="Crop W"
          min={0.5}
          max={1}
          step={0.01}
          value={fx.cropW}
          onChange={(cropW) => updateSelectedEffects({ cropW })}
        />
        <SliderRow
          label="Crop H"
          min={0.5}
          max={1}
          step={0.01}
          value={fx.cropH}
          onChange={(cropH) => updateSelectedEffects({ cropH })}
        />

        {clip.trackIndex > 0 && clip.trackKind === "video" && (
          <>
            <div className="field-label">Picture-in-Picture</div>
            <SliderRow
              label="PiP X"
              min={0}
              max={0.7}
              step={0.01}
              value={fx.pipX}
              onChange={(pipX) => updateSelectedEffects({ pipX })}
            />
            <SliderRow
              label="PiP Y"
              min={0}
              max={0.7}
              step={0.01}
              value={fx.pipY}
              onChange={(pipY) => updateSelectedEffects({ pipY })}
            />
          </>
        )}

        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={fx.mirrorH}
              onChange={(e) => updateSelectedEffects({ mirrorH: e.target.checked })}
            />
            Mirror H
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={fx.mirrorV}
              onChange={(e) => updateSelectedEffects({ mirrorV: e.target.checked })}
            />
            Mirror V / Flip
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={fx.reverse}
              onChange={(e) => updateSelectedEffects({ reverse: e.target.checked })}
            />
            Reverse
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={fx.maskEnabled}
              onChange={(e) => updateSelectedEffects({ maskEnabled: e.target.checked })}
            />
            Mask
          </label>
        </div>

        {fx.maskEnabled && (
          <SliderRow
            label="Mask Feather"
            min={0}
            max={40}
            step={1}
            value={fx.maskFeather}
            onChange={(maskFeather) => updateSelectedEffects({ maskFeather })}
          />
        )}

        <div className="field-label">Effect</div>
        <select
          className="btn mb-4 w-full"
          value={fx.effect}
          onChange={(e) => updateSelectedEffects({ effect: e.target.value })}
        >
          {EFFECT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <div className="field-label">Keyframes</div>
        <div className="mb-2 text-[11px] text-[var(--muted)]">
          At local time {localTime.toFixed(2)}s
        </div>
        <div className="flex flex-col gap-2">
          <button
            className="btn"
            onClick={() => addKeyframe("scale", localTime, fx.scale)}
          >
            Set Scale Keyframe
          </button>
          <button
            className="btn"
            onClick={() => addKeyframe("opacity", localTime, fx.opacity)}
          >
            Set Opacity Keyframe
          </button>
          <div className="text-[11px] text-[var(--muted)]">
            Scale keys: {fx.scaleKeyframes.length} · Opacity keys:{" "}
            {fx.opacityKeyframes.length}
          </div>
        </div>
      </div>
    </aside>
  );
}
