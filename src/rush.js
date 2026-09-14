// 時間走。制限時間のあいだ、難しい課題をどれだけさばけるか。
// 日刊と違って盤面を共有しない。プールから引くので事前に用意できず、
// 多重アカウントで練習しても別の盤が来るだけになる。
// 時計と乱数を注入するので、ブラウザなしで検証できる。

import { pickInBand } from "./puzzles.js";

export const RUSH_LEVEL = 10;
export const RUSH_MS = 300000;      // 5分
export const RUNS_PER_DAY = 3;      // 記録に残る走行。これを超えたぶんは練習

// 号に紐づかないので素の乱数で引く。帯は日刊と同じものを使う。
// 難度が揃っていないと、問数で比べる意味がなくなる
export const pickPuzzle = (random = Math.random, level = RUSH_LEVEL) =>
  pickInBand(level, () => random);

export function createRun({ now, random = Math.random, limit = RUSH_MS, level = RUSH_LEVEL }) {
  let startedAt = null;
  let solved = 0;
  let lastSolveMs = 0;
  let current = null;
  let stopped = false;
  const passed = [];

  const elapsed = () => (startedAt === null ? 0 : Math.max(0, now() - startedAt));
  const remaining = () => (startedAt === null ? limit : Math.max(0, limit - elapsed()));
  const over = () => stopped || (startedAt !== null && remaining() === 0);

  function advance() {
    if (over()) { current = null; return null; }
    current = pickPuzzle(random, level);
    return current;
  }

  return {
    start() {
      if (startedAt !== null) return current;
      startedAt = now();
      return advance();
    },
    solve() {
      if (over() || current === null) return null;
      solved++;
      lastSolveMs = Math.round(elapsed());   // 並べ替えの副軸は「そこへ届いた時刻」
      return advance();
    },
    pass() {
      if (over() || current === null) return null;
      passed.push(current);
      return advance();
    },
    stop() { stopped = true; current = null; },
    elapsed,
    remaining,
    get current() { return current; },
    get solved() { return solved; },
    get passed() { return passed.slice(); },
    get running() { return startedAt !== null && !over(); },
    get finished() { return startedAt !== null && over(); },
    result: () => ({ solved, ms: lastSolveMs, passed: passed.slice() }),
  };
}

// 同じ問数なら、そこへ早く届いたほうが上
export const better = (a, b) =>
  !b ? true : a.solved !== b.solved ? a.solved > b.solved : a.ms < b.ms;
