import { ReactNode, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import {
  DEFAULT_TEXT,
  EFFECT_PRESETS,
  EFFECT_TUNE_DEFAULTS,
  effectsForLook,
  isFxClip,
  isTextClip,
  TEXT_FONTS,
  TextAlign,
  TextStyle,
} from "../types/editor";
import { IconText, IconTrash } from "./Icons";

type TextSectionId =
  | "content"
  | "font"
  | "color"
  | "shadow"
  | "position"
  | "timing";

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

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const hex = value.startsWith("#") ? value.slice(0, 7) : "#ffffff";
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer border border-[var(--line)] bg-transparent p-0"
          style={{ borderRadius: "var(--radius)" }}
        />
        <input
          className="btn w-[88px] px-1 font-[var(--font-mono)] text-[11px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function TextSection({
  id,
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  id: TextSectionId;
  title: string;
  hint: string;
  open: boolean;
  onToggle: (id: TextSectionId) => void;
  children: ReactNode;
}) {
  return (
    <div className={`prop-section${open ? " open" : ""}`}>
      <button
        type="button"
        className="prop-section-head"
        onClick={() => onToggle(id)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1 text-left">
          <div className="prop-section-title">{title}</div>
          <div className="prop-section-hint">{hint}</div>
        </div>
        <span className="prop-section-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && <div className="prop-section-body">{children}</div>}
    </div>
  );
}

function TextPropertiesPanel({
  clipName,
  duration,
  text,
  locked,
  updateSelectedText,
  trimSelected,
  addTextClip,
  removeSelectedClip,
}: {
  clipName: string;
  duration: number;
  text: TextStyle;
  locked: boolean;
  updateSelectedText: (patch: Partial<TextStyle>) => void;
  trimSelected: (edge: "in" | "out", delta: number) => void;
  addTextClip: () => void;
  removeSelectedClip: () => void;
}) {
  // Only one section open at a time — keeps the panel calm
  const [openSection, setOpenSection] = useState<TextSectionId>("content");

  function toggle(id: TextSectionId) {
    setOpenSection(id);
  }

  function patchText(p: Partial<TextStyle>) {
    if (locked) return;
    updateSelectedText(p);
  }

  const fontHint = `${text.fontFamily} · ${Math.round(text.fontSize)}px${text.bold ? " · Bold" : ""}${text.italic ? " · Italic" : ""}`;
  const colorHint = `Fill · stroke ${text.strokeWidth > 0 ? "on" : "off"}`;
  const shadowHint =
    text.backgroundOpacity > 0.01
      ? "Shadow + highlight box"
      : text.shadowBlur > 0
        ? "Shadow on"
        : "Shadow / highlight";
  const posHint = `Pos ${(text.x * 100).toFixed(0)}%,${(text.y * 100).toFixed(0)}% · ${text.rotation}°`;

  return (
    <aside className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-2 py-2 sm:px-3">
        <IconText size={14} className="shrink-0" />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Text Properties
          </div>
          <div className="truncate text-[11px] text-[var(--muted)]" title={clipName}>
            {clipName}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-icon btn-danger h-7 w-7 shrink-0 p-0"
          title={locked ? "Unlock track to delete" : "Delete text clip (Del)"}
          disabled={locked}
          onClick={() => removeSelectedClip()}
        >
          <IconTrash size={13} />
        </button>
      </div>

      <div className={`flex-1 overflow-auto p-2 ${locked ? "pointer-events-none opacity-55" : ""}`}>
        {locked && (
          <p className="prop-guide mb-2 px-1 text-[var(--warn)]">
            Track locked — unlock T1 on the timeline to edit.
          </p>
        )}
        <p className="prop-guide mb-2 px-1">
          Open one section at a time. Drag text on the preview to place it.
        </p>

        <TextSection
          id="content"
          title="1 · Content"
          hint="What the text says · emoji"
          open={openSection === "content"}
          onToggle={toggle}
        >
          <textarea
            className="btn mb-2 min-h-[72px] w-full resize-y text-left"
            value={text.content}
            onChange={(e) => patchText({ content: e.target.value })}
            placeholder="Type your text…"
          />
          <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">
            Quick emoji
          </div>
          <div className="flex flex-wrap gap-1">
            {["🔥", "✨", "❤️", "😂", "🎉", "⭐", "👏", "💯"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="btn px-2 text-sm"
                title="Insert emoji"
                onClick={() =>
                  patchText({ content: `${text.content}${emoji}` })
                }
              >
                {emoji}
              </button>
            ))}
          </div>
        </TextSection>

        <TextSection
          id="font"
          title="2 · Font & style"
          hint={fontHint}
          open={openSection === "font"}
          onToggle={toggle}
        >
          <div className="field-label">Font family</div>
          <select
            className="btn mb-3 w-full"
            value={text.fontFamily}
            onChange={(e) => patchText({ fontFamily: e.target.value })}
          >
            {TEXT_FONTS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </select>

          <SliderRow
            label="Size"
            min={12}
            max={220}
            step={1}
            value={text.fontSize}
            onChange={(fontSize) => patchText({ fontSize })}
          />

          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`btn ${text.bold ? "btn-accent" : ""}`}
              onClick={() => patchText({ bold: !text.bold })}
            >
              Bold
            </button>
            <button
              type="button"
              className={`btn italic ${text.italic ? "btn-accent" : ""}`}
              onClick={() => patchText({ italic: !text.italic })}
            >
              Italic
            </button>
          </div>

          <div className="field-label">Align</div>
          <div className="mb-3 flex gap-1">
            {(["left", "center", "right"] as TextAlign[]).map((a) => (
              <button
                key={a}
                type="button"
                className={`btn flex-1 ${text.align === a ? "btn-accent" : ""}`}
                onClick={() => patchText({ align: a })}
              >
                {a}
              </button>
            ))}
          </div>

          <SliderRow
            label="Letter spacing"
            min={-4}
            max={40}
            step={0.5}
            value={text.letterSpacing}
            onChange={(letterSpacing) => patchText({ letterSpacing })}
          />
          <SliderRow
            label="Line height"
            min={0.8}
            max={2.5}
            step={0.05}
            value={text.lineHeight}
            onChange={(lineHeight) => patchText({ lineHeight })}
          />
        </TextSection>

        <TextSection
          id="color"
          title="3 · Color & outline"
          hint={colorHint}
          open={openSection === "color"}
          onToggle={toggle}
        >
          <ColorRow
            label="Fill color"
            value={text.color}
            onChange={(color) => patchText({ color })}
          />
          <ColorRow
            label="Outline color"
            value={text.strokeColor}
            onChange={(strokeColor) => patchText({ strokeColor })}
          />
          <SliderRow
            label="Outline width"
            min={0}
            max={24}
            step={0.5}
            value={text.strokeWidth}
            onChange={(strokeWidth) => patchText({ strokeWidth })}
          />
        </TextSection>

        <TextSection
          id="shadow"
          title="4 · Shadow & highlight"
          hint={shadowHint}
          open={openSection === "shadow"}
          onToggle={toggle}
        >
          <div className="field-label">Drop shadow</div>
          <ColorRow
            label="Shadow color"
            value={text.shadowColor.startsWith("#") ? text.shadowColor : "#000000"}
            onChange={(shadowColor) => patchText({ shadowColor })}
          />
          <SliderRow
            label="Blur"
            min={0}
            max={40}
            step={1}
            value={text.shadowBlur}
            onChange={(shadowBlur) => patchText({ shadowBlur })}
          />
          <SliderRow
            label="Offset X"
            min={-30}
            max={30}
            step={1}
            value={text.shadowOffsetX}
            onChange={(shadowOffsetX) => patchText({ shadowOffsetX })}
          />
          <SliderRow
            label="Offset Y"
            min={-30}
            max={30}
            step={1}
            value={text.shadowOffsetY}
            onChange={(shadowOffsetY) => patchText({ shadowOffsetY })}
          />

          <div className="field-label mt-1">Highlight box</div>
          <p className="mb-2 text-[11px] text-[var(--muted)]">
            Soft background behind the text — raise opacity to show it.
          </p>
          <ColorRow
            label="Box color"
            value={text.backgroundColor}
            onChange={(backgroundColor) => patchText({ backgroundColor })}
          />
          <SliderRow
            label="Box opacity"
            min={0}
            max={1}
            step={0.01}
            value={text.backgroundOpacity}
            onChange={(backgroundOpacity) =>
              patchText({ backgroundOpacity })
            }
          />
        </TextSection>

        <TextSection
          id="position"
          title="5 · Position & look"
          hint={posHint}
          open={openSection === "position"}
          onToggle={toggle}
        >
          <p className="mb-2 text-[11px] text-[var(--muted)]">
            Tip: drag on the preview for placement; use the top handle to rotate.
          </p>
          <SliderRow
            label="Position X"
            min={0}
            max={1}
            step={0.01}
            value={text.x}
            onChange={(x) => patchText({ x })}
          />
          <SliderRow
            label="Position Y"
            min={0}
            max={1}
            step={0.01}
            value={text.y}
            onChange={(y) => patchText({ y })}
          />
          <SliderRow
            label="Rotation"
            min={-180}
            max={180}
            step={1}
            value={text.rotation}
            onChange={(rotation) => patchText({ rotation })}
          />
          <SliderRow
            label="Opacity"
            min={0}
            max={1}
            step={0.01}
            value={text.opacity}
            onChange={(opacity) => patchText({ opacity })}
          />
        </TextSection>

        <TextSection
          id="timing"
          title="6 · Timing"
          hint={`${duration.toFixed(1)}s on timeline`}
          open={openSection === "timing"}
          onToggle={toggle}
        >
          <div className="mb-3 flex gap-2">
            <button className="btn flex-1" onClick={() => trimSelected("in", 0.1)}>
              In +0.1
            </button>
            <button className="btn flex-1" onClick={() => trimSelected("in", -0.1)}>
              In −0.1
            </button>
          </div>
          <div className="mb-2 flex gap-2">
            <button className="btn flex-1" onClick={() => trimSelected("out", 0.1)}>
              Out +0.1
            </button>
            <button className="btn flex-1" onClick={() => trimSelected("out", -0.1)}>
              Out −0.1
            </button>
          </div>
          <div className="text-[11px] text-[var(--muted)]">
            Or drag clip edges on the timeline.
          </div>
        </TextSection>

        <button
          className="btn btn-icon btn-text-tool mt-2 w-full justify-center"
          onClick={() => addTextClip()}
        >
          <IconText size={14} />
          Add Another Text
        </button>
      </div>
    </aside>
  );
}

export function PropertiesPanel() {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const clips = useEditorStore((s) => s.clips);
  const updateSelectedEffects = useEditorStore((s) => s.updateSelectedEffects);
  const updateSelectedText = useEditorStore((s) => s.updateSelectedText);
  const updateClip = useEditorStore((s) => s.updateClip);
  const trimSelected = useEditorStore((s) => s.trimSelected);
  const addKeyframe = useEditorStore((s) => s.addKeyframe);
  const addTextClip = useEditorStore((s) => s.addTextClip);
  const removeSelectedClip = useEditorStore((s) => s.removeSelectedClip);
  const playhead = useEditorStore((s) => s.playhead);
  const tracks = useEditorStore((s) => s.tracks);

  const clip = clips.find((c) => c.id === selectedClipId);
  const fx = clip?.effects;

  if (!clip || !fx) {
    return (
      <aside className="panel flex h-full flex-col overflow-hidden">
        <div className="border-b border-[var(--line)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Properties
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="text-sm text-[var(--muted)]">
            Select a clip on the timeline, or add text to style titles on the preview.
          </div>
          <button className="btn btn-icon btn-text-tool w-full justify-center" onClick={() => addTextClip()}>
            <IconText size={14} />
            Add Text Overlay
          </button>
        </div>
      </aside>
    );
  }

  const localTime = Math.max(0, playhead - clip.start);

  if (isTextClip(clip)) {
    return (
      <TextPropertiesPanel
        clipName={clip.name}
        duration={clip.duration}
        text={clip.text || DEFAULT_TEXT()}
        locked={!!tracks.find((t) => t.index === clip.trackIndex)?.locked}
        updateSelectedText={updateSelectedText}
        trimSelected={trimSelected}
        addTextClip={addTextClip}
        removeSelectedClip={removeSelectedClip}
      />
    );
  }

  if (isFxClip(clip)) {
    const tune = EFFECT_TUNE_DEFAULTS[fx.effect] || EFFECT_TUNE_DEFAULTS.none;
    const locked = !!tracks.find((t) => t.index === clip.trackIndex)?.locked;

    return (
      <aside className="panel flex h-full flex-col overflow-hidden">
        <div className="border-b border-[var(--line)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          FX Layer
        </div>
        <div
          className={`flex-1 space-y-3 overflow-auto p-3 ${locked ? "pointer-events-none opacity-55" : ""}`}
        >
          <div className="truncate text-sm font-medium">{clip.name}</div>
          {locked ? (
            <div className="text-[11px] text-[var(--warn)]">
              Track locked — unlock F1 to edit values.
            </div>
          ) : (
            <div className="text-[11px] text-[var(--muted)]">
              Tune the math behind this look. Changes update the preview live.
            </div>
          )}

          <div className="field-label">Look</div>
          <select
            className="btn w-full"
            value={fx.effect}
            disabled={locked}
            onChange={(e) => {
              const id = e.target.value;
              const label =
                EFFECT_PRESETS.find((p) => p.id === id)?.label || id;
              updateClip(clip.id, {
                name: label,
                effects: effectsForLook(id),
              });
            }}
          >
            {EFFECT_PRESETS.filter((p) => p.id !== "none").map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <div className="rounded border border-[var(--line)] bg-[var(--bg-2)] p-2 text-[10px] text-[var(--muted)]">
            Look baseline · B {tune.brightness.toFixed(2)} · C {tune.contrast.toFixed(2)} · S{" "}
            {tune.saturation.toFixed(2)} · Sharp {tune.sharpness.toFixed(2)}
          </div>

          <div className="field-label">Filter Adjustment</div>
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
            min={0.4}
            max={2.2}
            step={0.01}
            value={fx.contrast}
            onChange={(contrast) => updateSelectedEffects({ contrast })}
          />
          <SliderRow
            label="Saturation"
            min={0}
            max={2.5}
            step={0.01}
            value={fx.saturation}
            onChange={(saturation) => updateSelectedEffects({ saturation })}
          />
          <SliderRow
            label="Sharpness"
            min={0}
            max={2}
            step={0.01}
            value={fx.sharpness ?? 0}
            onChange={(sharpness) => updateSelectedEffects({ sharpness })}
          />
          <SliderRow
            label="Temperature"
            min={-1}
            max={1}
            step={0.01}
            value={fx.temperature ?? 0}
            onChange={(temperature) => updateSelectedEffects({ temperature })}
          />
          <SliderRow
            label="Tint"
            min={-1}
            max={1}
            step={0.01}
            value={fx.tint ?? 0}
            onChange={(tint) => updateSelectedEffects({ tint })}
          />
          <SliderRow
            label="Vignette"
            min={0}
            max={1}
            step={0.01}
            value={fx.vignetteAmount ?? 0}
            onChange={(vignetteAmount) => updateSelectedEffects({ vignetteAmount })}
          />

          <button
            type="button"
            className="btn w-full"
            disabled={locked}
            onClick={() => {
              updateClip(clip.id, {
                effects: effectsForLook(fx.effect),
              });
            }}
          >
            Reset to look defaults
          </button>

          <div className="field-label">Duration {clip.duration.toFixed(2)}s</div>
          <div className="flex flex-wrap gap-1">
            <button className="btn" onClick={() => trimSelected("in", -0.1)}>
              In −0.1
            </button>
            <button className="btn" onClick={() => trimSelected("in", 0.1)}>
              In +0.1
            </button>
            <button className="btn" onClick={() => trimSelected("out", -0.1)}>
              Out −0.1
            </button>
            <button className="btn" onClick={() => trimSelected("out", 0.1)}>
              Out +0.1
            </button>
          </div>
          <button className="btn btn-danger w-full" onClick={removeSelectedClip}>
            Remove FX
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-1 border-b border-[var(--line)] px-3 py-2">
        <div className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Properties
        </div>
        <button
          className="btn btn-icon btn-text-tool h-7 w-7 p-0"
          title="Add text overlay"
          onClick={() => addTextClip()}
        >
          <IconText size={14} />
        </button>
        <button
          className="btn btn-icon btn-danger h-7 w-7 p-0"
          title="Delete selected clip"
          onClick={() => removeSelectedClip()}
        >
          <IconTrash size={13} />
        </button>
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
