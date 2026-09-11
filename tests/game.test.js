import { test } from "node:test";
import assert from "node:assert/strict";
import { SZ, M, Y, B } from "../src/rules.js";
import { TUTORIAL } from "../src/puzzles.js";
import { createGame, PRESSED, BLOCKED, IGNORED, UNDONE, EMPTY } from "../src/game.js";

const stage = n => TUTORIAL[n].s;

test("読み込み直後は白紙で、最短手数が入る", () => {
  const g = createGame();
  g.load(stage(10));
  assert.equal(g.par, 3);
  assert.equal(g.moves, 0);
  assert.equal(g.solved, false);
  assert.equal(g.canUndo, false);
  assert.equal(g.remaining(), 3);
  assert.deepEqual(g.board, new Array(SZ).fill(0));
});

test("インクは押すたびにマゼンタ・イエロー・ブルーで巡る", () => {
  const g = createGame();
  g.load(stage(19));                // 6手の面。押す場所は何でもよい
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(() => {
    const bit = g.nextInk();
    g.press(12);
    return bit;
  }), [M, Y, B, M, Y, B]);
});

test("答えの手順どおりに押すと刷り上がる", () => {
  for (const n of [0, 5, 10, 20]) {
    const g = createGame();
    g.load(stage(n));
    stage(n).forEach(i => g.press(i));
    assert.equal(g.solved, true, `練習 ${n + 1} が揃わない`);
    assert.equal(g.moves, g.par);
    assert.equal(g.remaining(), 0);
  }
});

test("最短手数を超えては押せない", () => {
  const g = createGame();
  g.load(stage(0));                 // 1手の面
  assert.equal(g.press(0).type, PRESSED);
  const blocked = g.press(4);
  assert.equal(blocked.type, BLOCKED);
  assert.equal(g.moves, 1, "弾かれた手は数えない");
});

test("刷り上がったあとの押下は無視される", () => {
  const g = createGame();
  g.load(stage(10));
  stage(10).forEach(i => g.press(i));
  const after = g.board.slice();
  assert.equal(g.press(0).type, IGNORED);
  assert.deepEqual(g.board, after);
});

test("一手もどすと直前の盤面に戻る", () => {
  const g = createGame();
  g.load(stage(16));
  const snapshots = [g.board.slice()];
  stage(16).slice(0, 3).forEach(i => { g.press(i); snapshots.push(g.board.slice()); });

  for (let k = snapshots.length - 1; k > 0; k--) {
    const r = g.undo();
    assert.equal(r.type, UNDONE);
    assert.deepEqual(g.board, snapshots[k - 1]);
  }
  assert.equal(g.moves, 0);
  assert.equal(g.undo().type, EMPTY, "白紙より先は戻れない");
});

test("もどす操作は戻した位置を返す（光らせるのに使う）", () => {
  const g = createGame();
  g.load(stage(10));
  g.press(8);
  assert.equal(g.undo().idx, 8);
});

test("刷り上がったあとは戻せない", () => {
  const g = createGame();
  g.load(stage(10));
  stage(10).forEach(i => g.press(i));
  assert.equal(g.canUndo, false);
  assert.equal(g.undo().type, EMPTY);
});

test("ずれているマスを数えられる", () => {
  const g = createGame();
  g.load(stage(0));
  const before = [...Array(SZ).keys()].filter(i => g.mismatched(i)).length;
  assert.ok(before > 0);
  g.press(stage(0)[0]);
  assert.equal([...Array(SZ).keys()].filter(i => g.mismatched(i)).length, 0);
});

test("読み込み直すと履歴ごと白紙に戻る", () => {
  const g = createGame();
  g.load(stage(10));
  g.press(6);
  g.load(stage(0));
  assert.equal(g.moves, 0);
  assert.equal(g.canUndo, false);
  assert.equal(g.par, 1);
  assert.deepEqual(g.board, new Array(SZ).fill(0));
});

test("色を選べない制約は盤の進行にも効く", () => {
  const g = createGame();
  g.load(stage(12));               // いらない色を消す（4手）
  assert.equal(g.nextInk(), M, "一手目は必ずマゼンタ");
  g.press(12);
  assert.equal(g.nextInk(), Y);
  g.press(0);
  assert.equal(g.nextInk(), B);
});
