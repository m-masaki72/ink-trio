// 日刊号。号番号だけから出題が決まる。DOM にも保存にも触らない。
// ここの定数を変えると過去号が別の盤面に化けるので、tests/daily.test.js が
// 代表号を固定して見張っている。

import { SZ, SEQ, stamp } from "./rules.js";
import { generateSequence } from "./puzzles.js";

export const EPOCH = "2026-01-01";        // 第1号の日
export const SHAPE = [3, 6, 6, 10, 10];   // 1日の型。入りは軽く、後半で歯ごたえ

// 同じ手数でも盤の見た目は揃わない（6手で「乗ったマス数」が2〜25まで散る）。
// 帯を外れた盤面は捨てて種をずらす。実測では平均0.2回ずらせば収まる。
export const BANDS = {
  3: { inked: [10, 20], colors: [3, 6] },
  6: { inked: [15, 23], colors: [4, 7] },
  10: { inked: [17, 24], colors: [5, 7] },
};
export const MAX_SHIFT = 50;

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

export function featuresOf(cellSeq) {
  const target = new Array(SZ).fill(0);
  cellSeq.forEach((idx, j) => stamp(target, idx, SEQ[j % 3]));
  const on = target.filter(v => v !== 0);
  return { inked: on.length, colors: new Set(on).size };
}

const withinBand = (f, b) =>
  f.inked >= b.inked[0] && f.inked <= b.inked[1] &&
  f.colors >= b.colors[0] && f.colors <= b.colors[1];

// 帯に入るまで種をずらす。入りきらなくても出題は止めない
export function puzzleOf(issue, slot, level, bands = BANDS) {
  const band = bands[level];
  let first = null;
  for (let shift = 0; shift < MAX_SHIFT; shift++) {
    const seq = generateSequence(level, seeded(seedFor(issue, slot, shift)));
    if (first === null) first = seq;
    if (!band || withinBand(featuresOf(seq), band)) return seq;
  }
  return first;
}

export function issueSet(issue, shape = SHAPE) {
  return shape.map((level, slot) => ({ level, seq: puzzleOf(issue, slot, level) }));
}
