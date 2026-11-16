import { useRef, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import { DEFAULT_EFFECTS, TimelineClip } from "../types/editor";
import { NumberSlider } from "./ui/NumberSlider";
import { IconCopy, IconTrash } from "./Icons";

type TabId = "basic" | "speed";

function volumeToDb(v: number) {
  if (v <= 0.001) return "-∞";
  const db = 20 * Math.log10(v);
  return `${db >= 0 ? "+" : ""}${db.toFixed(1)}`;
}

export function AudioInspector({
  clip,
  locked,
}: {
  clip: TimelineClip;
  locked: boolean;
}) {
  const [tab, setTab] = useState<TabId>("basic");
  const histGate = useRef(true);
  const fx = { ...DEFAULT_EFFECTS(), ...clip.effects };
  const updateSelectedEffects = useEditorStore((s) => s.updateSelectedEffects);
  const updateClip = useEditorStore((s) => s.updateClip);
  const duplicateClip = useEditorStore((s) => s.duplicateClip);
  const removeSelectedClip = useEditorStore((s) => s.removeSelectedClip);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  function setFx(patch: Parameters<typeof updateSelectedEffects>[0]) {
    if (histGate.current) {
      pushHistory();
      histGate.current = false;
      window.setTimeout(() => {
        histGate.current = true;
      }, 600);
    }
    updateSelectedEffects(patch);
  }
  const srcDur = Math.max(0.05, clip.outPoint - clip.inPoint);

  const tabs: { id: TabId; label: string }[] = [
    { id: "basic", label: "Basic" },
    { id: "speed", label: "Speed" },
  ];

  return (
    <aside className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-2 py-2">
        <span className="inspector-badge audio">Audio</span>
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

      <div className="inspector-tabs tabs-2">
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

        {tab === "basic" && (
          <div className="inspector-card">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Audio Adjustments
            </div>
            <NumberSlider
              label="Volume"
              min={0}
              max={2}
              step={0.01}
              value={fx.volume ?? 1}
              format={(v) => volumeToDb(v)}
              parse={(raw) => {
                const cleaned = raw.replace(/[^\d.\-+eE]/g, "").trim();
                if (cleaned === "" || cleaned === "-∞") return 0;
                const n = Number(cleaned);
                if (!Number.isFinite(n)) return null;
                return Math.pow(10, n / 20);
              }}
              suffix="dB"
              onChange={(volume) => setFx({ volume })}
            />
            <button
              type="button"
              className={`btn mb-3 w-full ${(fx.volume ?? 1) < 0.01 ? "btn-accent" : ""}`}
              onClick={() =>
                setFx({
                  volume: (fx.volume ?? 1) < 0.01 ? 1 : 0,
                })
              }
            >
              {(fx.volume ?? 1) < 0.01 ? "Unmute" : "Mute"}
            </button>
            <NumberSlider
              label="Fade In"
              min={0}
              max={3}
              step={0.05}
              value={fx.audioFadeIn ?? 0}
              suffix="s"
              onChange={(audioFadeIn) => setFx({ audioFadeIn })}
            />
            <NumberSlider
              label="Fade Out"
              min={0}
              max={3}
              step={0.05}
              value={fx.audioFadeOut ?? 0}
              suffix="s"
              onChange={(audioFadeOut) => setFx({ audioFadeOut })}
            />
            <p className="mt-2 text-[10px] text-[var(--muted)]">
              Volume scales the timeline waveform live. Fades draw as curved ramps.
            </p>
          </div>
        )}

        {tab === "speed" && (
          <div className="inspector-card">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Speed
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
                setFx({ speed });
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
                    setFx({ speed: s });
                    updateClip(clip.id, { duration: srcDur / s });
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
            <label className="flex items-center justify-between text-xs">
              <span>Reverse</span>
              <input
                type="checkbox"
                checked={fx.reverse}
                onChange={(e) => setFx({ reverse: e.target.checked })}
              />
            </label>
            <div className="mt-3 space-y-1 text-[11px] text-[var(--muted)]">
              <div className="flex justify-between">
                <span>Source</span>
                <span className="font-[var(--font-mono)]">{srcDur.toFixed(2)}s</span>
              </div>
              <div className="flex justify-between">
                <span>Timeline</span>
                <span className="font-[var(--font-mono)] text-[var(--accent)]">
                  {clip.duration.toFixed(2)}s
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
