// 進行度と設定の保存。localStorage そのものではなく「入れ物」を受け取るので、
// 偽の入れ物を渡せばブラウザなしで検証できる。

export const SAVE_KEY = "inktrio.v1";
export const SAVE_VERSION = 3;
// 版を上げても古い保存を読む。弾くと、遊んでいた人の進行度がその場で消える
export const KNOWN_VERSIONS = [1, 2, 3];

// 敵対的な書き込みで保存領域を埋められないための上限。号は一日一件しか増えない
export const MAX_SETS = 400;
export const MAX_MS = 86400000;

export const LEVELS = [3, 6, 10];
export const MARK_MODES = ["bars", "letters", "digits", "none"];

// 参照を共有しないよう、入れ物は毎回作る
export const freshDaily = () => ({ days: 0, lastDay: "", clock: true, send: false, sets: {} });
export const freshRush = () => ({ day: "", count: 0, today: null, best: null });

// DEFAULTS の可変フィールドを呼び出し側で並べ直すと、項目を足すたび同期義務が増える
export const freshState = () => ({
  ...DEFAULTS, cleared: [], totals: {}, today: {}, daily: freshDaily(), rush: freshRush(),
});

export const DEFAULTS = {
  reached: 0, cleared: [], tutorialDone: false, level: 6,
  markMode: "none", palName: "vivid", soundOn: true, crtOn: true, showDiff: false,
  totals: {}, today: {}, dayKey: "", daily: freshDaily(), rush: freshRush(),
};

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const plainObject = v => (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
const whole = (v, hi) => clamp(Number.isFinite(v) ? Math.trunc(v) : 0, 0, hi);

const numbers = (v, hi, len) =>
  (Array.isArray(v) && v.length === len) ? v.map(x => whole(x, hi)) : null;

// 押したマスの列。あとでサーバーへ出して検証してもらう値なので、盤の外を混ぜない
const sequences = (v, len, cellCount, maxMoves) => {
  if (!Array.isArray(v) || v.length !== len) return null;
  const out = [];
  for (const one of v) {
    if (!Array.isArray(one) || one.length > maxMoves) return null;
    out.push(one.map(x => whole(x, cellCount - 1)));
  }
  return out;
};

// 壊れた号は既定に戻すのではなく、その号ごと無かったことにする
function sanitizeSets(raw, cellCount, maxMoves, slotCount) {
  const src = plainObject(raw);
  const out = {};
  let n = 0;
  // 溢れたときに捨てるのは古い号。昇順のまま打ち切ると、新しい記録が残らなくなる
  const keys = Object.keys(src)
    .filter(k => /^[1-9][0-9]{0,6}$/.test(k))
    .sort((a, b) => Number(b) - Number(a));
  for (const key of keys) {
    if (n >= MAX_SETS) break;
    const r = plainObject(src[key]);
    // 枠数が合わない記録を通すと「済んだ号」と誤認して、日刊が進まなくなる
    const ms = numbers(r.ms, MAX_MS, slotCount);
    if (!ms) continue;
    const seq = sequences(r.seq, slotCount, cellCount, maxMoves);
    if (!seq) continue;
    out[key] = {
      ms, seq,
      undo: numbers(r.undo, 9999, slotCount) || ms.map(() => 0),
      aid: r.aid === true,
    };
    n++;
  }
  return out;
}

// 走行の記録。何も入っていなければ「まだ走っていない」として null に落とす
function sanitizeScore(raw) {
  const o = plainObject(raw);
  if (!Number.isFinite(o.solved) && !Number.isFinite(o.ms)) return null;
  return { solved: whole(o.solved, 9999), ms: whole(o.ms, MAX_MS) };
}

function sanitizeRush(raw) {
  const r = plainObject(raw);
  return {
    day: typeof r.day === "string" ? r.day.slice(0, 10) : "",
    count: whole(r.count, 99),
    today: sanitizeScore(r.today),
    best: sanitizeScore(r.best),
  };
}

function sanitizeDaily(raw, cellCount, maxMoves, slotCount) {
  const d = plainObject(raw);
  return {
    days: whole(d.days, 1e6),
    lastDay: typeof d.lastDay === "string" ? d.lastDay.slice(0, 10) : "",
    clock: d.clock !== false,     // 時計の表示は既定でオン
    send: d.send === true,        // 送信は既定でオフ。ここを反転させない
    sets: sanitizeSets(d.sets, cellCount, maxMoves, slotCount),
  };
}

// 保存された値は信用しない。同一オリジンの別ページからも書き換えられる。
export function sanitize(raw,
  { stageCount, paletteNames, cellCount = 25, maxMoves = 40, slotCount = 5 }) {
  const d = raw && KNOWN_VERSIONS.includes(raw.v) ? raw : null;
  if (!d) return freshState();
  return {
    reached: clamp(d.reached | 0, 0, stageCount - 1),
    cleared: Array.isArray(d.cleared) ? d.cleared : [],
    tutorialDone: !!d.done,
    level: LEVELS.includes(d.level) ? d.level : DEFAULTS.level,
    markMode: MARK_MODES.includes(d.marks) ? d.marks : DEFAULTS.markMode,
    palName: paletteNames.includes(d.pal) ? d.pal : DEFAULTS.palName,
    soundOn: d.snd !== false,
    crtOn: d.crt !== false,
    showDiff: d.diff === true,
    totals: plainObject(d.totals),
    today: plainObject(d.today),
    dayKey: typeof d.day === "string" ? d.day : "",
    daily: sanitizeDaily(d.daily, cellCount, maxMoves, slotCount),
    rush: sanitizeRush(d.rush),
  };
}

export function serialize(s) {
  return {
    v: SAVE_VERSION,
    reached: s.reached, cleared: s.cleared, done: s.tutorialDone,
    level: s.level, marks: s.markMode, pal: s.palName,
    snd: s.soundOn, crt: s.crtOn, diff: s.showDiff,
    totals: s.totals, day: s.dayKey, today: s.today,
    daily: s.daily, rush: s.rush,
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
