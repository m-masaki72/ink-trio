import { test } from "node:test";
import assert from "node:assert/strict";
import { MODES, dayKeyOf, rollDay, recordClear, clearedCount, gainedToday } from "../src/tally.js";

const base = { totals: {}, today: {}, dayKey: "" };

test("日付キーは0埋めした年月日", () => {
  assert.equal(dayKeyOf(new Date(2026, 8, 1)), "2026-09-01");
  assert.equal(dayKeyOf(new Date(2026, 11, 31)), "2026-12-31");
});

test("日付が変わると今日ぶんだけ 0 に戻り、通算は残る", () => {
  const s = { totals: { "6": 12 }, today: { "6": 3 }, dayKey: "2026-09-10" };
  const rolled = rollDay(s, "2026-09-11");
  assert.deepEqual(rolled.today, {});
  assert.deepEqual(rolled.totals, { "6": 12 });
  assert.equal(rolled.dayKey, "2026-09-11");
});

test("同じ日なら何もしない", () => {
  const s = { totals: {}, today: { "3": 2 }, dayKey: "2026-09-11" };
  assert.equal(rollDay(s, "2026-09-11"), s);
});

test("刷り上がるたびに通算と今日ぶんが両方増える", () => {
  let s = base;
  s = recordClear(s, "6");
  s = recordClear(s, "6");
  s = recordClear(s, "t");
  assert.deepEqual(s.totals, { "6": 2, t: 1 });
  assert.deepEqual(s.today, { "6": 2, t: 1 });
  assert.deepEqual(base, { totals: {}, today: {}, dayKey: "" }, "元の状態を書き換えない");
});

test("練習の達成数は歯抜けでも数えられる", () => {
  const cleared = [];
  cleared[0] = true; cleared[5] = true; cleared[20] = true;
  assert.equal(clearedCount(cleared), 3);
  assert.equal(clearedCount([]), 0);
});

test("今日ぶんの合計は遊び方をまたいで足す", () => {
  assert.equal(gainedToday({ t: 1, "3": 2, "10": 4 }), 7);
  assert.equal(gainedToday({}), 0);
  assert.equal(gainedToday({ 未知: 99 }), 0, "知らない遊び方は数えない");
});

test("遊び方は練習と3難易度", () => {
  assert.deepEqual(MODES.map(m => m.k), ["t", "3", "6", "10"]);
});
