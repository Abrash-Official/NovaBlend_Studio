import { CSSProperties, useEffect, useState } from "react";

type Props = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Optional formatter for the text field (e.g. percent) */
  format?: (v: number) => string;
  /** Parse typed text back to number; default Number() */
  parse?: (raw: string) => number | null;
  suffix?: string;
  onChange: (v: number) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Slider + editable float field. */
export function NumberSlider({
  label,
  min,
  max,
  step,
  value,
  format,
  parse,
  suffix,
  onChange,
}: Props) {
  const shown = format ? format(value) : value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0);
  const [draft, setDraft] = useState(shown);

  useEffect(() => {
    setDraft(format ? format(value) : value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0));
  }, [value, format, step]);

  function commit(raw: string) {
    const cleaned = raw.replace(/[^\d.\-eE]/g, "").trim();
    let n = parse ? parse(cleaned) : Number(cleaned);
    if (n === null || !Number.isFinite(n)) {
      setDraft(shown);
      return;
    }
    n = clamp(n, min, max);
    // Snap lightly to step (avoid binary float drift)
    if (step > 0) {
      const steps = Math.round((n - min) / step);
      const decimals = Math.max(0, (String(step).split(".")[1] || "").length);
      n = clamp(
        Number((min + steps * step).toFixed(decimals)),
        min,
        max,
      );
    }
    onChange(n);
  }

  const pct = ((value - min) / Math.max(1e-9, max - min)) * 100;

  return (
    <div className="num-slider">
      <div className="num-slider-head">
        <span className="num-slider-label">{label}</span>
        <div className="num-slider-field">
          <input
            className="num-slider-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                onChange(clamp(value + step, min, max));
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                onChange(clamp(value - step, min, max));
              }
            }}
            inputMode="decimal"
          />
          {suffix ? <span className="num-slider-suffix">{suffix}</span> : null}
        </div>
      </div>
      <div className="num-slider-track-wrap">
        <input
          className="num-slider-range"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          style={{ "--fill": `${pct}%` } as CSSProperties}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
