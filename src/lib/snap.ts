import { TimelineClip } from "../types/editor";

function keyframeLocalTimes(clip: TimelineClip): number[] {
  const fx = clip.effects;
  if (!fx) return [];
  const lists = [
    fx.scaleKeyframes,
    fx.opacityKeyframes,
    fx.posXKeyframes,
    fx.posYKeyframes,
    fx.rotationKeyframes,
  ];
  const times = new Set<number>();
  for (const list of lists) {
    for (const k of list || []) times.add(k.time);
  }
  return [...times];
}

/** Absolute timeline times for all keyframes on a clip. */
export function keyframeAbsoluteTimes(clip: TimelineClip): number[] {
  return keyframeLocalTimes(clip).map((t) => clip.start + t);
}

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
    for (const t of keyframeAbsoluteTimes(c)) targets.push(t);
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

/** Snap playhead to nearby clip edges / keyframes when magnet is on. */
export function snapPlayhead(args: {
  time: number;
  clips: TimelineClip[];
  duration: number;
  threshold: number;
}): number {
  const { time, clips, duration, threshold } = args;
  const clamped = Math.max(0, Math.min(duration, time));
  if (threshold <= 0) return clamped;

  const targets: number[] = [0, duration];
  for (const c of clips) {
    targets.push(c.start, c.start + c.duration);
    for (const t of keyframeAbsoluteTimes(c)) targets.push(t);
  }

  let best = clamped;
  let bestDist = threshold;
  for (const edge of targets) {
    const d = Math.abs(clamped - edge);
    if (d < bestDist) {
      bestDist = d;
      best = edge;
    }
  }
  return Math.max(0, Math.min(duration, best));
}
