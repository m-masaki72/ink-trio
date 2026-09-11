// 効果音。外部音源は持たず、押されたときだけ合成して鳴らす。

import { M, Y, B } from "./rules.js";

const FREQ = { [M]: 440, [Y]: 554.37, [B]: 659.25 };   // A4 / C#5 / E5

export function createAudio(AudioCtor) {
  const Ctor = AudioCtor || globalThis.AudioContext || globalThis.webkitAudioContext;
  let ctx = null, master = null, enabled = true;

  // 自動再生の制限があるので、最初に音が要るまで AudioContext を作らない
  function open() {
    if (!enabled || !Ctor) return null;
    if (!ctx) {
      try { ctx = new Ctor(); } catch { return null; }
      master = ctx.createGain();
      master.gain.value = 0.85;
      const comp = ctx.createDynamicsCompressor();   // 連打時の飽和を抑える
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      comp.release.value = 0.1;
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function sweep(a, t, { type, from, to, glide, peak, attack, release, stop }) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + glide);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + release);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + stop);
  }

  // ローラーの擦れ。短い減衰ノイズを胴鳴りに重ねる
  function roller(a, t, f) {
    const len = Math.floor(a.sampleRate * 0.055);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); src.buffer = buf;
    const bp = a.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = f * 2.3; bp.Q.value = 1.1;
    const g = a.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t);
  }

  const api = {
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = !!on;
      if (!enabled && ctx) ctx.suspend();
    },
    ink(bit, when = 0) {
      const a = open(); if (!a) return;
      const t = a.currentTime + when;
      const f = FREQ[bit] || 440;
      sweep(a, t, { type: "triangle", from: f, to: f * 0.74, glide: 0.10,
                    peak: 0.15, attack: 0.008, release: 0.15, stop: 0.17 });
      roller(a, t, f);
    },
    peel() {
      const a = open(); if (!a) return;
      sweep(a, a.currentTime, { type: "sine", from: 560, to: 235, glide: 0.12,
                                peak: 0.08, attack: 0.01, release: 0.14, stop: 0.16 });
    },
    blocked() {
      const a = open(); if (!a) return;
      sweep(a, a.currentTime, { type: "square", from: 150, to: 96, glide: 0.07,
                                peak: 0.05, attack: 0.006, release: 0.09, stop: 0.1 });
    },
    // 校了：三色を順に重ねた和音
    done() { api.ink(M, 0); api.ink(Y, 0.11); api.ink(B, 0.22); },
  };
  return api;
}
