import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EPOCH, SHAPE, issueOf, seeded, puzzleOf, issueSet,
  blankRecord, solvedCount, totalMs, nextSlot, isComplete, mergeSlot, bumpDays,
} from "../src/daily.js";
import { BANDS, buildPuzzle, featuresOf } from "../src/puzzles.js";

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

/* ---------- 号の記録 ---------- */

const 一手 = (slot, ms, extra = {}) => ({ slot, ms, undo: 0, seq: [slot], aid: false, ...extra });

test("空の記録は五枠ぶんで、まだ何も解けていない", () => {
  const rec = blankRecord();
  assert.equal(rec.ms.length, SHAPE.length);
  assert.equal(solvedCount(rec), 0);
  assert.equal(totalMs(rec), 0);
  assert.equal(nextSlot(rec), 0);
  assert.equal(isComplete(rec), false);
});

test("解いた枠が埋まり、次の枠へ進む", () => {
  const rec = mergeSlot(blankRecord(), 一手(0, 1234));
  assert.equal(rec.ms[0], 1234);
  assert.equal(solvedCount(rec), 1);
  assert.equal(nextSlot(rec), 1);
  assert.deepEqual(rec.seq[0], [0]);
});

// 済んだ号をめくり直せるようにした結果、遅い記録で上書きされうる
test("済んだ枠は、良くなったときだけ入れ替わる", () => {
  const 一度目 = mergeSlot(blankRecord(), 一手(0, 5000, { undo: 3, seq: [1, 2] }));
  const 遅い = mergeSlot(一度目, 一手(0, 9000, { undo: 0, seq: [9] }));
  assert.equal(遅い.ms[0], 5000, "遅い記録では上書きしない");
  assert.equal(遅い.undo[0], 3);
  assert.deepEqual(遅い.seq[0], [1, 2]);

  const 速い = mergeSlot(一度目, 一手(0, 2000, { undo: 1, seq: [7] }));
  assert.equal(速い.ms[0], 2000);
  assert.equal(速い.undo[0], 1, "手戻りと手順も一緒に入れ替わる");
  assert.deepEqual(速い.seq[0], [7]);
});

test("補助を使った事実は消えない", () => {
  const rec = mergeSlot(mergeSlot(blankRecord(), 一手(0, 100, { aid: true })), 一手(1, 100));
  assert.equal(rec.aid, true);
});

test("元の記録は書き換えない", () => {
  const 元 = blankRecord();
  mergeSlot(元, 一手(0, 1234));
  assert.equal(元.ms[0], 0);
});

const 満了 = () => SHAPE.reduce((rec, _, i) => mergeSlot(rec, 一手(i, 1000)), blankRecord());
const 素の日刊 = { days: 0, lastDay: "", clock: true, send: false, sets: {} };

test("五問そろえた日だけ、刷った日数が増える", () => {
  const 途中 = mergeSlot(blankRecord(), 一手(0, 1000));
  assert.equal(bumpDays(素の日刊, { rec: 途中, issue: 9, todayIssue: 9, today: "2026-09-14" }).days, 0);

  const 後 = bumpDays(素の日刊, { rec: 満了(), issue: 9, todayIssue: 9, today: "2026-09-14" });
  assert.equal(後.days, 1);
  assert.equal(後.lastDay, "2026-09-14");
});

// 過去号を埋めて日数を稼げると、「刷った日」の意味が壊れる
test("過去号をそろえても今日は増えない", () => {
  const 後 = bumpDays(素の日刊, { rec: 満了(), issue: 3, todayIssue: 9, today: "2026-09-14" });
  assert.equal(後.days, 0);
});

test("同じ日に二度そろえても一日ぶん", () => {
  const 一度 = bumpDays(素の日刊, { rec: 満了(), issue: 9, todayIssue: 9, today: "2026-09-14" });
  const 二度 = bumpDays(一度, { rec: 満了(), issue: 9, todayIssue: 9, today: "2026-09-14" });
  assert.equal(二度.days, 1);
});
