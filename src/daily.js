// 日刊号。号番号だけから出題が決まり、号の記録の勘定もここで閉じる。
// DOM にも保存にも触らない。
// EPOCH / SHAPE / 種の混ぜ方を変えると過去号が別の盤面に化けるので、
// tests/daily.test.js が代表号を実値で固定して見張っている。

import { BANDS, pickInBand } from "./puzzles.js";

export const EPOCH = "2026-01-01";        // 第1号の日
export const SHAPE = [3, 6, 6, 10, 10];   // 1日の型。入りは軽く、後半で歯ごたえ

const DAY = 86400000;

// "YYYY-MM-DD" は UTC として読む。地方時で引くと夏時間の境目で1日ずれる
export function issueOf(dayKey, epoch = EPOCH) {
  const d = Date.parse(`${dayKey}T00:00:00Z`);
  const e = Date.parse(`${epoch}T00:00:00Z`);
  if (!Number.isFinite(d) || !Number.isFinite(e)) return null;
  const n = Math.floor((d - e) / DAY) + 1;
  return n >= 1 ? n : null;
}

// 号と枠から決まる乱数。同じ入力なら世界中で同じ盤面になる（mulberry32）
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedFor = (issue, slot, shift) =>
  (issue * 1000003 + slot * 10007 + shift * 97) >>> 0;

export const puzzleOf = (issue, slot, level, bands = BANDS) =>
  pickInBand(level, k => seeded(seedFor(issue, slot, k)), bands);

export const issueSet = (issue, shape = SHAPE) =>
  shape.map((level, slot) => ({ level, seq: puzzleOf(issue, slot, level) }));

/* ---------- 号の記録 ---------- */
// 五問ぶんの枠を先に持つ。0 は「まだ解いていない」

export const blankRecord = (shape = SHAPE) => ({
  ms: shape.map(() => 0), undo: shape.map(() => 0), seq: shape.map(() => []), aid: false,
});

export const solvedCount = rec => rec.ms.filter(v => v > 0).length;
export const totalMs = rec => rec.ms.reduce((a, b) => a + b, 0);
export const nextSlot = rec => rec.ms.findIndex(v => v === 0);
export const isComplete = (rec, shape = SHAPE) => nextSlot(rec) < 0 && rec.ms.length === shape.length;

export function mergeSlot(rec, { slot, ms, undo, seq, aid }) {
  const out = {
    ms: rec.ms.slice(), undo: rec.undo.slice(),
    seq: rec.seq.map(a => a.slice()), aid: rec.aid || !!aid,
  };
  const now = Math.max(1, Math.round(ms));
  // 済んだ枠をもう一度解いたときは、良くなったときだけ入れ替える
  if (out.ms[slot] === 0 || now < out.ms[slot]) {
    out.ms[slot] = now;
    out.undo[slot] = undo;
    out.seq[slot] = seq.slice();
  }
  return out;
}

// 「刷った日」は五問そろえた日だけ。過去号を埋めても今日は増えない
export function bumpDays(daily, { rec, issue, todayIssue, today, shape = SHAPE }) {
  if (!isComplete(rec, shape) || issue !== todayIssue || daily.lastDay === today) return daily;
  return { ...daily, days: daily.days + 1, lastDay: today };
}
