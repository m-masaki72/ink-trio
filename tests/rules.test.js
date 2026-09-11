import { test } from "node:test";
import assert from "node:assert/strict";
import {
  N, SZ, M, Y, B, SEQ, NAME, MASK, RANK, KERNEL,
  stamp, popcount, solvePlane, minByParity, slotCounts, planesOf, trueMinimum, MAX_MOVES,
} from "../src/rules.js";

const empty = () => new Array(SZ).fill(0);

test("押した3×3は盤の外で切り落とされる", () => {
  assert.equal(popcount(MASK[12]), 9, "中心は9マス");
  assert.equal(popcount(MASK[0]), 4, "角は4マス");
  assert.equal(popcount(MASK[2]), 6, "辺は6マス");
  for (const i of [0, 4, 20, 24]) assert.equal(popcount(MASK[i]), 4);
});

test("同じ色を二度重ねると消える", () => {
  const s = empty();
  stamp(s, 7, M);
  assert.ok(s.some(v => v !== 0));
  stamp(s, 7, M);
  assert.deepEqual(s, empty());
});

test("三色すべて重なると白になる", () => {
  const s = empty();
  SEQ.forEach(bit => stamp(s, 12, bit));
  assert.equal(s[12], M | Y | B);
  assert.equal(NAME[s[12]], "ホワイト");
});

test("押す順序は結果を変えない（どのマスをどの色で押したかだけで決まる）", () => {
  const pairs = [[0, M], [8, Y], [12, B], [8, M], [24, Y]];
  const apply = list => list.reduce((s, [i, b]) => stamp(s, i, b), empty());
  const base = apply(pairs);
  for (const order of [[4, 3, 2, 1, 0], [2, 0, 4, 1, 3], [1, 4, 0, 3, 2]]) {
    assert.deepEqual(apply(order.map(k => pairs[k])), base);
  }
});

test("3×3スタンプの階数は16で、核は9次元", () => {
  assert.equal(RANK, 16);
  assert.equal(KERNEL.length, SZ - RANK);
  // 核の要素は、押しても盤面が変わらない押し方
  for (const comb of KERNEL) {
    const s = empty();
    for (let i = 0; i < SZ; i++) if (comb & (1 << i)) stamp(s, i, M);
    assert.deepEqual(s, empty());
  }
});

test("像の外の盤面は解けない", () => {
  // 階数16なので到達できる盤面は 2^16 通りしかなく、解けない配置が必ず存在する
  let unreachable = 0;
  for (let i = 0; i < SZ; i++) if (solvePlane(1 << i) === null) unreachable++;
  assert.ok(unreachable > 0, "1マスだけ染める課題には解けないものがあるはず");
});

test("核の重みはすべて偶数なので、平面ごとに手数のパリティが決まる", () => {
  for (const comb of KERNEL) assert.equal(popcount(comb) % 2, 0);
  // その帰結として、片方のパリティは到達不能になる
  assert.deepEqual(minByParity(0), [0, Infinity]);
  assert.deepEqual(minByParity(MASK[12]), [Infinity, 1]);
});

test("空の盤面の最小手数は0", () => {
  assert.equal(trueMinimum(empty()), 0);
});

test("slotCounts は手数を三色へ順に配る", () => {
  assert.deepEqual(slotCounts(0), [0, 0, 0]);
  assert.deepEqual(slotCounts(3), [1, 1, 1]);
  assert.deepEqual(slotCounts(7), [3, 2, 2]);
  for (let m = 0; m <= MAX_MOVES; m++) {
    assert.equal(slotCounts(m).reduce((a, b) => a + b, 0), m);
  }
});

test("planesOf は色ごとのビット面に分解する", () => {
  const s = empty();
  stamp(s, 12, M);
  stamp(s, 12, B);
  const [pm, py, pb] = planesOf(s);
  assert.equal(pm, MASK[12]);
  assert.equal(py, 0);
  assert.equal(pb, MASK[12]);
});

test("到達できない配置がある（色を選べない制約の帰結）", () => {
  const magenta = stamp(empty(), 12, M);
  assert.equal(trueMinimum(magenta), 1, "1手目は必ずマゼンタなので1手で作れる");

  // イエローだけの盤面は押下列からは決して生まれない。par は null になり、
  // 呼び出し側は手数制限なし（表示は「—」）として扱う。
  const yellow = stamp(empty(), 12, Y);
  assert.equal(trueMinimum(yellow), null);
});

test("押下列から組んだ盤面は必ず解けて、手数は列の長さ以下", () => {
  for (const seq of [[12], [0, 4], [6, 8, 16], [0, 12, 24, 6, 18], [1, 3, 12]]) {
    const board = seq.reduce((s, idx, j) => stamp(s, idx, SEQ[j % 3]), empty());
    const par = trueMinimum(board);
    assert.notEqual(par, null, `${seq} が解けない`);
    assert.ok(par <= seq.length, `par ${par} が列の長さ ${seq.length} を超えた`);
  }
});

test("盤の寸法", () => {
  assert.equal(N, 5);
  assert.equal(SZ, 25);
  assert.equal(MASK.length, SZ);
});
