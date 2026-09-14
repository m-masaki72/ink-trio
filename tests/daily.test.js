import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EPOCH, SHAPE, BANDS, issueOf, seeded, featuresOf, puzzleOf, issueSet,
} from "../src/daily.js";
import { buildPuzzle } from "../src/puzzles.js";

const 号数 = 200;

test("号番号は起点日から数える", () => {
  assert.equal(issueOf(EPOCH), 1);
  assert.equal(issueOf("2026-01-02"), 2);
  assert.equal(issueOf("2026-09-14"), 257);
});

// 起点より前や壊れた日付で盤面を作ろうとすると、出題が破綻する
test("起点より前と、日付でないものは号にならない", () => {
  assert.equal(issueOf("2025-12-31"), null);
  assert.equal(issueOf("not-a-date"), null);
  assert.equal(issueOf(""), null);
});

// 地方時で日付を引くと、夏時間の切り替わる日だけ差が 0 や 2 になる
test("夏時間の境目でも一日は一号ぶん", () => {
  for (const [前, 後] of [["2026-03-08", "2026-03-09"], ["2026-11-01", "2026-11-02"]]) {
    assert.equal(issueOf(後) - issueOf(前), 1, `${前} → ${後}`);
  }
});

test("同じ号は何度作っても同じ盤面", () => {
  for (const n of [1, 42, 257]) {
    assert.deepEqual(issueSet(n), issueSet(n), `第${n}号`);
  }
});

test("号が変われば盤面も変わる", () => {
  const a = JSON.stringify(issueSet(1));
  const b = JSON.stringify(issueSet(2));
  assert.notEqual(a, b);
});

// 型が崩れると「今日の重さ」が予測できなくなり、続ける理由が壊れる
test("五問の手数は型どおりで、最短手数も型と一致する", () => {
  for (let n = 1; n <= 号数; n++) {
    const set = issueSet(n);
    assert.deepEqual(set.map(x => x.level), SHAPE, `第${n}号の型`);
    for (const { level, seq } of set) {
      assert.equal(seq.length, level, `第${n}号 ${level}手の長さ`);
      assert.equal(buildPuzzle(seq).par, level, `第${n}号 ${level}手の最短手数`);
    }
  }
});

// 帯を外すと、同じ「6手」で2マスしか乗っていない盤と全面が埋まった盤が混ざる
test("選別が効いて、すべての問が帯に収まる", () => {
  for (let n = 1; n <= 号数; n++) {
    for (const { level, seq } of issueSet(n)) {
      const f = featuresOf(seq);
      const b = BANDS[level];
      assert.ok(f.inked >= b.inked[0] && f.inked <= b.inked[1],
        `第${n}号 ${level}手: 乗ったマス ${f.inked} が帯 ${b.inked} の外`);
      assert.ok(f.colors >= b.colors[0] && f.colors <= b.colors[1],
        `第${n}号 ${level}手: 色数 ${f.colors} が帯 ${b.colors} の外`);
    }
  }
});

test("帯を渡さなければ選別しない", () => {
  const 素 = puzzleOf(7, 0, 6, {});
  const 選別 = puzzleOf(7, 0, 6);
  assert.equal(素.length, 6);
  assert.ok(Array.isArray(選別));
});

test("種が同じなら乱数列も同じ", () => {
  const a = seeded(12345), b = seeded(12345);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  assert.notEqual(seeded(1)(), seeded(2)());
});

// 号の盤面は永久に再現できなければならない。generateSequence / trueMinimum /
// BANDS / SHAPE / 種の混ぜ方 ── どれを変えても過去号が別物に化ける。
// ここが落ちたら、それは「壊した」のではなく「過去号を捨てた」ということ。
test("代表号の盤面を固定する", () => {
  assert.deepEqual(issueSet(1).map(x => x.seq), [
    [23, 17, 21],
    [12, 12, 22, 2, 16, 24],
    [0, 21, 18, 13, 8, 21],
    [22, 3, 9, 10, 15, 22, 3, 5, 19, 23],
    [18, 5, 21, 24, 8, 13, 7, 2, 3, 14],
  ]);
  assert.deepEqual(issueSet(100).map(x => x.seq), [
    [23, 0, 6],
    [10, 23, 10, 6, 13, 16],
    [23, 22, 11, 15, 21, 6],
    [5, 18, 23, 22, 4, 22, 10, 20, 5, 23],
    [0, 1, 13, 3, 21, 10, 4, 20, 15, 14],
  ]);
});
