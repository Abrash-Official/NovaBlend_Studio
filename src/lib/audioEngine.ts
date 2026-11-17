import { convertFileSrc } from "@tauri-apps/api/core";
import { voicePreviewRate } from "../types/editor";

type VoiceId = string;

type Graph = {
  el: HTMLMediaElement;
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  filterHigh: BiquadFilterNode;
  filterLow: BiquadFilterNode;
  delay: DelayNode;
  delayGain: GainNode;
  dry: GainNode;
  connectedSrc: string;
};

const graphs = new Map<string, Graph>();
let sharedCtx: AudioContext | null = null;

function getCtx() {
  if (!sharedCtx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    sharedCtx = new AC();
  }
  return sharedCtx;
}

function ensureGraph(id: string, el: HTMLMediaElement): Graph {
  const existing = graphs.get(id);
  if (existing && existing.el === el) return existing;

  if (existing) {
    try {
      existing.source.disconnect();
    } catch {
      /* ignore */
    }
    graphs.delete(id);
  }

  const ctx = getCtx();
  const source = ctx.createMediaElementSource(el);
  const gain = ctx.createGain();
  const filterHigh = ctx.createBiquadFilter();
  const filterLow = ctx.createBiquadFilter();
  const delay = ctx.createDelay(1.0);
  const delayGain = ctx.createGain();
  const dry = ctx.createGain();

  filterHigh.type = "highpass";
  filterHigh.frequency.value = 20;
  filterLow.type = "lowpass";
  filterLow.frequency.value = 20000;
  delay.delayTime.value = 0.01;
  delayGain.gain.value = 0;
  dry.gain.value = 1;

  // source -> high -> low -> dry -> gain -> destination
  //                      \-> delay -> delayGain -> gain
  source.connect(filterHigh);
  filterHigh.connect(filterLow);
  filterLow.connect(dry);
  dry.connect(gain);
  filterLow.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(gain);
  gain.connect(ctx.destination);

  const g: Graph = {
    el,
    ctx,
    source,
    gain,
    filterHigh,
    filterLow,
    delay,
    delayGain,
    dry,
    connectedSrc: "",
  };
  graphs.set(id, g);
  return g;
}

function applyVoice(g: Graph, voice: VoiceId) {
  // Reset
  g.filterHigh.frequency.value = 20;
  g.filterLow.frequency.value = 20000;
  g.delay.delayTime.value = 0.01;
  g.delayGain.gain.value = 0;
  g.dry.gain.value = 1;

  switch (voice) {
    case "radio":
      g.filterHigh.frequency.value = 400;
      g.filterLow.frequency.value = 2800;
      break;
    case "robot":
      g.filterHigh.frequency.value = 200;
      g.filterLow.frequency.value = 4000;
      g.delay.delayTime.value = 0.035;
      g.delayGain.gain.value = 0.45;
      break;
    case "cave":
      g.delay.delayTime.value = 0.18;
      g.delayGain.gain.value = 0.55;
      g.dry.gain.value = 0.85;
      break;
    default:
      break;
  }
}

/** Drive a media element through Web Audio (gain > 1 + voice FX). */
export async function syncMediaAudio(args: {
  id: string;
  el: HTMLMediaElement;
  srcPath: string;
  playing: boolean;
  mediaTime: number;
  volumeLinear: number;
  voiceEffect: string;
  speed: number;
  muted: boolean;
  /** When false, caller owns seek/play (e.g. preview video). */
  controlTransport?: boolean;
}) {
  const {
    id,
    el,
    srcPath,
    playing,
    mediaTime,
    volumeLinear,
    voiceEffect,
    speed,
    muted,
    controlTransport = true,
  } = args;

  // Preview owns decode/seek when controlTransport is false — never touch src/load
  // or we fight ensureVideo and spin forever on "Loading frame…".
  if (controlTransport) {
    const url = convertFileSrc(srcPath);
    if (el.dataset.src !== url) {
      el.dataset.src = url;
      el.src = url;
      void el.load();
    }
  }

  // Element volume stays at 1; gain node does boost
  el.volume = 1;
  el.muted = muted || volumeLinear < 0.001;

  let g: Graph;
  try {
    g = ensureGraph(id, el);
  } catch {
    // Fallback if MediaElementSource already taken
    el.volume = Math.min(1, Math.max(0, volumeLinear));
    if (controlTransport) {
      el.playbackRate = voicePreviewRate(voiceEffect, speed);
    }
    return;
  }

  if (g.ctx.state === "suspended") {
    try {
      await g.ctx.resume();
    } catch {
      /* ignore */
    }
  }

  g.gain.gain.value = muted ? 0 : Math.max(0, Math.min(4, volumeLinear));
  applyVoice(g, voiceEffect || "none");
  if (controlTransport) {
    try {
      el.playbackRate = voicePreviewRate(voiceEffect || "none", speed);
    } catch {
      /* ignore */
    }

    const drift = Math.abs((el.currentTime || 0) - mediaTime);
    if (!playing) {
      if (drift > 0.05 && el.readyState >= 1) {
        try {
          el.currentTime = mediaTime;
        } catch {
          /* ignore */
        }
      }
      if (!el.paused) el.pause();
    } else {
      if (drift > 0.2 && el.readyState >= 1) {
        try {
          el.currentTime = mediaTime;
        } catch {
          /* ignore */
        }
      }
      if (el.paused && !el.muted) void el.play().catch(() => {});
    }
  }
}

export function releaseMediaAudio(id: string) {
  const g = graphs.get(id);
  if (!g) return;
  try {
    g.source.disconnect();
    g.gain.disconnect();
  } catch {
    /* ignore */
  }
  graphs.delete(id);
}

export function releaseAllMediaAudio() {
  for (const id of [...graphs.keys()]) releaseMediaAudio(id);
}
