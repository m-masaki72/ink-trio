// 盤の進行。描画にも音にも保存にも触らず、押された結果だけを返す。

import { SZ, SEQ, stamp } from "./rules.js";
import { buildPuzzle } from "./puzzles.js";

export const PRESSED = "pressed";
export const BLOCKED = "blocked";   // 手数を使い切っている
export const IGNORED = "ignored";   // すでに刷り上がっている
export const UNDONE = "undone";
export const EMPTY = "empty";       // これ以上は戻せない

export function createGame() {
  let board = new Array(SZ).fill(0);
  let target = new Array(SZ).fill(0);
  let answer = [];
  let par = 0;
  let moves = 0;
  let history = [];
  let solved = false;
  let undoCount = 0;

  const cap = () => (par === null ? Infinity : par);
  const remaining = () => (par === null ? Infinity : Math.max(0, par - moves));
  const nextInk = () => SEQ[moves % 3];
  const matched = () => board.every((v, i) => v === target[i]);

  return {
    load(cellSeq) {
      const p = buildPuzzle(cellSeq);
      target = p.target;
      answer = p.answer;
      par = p.par;
      board = new Array(SZ).fill(0);
      moves = 0;
      history = [];
      solved = false;
      undoCount = 0;
    },
    press(idx) {
      if (solved) return { type: IGNORED };
      if (moves >= cap()) return { type: BLOCKED };
      const bit = nextInk();
      history.push({ board: board.slice(), moves, i: idx });
      stamp(board, idx, bit);
      moves++;
      solved = matched();
      return { type: PRESSED, idx, bit, moves, solved };
    },
    undo() {
      if (solved || history.length === 0) return { type: EMPTY };
      const h = history.pop();
      undoCount++;
      board = h.board;
      moves = h.moves;
      return { type: UNDONE, idx: h.i };
    },
    // 押した列は history が既に持っている。外で数え直すと同期漏れが起きる
    get pressed() { return history.map(h => h.i); },
    get undos() { return undoCount; },
    cellAt: i => board[i],
    targetAt: i => target[i],
    mismatched: i => board[i] !== target[i],
    get board() { return board; },
    get target() { return target; },
    get answer() { return answer; },
    get par() { return par; },
    get moves() { return moves; },
    get solved() { return solved; },
    get canUndo() { return history.length > 0 && !solved; },
    remaining,
    nextInk,
  };
}
