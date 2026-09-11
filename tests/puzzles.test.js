import { test } from "node:test";
import assert from "node:assert/strict";
import { SZ, SEQ, M, Y, B, trueMinimum } from "../src/rules.js";
import { TUTORIAL, FALLBACK, GENERATE_ATTEMPTS, buildPuzzle, generateSequence } from "../src/puzzles.js";

// 決定的な擬似乱数。生成の検査に Math.random を混ぜない。
function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

test("練習は21面あり、どれも盤の内側を押す", () => {
  assert.equal(TUTORIAL.length, 21);
  for (const [n, st] of TUTORIAL.entries()) {
    assert.ok(st.t && st.h, `${n} 面目に題と説明がない`);
    assert.ok(Array.isArray(st.s) && st.s.length > 0);
    for (const i of st.s) assert.ok(Number.isInteger(i) && i >= 0 && i < SZ, `${n} 面目に範囲外の ${i}`);
  }
});

test("練習はどの面も、示した手数がそのまま最短手数になる", () => {
  // ここが崩れると、答えの手順を最後まで押す前に手数制限へ当たって詰む
  for (const [n, st] of TUTORIAL.entries()) {
    assert.equal(buildPuzzle(st.s).par, st.s.length, `練習 ${n + 1}「${st.t}」`);
  }
});

test("練習の面は進むほど易しくならない", () => {
  const lens = TUTORIAL.map(st => st.s.length);
  assert.equal(lens[0], 1);
  assert.equal(lens[lens.length - 1], 12);
  assert.ok(lens[lens.length - 1] >= Math.max(...lens));
});

test("引き直しの落とし先は検算どおりの手数になっている", () => {
  for (const [level, seq] of Object.entries(FALLBACK)) {
    assert.equal(seq.length, Number(level));
    assert.equal(buildPuzzle(seq).par, Number(level), `FALLBACK[${level}]`);
  }
});

test("buildPuzzle は押した順にマゼンタ・イエロー・ブルーを割り当てる", () => {
  const { answer, target } = buildPuzzle([0, 4, 20, 24]);
  assert.deepEqual(answer.map(a => a.bit), [M, Y, B, M]);
  assert.deepEqual(answer.map(a => a.i), [0, 4, 20, 24]);
  assert.equal(target.length, SZ);
});

test("出題は選んだ難易度ちょうどの最短手数になる", () => {
  for (const level of [3, 6, 10]) {
    for (const seed of [1, 7, 12345, 98765]) {
      const seq = generateSequence(level, seeded(seed));
      assert.equal(seq.length, level);
      assert.equal(trueMinimum(buildPuzzle(seq).target), level, `level ${level} / seed ${seed}`);
    }
  }
});

test("引き直しが尽きても空の盤面は出さない", () => {
  for (const level of [3, 6, 10]) {
    assert.deepEqual(generateSequence(level, seeded(1), 0), FALLBACK[level]);
  }
  // 知らない難易度は「ふつう」に落とす
  assert.deepEqual(generateSequence(99, seeded(1), 0), FALLBACK[6]);
});

test("引き直しの上限は定数として持つ", () => {
  assert.ok(GENERATE_ATTEMPTS > 0);
  let calls = 0;
  const counting = () => { calls++; return 0.5; };
  generateSequence(6, counting);
  // 同じ乱数を返し続けると成立しないので、上限まで引いて落とし先に行く
  assert.equal(calls, GENERATE_ATTEMPTS * 6);
});

test("生成した盤面は答えの手順どおりに押せば揃う", () => {
  const seq = generateSequence(6, seeded(2024));
  const { target, answer } = buildPuzzle(seq);
  const board = new Array(SZ).fill(0);
  answer.forEach(({ i, bit }, j) => {
    assert.equal(bit, SEQ[j % 3]);
    const r = Math.floor(i / 5), c = i % 5;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < 5 && cc >= 0 && cc < 5) board[rr * 5 + cc] ^= bit;
    }
  });
  assert.deepEqual(board, target);
});
