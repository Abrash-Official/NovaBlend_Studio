/** CapCut-like major tick steps while zooming out: 1 → 2 → 4 → … → 5 min. */
const STEPS_SEC = [
  1, 2, 4, 8, 16, 30, 60, 120, 180, 240, 300,
] as const;

/** Pick a step so labels stay ~minPx apart. */
export function rulerMajorStep(zoomPxPerSec: number, minLabelPx = 52): number {
  const z = Math.max(0.01, zoomPxPerSec);
  for (const step of STEPS_SEC) {
    if (step * z >= minLabelPx) return step;
  }
  return 300;
}

export function formatRulerLabel(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (s < 3600) {
    return r === 0 ? `${m}m` : `${m}:${r.toString().padStart(2, "0")}`;
  }
  const h = Math.floor(s / 3600);
  const hm = Math.floor((s % 3600) / 60);
  return `${h}h${hm.toString().padStart(2, "0")}`;
}

export function rulerTicks(
  duration: number,
  zoomPxPerSec: number,
): { t: number; major: boolean; label: string }[] {
  const major = rulerMajorStep(zoomPxPerSec);
  const minor = major >= 60 ? major / 2 : major >= 8 ? major / 2 : 0;
  const out: { t: number; major: boolean; label: string }[] = [];
  const end = Math.max(0, duration);
  for (let t = 0; t <= end + 0.001; t += major) {
    out.push({ t, major: true, label: formatRulerLabel(t) });
  }
  if (minor > 0.5 && minor * zoomPxPerSec >= 10) {
    for (let t = minor; t < end; t += major) {
      out.push({ t, major: false, label: "" });
    }
  }
  return out;
}
