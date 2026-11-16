import {
  DEFAULT_EFFECTS,
  EFFECT_PRESETS,
  STICKER_PRESETS,
  TRANSITION_PRESETS,
  cssFilterForEffect,
  type LibraryTool,
  type TextStyle,
} from "../types/editor";
import { useEditorStore } from "../store/editorStore";
import { MediaBin } from "./MediaBin";
import {
  IconCaptions,
  IconEffects,
  IconFilters,
  IconMedia,
  IconStickers,
  IconText,
  IconTransitions,
} from "./Icons";

const TOOLS: { id: LibraryTool; label: string; icon: typeof IconMedia }[] = [
  { id: "media", label: "Media", icon: IconMedia },
  { id: "text", label: "Text", icon: IconText },
  { id: "stickers", label: "Stickers", icon: IconStickers },
  { id: "effects", label: "Effects", icon: IconEffects },
  { id: "transitions", label: "Transitions", icon: IconTransitions },
  { id: "captions", label: "Captions", icon: IconCaptions },
  { id: "filters", label: "Filters", icon: IconFilters },
];

const TEXT_PRESETS: { label: string; tag: string; patch: Partial<TextStyle> }[] = [
  {
    label: "Title",
    tag: "Clean",
    patch: {
      content: "Title",
      fontSize: 72,
      bold: true,
      y: 0.22,
      strokeWidth: 3,
    },
  },
  {
    label: "Subtitle",
    tag: "Soft",
    patch: {
      content: "Subtitle",
      fontSize: 42,
      y: 0.35,
      color: "#e8eef8",
      strokeWidth: 2,
    },
  },
  {
    label: "Lower third",
    tag: "Bar",
    patch: {
      content: "Your name",
      fontSize: 36,
      y: 0.78,
      x: 0.28,
      align: "left",
      backgroundColor: "#0a1220",
      backgroundOpacity: 0.65,
      strokeWidth: 0,
    },
  },
];

const CAPTION_PRESETS: {
  label: string;
  tag: string;
  sample: string;
  patch: Partial<TextStyle>;
}[] = [
  {
    label: "Clean caption",
    tag: "Minimal",
    sample: "Caption text",
    patch: {
      content: "Caption text",
      fontSize: 40,
      y: 0.86,
      bold: true,
      strokeWidth: 4,
      strokeColor: "#000000",
      backgroundOpacity: 0,
      color: "#ffffff",
    },
  },
  {
    label: "Boxed caption",
    tag: "Social",
    sample: "Boxed caption",
    patch: {
      content: "Boxed caption",
      fontSize: 36,
      y: 0.84,
      bold: true,
      backgroundColor: "#000000",
      backgroundOpacity: 0.72,
      strokeWidth: 0,
      color: "#ffffff",
    },
  },
  {
    label: "Gaming yell",
    tag: "Viral",
    sample: "CLUTCH!",
    patch: {
      content: "CLUTCH!",
      fontSize: 64,
      y: 0.78,
      bold: true,
      color: "#ffe566",
      strokeColor: "#000000",
      strokeWidth: 5,
      backgroundOpacity: 0,
    },
  },
  {
    label: "Hormozi punch",
    tag: "Viral",
    sample: "THIS CHANGES EVERYTHING",
    patch: {
      content: "THIS CHANGES EVERYTHING",
      fontSize: 44,
      y: 0.82,
      bold: true,
      color: "#ffffff",
      backgroundColor: "#e11d48",
      backgroundOpacity: 1,
      strokeWidth: 0,
    },
  },
  {
    label: "Neon pop",
    tag: "3D Pop",
    sample: "LEVEL UP",
    patch: {
      content: "LEVEL UP",
      fontSize: 52,
      y: 0.8,
      bold: true,
      color: "#67e8f9",
      strokeColor: "#a855f7",
      strokeWidth: 3,
      shadowColor: "rgba(168,85,247,0.85)",
      shadowBlur: 16,
      backgroundOpacity: 0,
    },
  },
  {
    label: "Paper note",
    tag: "Clean",
    sample: "Quick tip…",
    patch: {
      content: "Quick tip…",
      fontSize: 38,
      y: 0.84,
      bold: true,
      color: "#1a1a1a",
      backgroundColor: "#fde68a",
      backgroundOpacity: 1,
      strokeWidth: 0,
      shadowBlur: 0,
    },
  },
];

function SceneThumb({ effectId }: { effectId: string }) {
  const css = cssFilterForEffect(effectId, DEFAULT_EFFECTS());
  return (
    <div className="filter-thumb" aria-hidden>
      <div className="filter-thumb-scene" style={{ filter: css }}>
        <div className="filter-thumb-sky" />
        <div className="filter-thumb-sun" />
        <div className="filter-thumb-mount a" />
        <div className="filter-thumb-mount b" />
        <div className="filter-thumb-water" />
        <div className="filter-thumb-tree left" />
        <div className="filter-thumb-tree right" />
      </div>
      {effectId === "vignette" && <div className="filter-thumb-vignette" />}
      {effectId === "none" && <div className="filter-thumb-none">Original</div>}
    </div>
  );
}

function CaptionCard({
  sample,
  patch,
  label,
  tag,
  onClick,
}: {
  sample: string;
  patch: Partial<TextStyle>;
  label: string;
  tag: string;
  onClick: () => void;
}) {
  const color = patch.color || "#fff";
  const bg = patch.backgroundColor || "#000";
  const bgOp = patch.backgroundOpacity ?? 0;
  const stroke = patch.strokeWidth || 0;
  return (
    <button type="button" className="caption-card" onClick={onClick}>
      <div className="caption-card-preview">
        <span
          className="caption-card-sample"
          style={{
            color,
            background: bgOp > 0.05 ? bg : "transparent",
            fontWeight: patch.bold ? 800 : 600,
            textShadow:
              stroke > 0
                ? `0 0 ${Math.max(2, stroke)}px ${patch.strokeColor || "#000"}, 0 2px 8px rgba(0,0,0,0.55)`
                : "0 2px 10px rgba(0,0,0,0.55)",
            boxShadow: bgOp > 0.05 ? "0 0 0 1px rgba(255,255,255,0.06)" : undefined,
          }}
        >
          {sample}
        </span>
      </div>
      <div className="caption-card-meta">
        <span className="caption-card-title">{label}</span>
        <span className="caption-card-tag">{tag}</span>
      </div>
    </button>
  );
}

function TransitionThumb({ id }: { id: string }) {
  return (
    <div className={`transition-thumb transition-thumb-${id}`} aria-hidden>
      <div className="transition-thumb-a" />
      <div className="transition-thumb-b" />
    </div>
  );
}

export function LeftLibrary() {
  const libraryTool = useEditorStore((s) => s.libraryTool);
  const setLibraryTool = useEditorStore((s) => s.setLibraryTool);
  const addTextClip = useEditorStore((s) => s.addTextClip);
  const addFxClip = useEditorStore((s) => s.addFxClip);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const clips = useEditorStore((s) => s.clips);
  const updateSelectedEffects = useEditorStore((s) => s.updateSelectedEffects);
  const setStatus = useEditorStore((s) => s.setStatus);

  const selected = clips.find((c) => c.id === selectedClipId);
  const activeFxId =
    selected?.trackKind === "fx"
      ? selected.effects.effect
      : selected?.trackKind === "video"
        ? selected.effects.effect
        : null;

  function applyEffect(effectId: string) {
    addFxClip(effectId);
  }

  function applyTransition(id: string) {
    if (!selected || selected.trackKind === "text" || selected.trackKind === "fx") {
      setStatus("Select a video clip for transitions");
      return;
    }
    const preset = TRANSITION_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    updateSelectedEffects({ fadeIn: preset.fadeIn, fadeOut: preset.fadeOut });
    setStatus(`Applied transition: ${preset.label}`);
  }

  return (
    <aside className="library-shell panel flex h-full min-h-0 overflow-hidden">
      <nav className="library-rail" aria-label="Library tools">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const active = libraryTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              className={`library-rail-btn ${active ? "active" : ""}`}
              title={tool.label}
              onClick={() => setLibraryTool(tool.id)}
            >
              <Icon size={16} />
              <span>{tool.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="library-panel min-h-0 flex-1 overflow-hidden">
        {libraryTool === "media" && <MediaBin embedded />}

        {libraryTool === "text" && (
          <div className="flex h-full flex-col">
            <div className="border-b border-[var(--line)] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Text
            </div>
            <div className="flex-1 space-y-2 overflow-auto p-2">
              <p className="text-[11px] text-[var(--muted)]">
                Click a preset — it lands on T1. Drag on preview to place.
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {TEXT_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="text-preset-card"
                    onClick={() => addTextClip(p.patch)}
                  >
                    <div className="text-preset-preview">
                      <span
                        style={{
                          fontSize: p.label === "Title" ? 18 : 14,
                          fontWeight: 700,
                          color: p.patch.color || "#fff",
                        }}
                      >
                        {p.patch.content}
                      </span>
                    </div>
                    <div className="caption-card-meta">
                      <span className="caption-card-title">{p.label}</span>
                      <span className="caption-card-tag">{p.tag}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-accent w-full"
                onClick={() => addTextClip()}
              >
                Blank text
              </button>
            </div>
          </div>
        )}

        {libraryTool === "stickers" && (
          <div className="flex h-full flex-col">
            <div className="border-b border-[var(--line)] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Stickers
            </div>
            <div className="grid grid-cols-4 gap-1.5 overflow-auto p-2">
              {STICKER_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="sticker-btn"
                  title={`Add ${emoji}`}
                  onClick={() =>
                    addTextClip({
                      content: emoji,
                      fontSize: 96,
                      y: 0.35,
                      strokeWidth: 0,
                      backgroundOpacity: 0,
                      shadowBlur: 8,
                    })
                  }
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {libraryTool === "effects" && (
          <div className="flex h-full flex-col">
            <div className="border-b border-[var(--line)] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Effects
            </div>
            <div className="flex-1 overflow-auto p-2">
              <p className="mb-2 text-[11px] text-[var(--muted)]">
                Adds a purple block on <strong>F1</strong> — trim length on the timeline.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {EFFECT_PRESETS.filter((p) => p.id !== "none").map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`lib-card ${activeFxId === p.id ? "active" : ""}`}
                    onClick={() => applyEffect(p.id)}
                  >
                    <SceneThumb effectId={p.id} />
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="text-left text-[11px] font-medium">{p.label}</span>
                      <span className="caption-card-tag">{p.group}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {libraryTool === "transitions" && (
          <div className="flex h-full flex-col">
            <div className="border-b border-[var(--line)] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Transitions
            </div>
            <div className="flex-1 space-y-1.5 overflow-auto p-2">
              <p className="mb-1 text-[11px] text-[var(--muted)]">
                Fade edges on the selected video clip.
              </p>
              {TRANSITION_PRESETS.map((p) => {
                const active =
                  !!selected &&
                  selected.trackKind === "video" &&
                  (selected.effects.fadeIn || 0) === p.fadeIn &&
                  (selected.effects.fadeOut || 0) === p.fadeOut;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`transition-card ${active ? "active" : ""}`}
                    onClick={() => applyTransition(p.id)}
                  >
                    <TransitionThumb id={p.id} />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="text-[12px] font-medium">{p.label}</div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {p.fadeIn || p.fadeOut
                          ? `In ${p.fadeIn}s · Out ${p.fadeOut}s`
                          : "No fade"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {libraryTool === "captions" && (
          <div className="flex h-full flex-col">
            <div className="border-b border-[var(--line)] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Captions
            </div>
            <div className="flex-1 space-y-2 overflow-auto p-2">
              <p className="text-[11px] text-[var(--muted)]">
                Styled subtitle presets — edit wording in Properties after adding.
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {CAPTION_PRESETS.map((p) => (
                  <CaptionCard
                    key={p.label}
                    {...p}
                    onClick={() => {
                      addTextClip(p.patch);
                      setLibraryTool("captions");
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {libraryTool === "filters" && (
          <div className="flex h-full flex-col">
            <div className="border-b border-[var(--line)] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Filters
            </div>
            <div className="flex-1 overflow-auto p-2">
              <p className="mb-2 text-[11px] text-[var(--muted)]">
                Click to place on <strong>F1</strong> · stretch the block to set duration.
              </p>
              <div className="mb-2 text-[11px] font-medium">Gaming</div>
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {EFFECT_PRESETS.filter((p) => p.group === "gaming").map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`lib-card ${activeFxId === p.id ? "active" : ""}`}
                    onClick={() => applyEffect(p.id)}
                  >
                    <SceneThumb effectId={p.id} />
                    <div className="mt-1 text-left text-[11px] font-medium">{p.label}</div>
                  </button>
                ))}
              </div>
              <div className="mb-2 text-[11px] font-medium">Essentials</div>
              <div className="grid grid-cols-2 gap-1.5">
                {EFFECT_PRESETS.filter(
                  (p) => p.group === "essentials" && p.id !== "none",
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`lib-card ${activeFxId === p.id ? "active" : ""}`}
                    onClick={() => applyEffect(p.id)}
                  >
                    <SceneThumb effectId={p.id} />
                    <div className="mt-1 text-left text-[11px] font-medium">{p.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
