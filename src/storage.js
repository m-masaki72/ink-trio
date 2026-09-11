// 進行度と設定の保存。localStorage そのものではなく「入れ物」を受け取るので、
// 偽の入れ物を渡せばブラウザなしで検証できる。

export const SAVE_KEY = "inktrio.v1";
export const SAVE_VERSION = 2;

export const LEVELS = [3, 6, 10];
export const MARK_MODES = ["bars", "letters", "digits", "none"];

export const DEFAULTS = {
  reached: 0, cleared: [], tutorialDone: false, level: 6,
  markMode: "none", palName: "vivid", soundOn: true, crtOn: true,
  totals: {}, today: {}, dayKey: "",
};

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const plainObject = v => (v && typeof v === "object" && !Array.isArray(v)) ? v : {};

// 保存された値は信用しない。同一オリジンの別ページからも書き換えられる。
export function sanitize(raw, { stageCount, paletteNames }) {
  const d = raw && (raw.v === 1 || raw.v === SAVE_VERSION) ? raw : null;
  if (!d) return { ...DEFAULTS, cleared: [], totals: {}, today: {} };
  return {
    reached: clamp(d.reached | 0, 0, stageCount - 1),
    cleared: Array.isArray(d.cleared) ? d.cleared : [],
    tutorialDone: !!d.done,
    level: LEVELS.includes(d.level) ? d.level : DEFAULTS.level,
    markMode: MARK_MODES.includes(d.marks) ? d.marks : DEFAULTS.markMode,
    palName: paletteNames.includes(d.pal) ? d.pal : DEFAULTS.palName,
    soundOn: d.snd !== false,
    crtOn: d.crt !== false,
    totals: plainObject(d.totals),
    today: plainObject(d.today),
    dayKey: typeof d.day === "string" ? d.day : "",
  };
}

export function serialize(s) {
  return {
    v: SAVE_VERSION,
    reached: s.reached, cleared: s.cleared, done: s.tutorialDone,
    level: s.level, marks: s.markMode, pal: s.palName,
    snd: s.soundOn, crt: s.crtOn,
    totals: s.totals, day: s.dayKey, today: s.today,
  };
}

// 保存領域が使えない環境（プレビュー枠など）では null を返す。
// 遊びは続けられるべきなので、呼び出し側は available を見て案内するだけでよい。
export function openBackend(global = globalThis) {
  try {
    const s = global.localStorage;
    const probe = "__probe__";
    s.setItem(probe, probe);
    s.removeItem(probe);
    return s;
  } catch { return null; }
}

export function createSaveFile(backend, opts) {
  return {
    available: !!backend,
    load() {
      if (!backend) return sanitize(null, opts);
      try { return sanitize(JSON.parse(backend.getItem(SAVE_KEY)), opts); }
      catch { return sanitize(null, opts); }
    },
    save(state) {
      if (!backend) return false;
      try { backend.setItem(SAVE_KEY, JSON.stringify(serialize(state))); return true; }
      catch { return false; }
    },
    clear() {
      if (!backend) return;
      try { backend.removeItem(SAVE_KEY); } catch { /* 消せなくても続行する */ }
    },
  };
}
