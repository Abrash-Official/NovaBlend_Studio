import { TimelineClip } from "../types/editor";

/** CapCut-like magnet: snap clip start/end to nearby edges within threshold (seconds). */
export function snapClipStart(args: {
  start: number;
  duration: number;
  clipId: string;
  clips: TimelineClip[];
  playhead: number;
  threshold: number;
}): number {
  const { start, duration, clipId, clips, playhead, threshold } = args;
  if (threshold <= 0) return Math.max(0, start);

  const targets: number[] = [0, playhead];
  for (const c of clips) {
    if (c.id === clipId) continue;
    targets.push(c.start, c.start + c.duration);
  }

  let best = start;
  let bestDist = threshold;

  for (const edge of targets) {
    const dStart = Math.abs(start - edge);
    if (dStart < bestDist) {
      bestDist = dStart;
      best = edge;
    }
    const end = start + duration;
    const dEnd = Math.abs(end - edge);
    if (dEnd < bestDist) {
      bestDist = dEnd;
      best = edge - duration;
    }
  }

  return Math.max(0, best);
}
