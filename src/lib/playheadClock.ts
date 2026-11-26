/**
 * High-frequency playhead for smooth UI (timeline needle).
 * Avoids pushing Zustand every rAF — that re-rendered the whole Timeline and looked like teleporting.
 */
let live = 0;
const listeners = new Set<(t: number) => void>();

export function getLivePlayhead() {
  return live;
}

export function setLivePlayhead(t: number) {
  live = Math.max(0, t);
  for (const cb of listeners) cb(live);
}

export function subscribeLivePlayhead(cb: (t: number) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
