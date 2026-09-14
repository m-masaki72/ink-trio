import { test } from "node:test";
import assert from "node:assert/strict";
import { RUSH_LEVEL, RUSH_MS, pickPuzzle, createRun, better } from "../src/rush.js";
import { buildPuzzle, inBand } from "../src/puzzles.js";

// 時計を手で進める。実時間に頼るとテストが遅くも脆くもなる
function 時計(start = 0) {
  let t = start;
  return { now: () => t, 進める: ms => { t += ms; } };
}
const 乱数 = seed => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

test("走り出す前は満タンで、走っていない", () => {
  const c = 時計();
  const run = createRun({ now: c.now, random: 乱数(1) });
  assert.equal(run.remaining(), RUSH_MS);
  assert.equal(run.running, false);
  assert.equal(run.finished, false);
  assert.equal(run.current, null);
});

test("走り出すと盤が来て、時間が減る", () => {
  const c = 時計();
  const run = createRun({ now: c.now, random: 乱数(2) });
  const first = run.start();
  assert.ok(Array.isArray(first));
  assert.equal(run.running, true);
  c.進める(1000);
  assert.equal(run.remaining(), RUSH_MS - 1000);
});

// 出題は10手ちょうどで、帯にも収まっていないと問数で比べる意味がなくなる
test("出てくる盤は十手ちょうどで、帯に収まる", () => {
  for (let s = 1; s <= 30; s++) {
    const seq = pickPuzzle(乱数(s));
    assert.equal(seq.length, RUSH_LEVEL);
    assert.equal(buildPuzzle(seq).par, RUSH_LEVEL, `種${s} の最短手数`);
    assert.ok(inBand(seq, RUSH_LEVEL), `種${s} が帯の外`);
  }
});

test("解くと数が増え、次の盤が来る", () => {
  const c = 時計();
  const run = createRun({ now: c.now, random: 乱数(3) });
  const a = run.start();
  c.進める(20000);
  const b = run.solve();
  assert.equal(run.solved, 1);
  assert.ok(Array.isArray(b));
  assert.notDeepEqual(a, b);
});

test("パスしても数は増えず、パスした盤が残る", () => {
  const c = 時計();
  const run = createRun({ now: c.now, random: 乱数(4) });
  const a = run.start();
  run.pass();
  assert.equal(run.solved, 0);
  assert.deepEqual(run.passed, [a]);
});

// 満了の時刻ではなく、そこへ届いた時刻で並べたい
test("記録の時刻は、最後に解けた瞬間", () => {
  const c = 時計();
  const run = createRun({ now: c.now, random: 乱数(5) });
  run.start();
  c.進める(30000); run.solve();
  c.進める(45000); run.solve();
  c.進める(120000);              // そのあと粘っただけの時間は入れない
  assert.deepEqual(run.result(), { solved: 2, ms: 75000, passed: [] });
});

test("制限時間を過ぎたら終わる", () => {
  const c = 時計();
  const run = createRun({ now: c.now, random: 乱数(6) });
  run.start();
  c.進める(RUSH_MS);
  assert.equal(run.remaining(), 0);
  assert.equal(run.running, false);
  assert.equal(run.finished, true);
});

// 時間切れのあとに解けたことにできると、記録が信用できなくなる
test("時間切れのあとは解いてもパスしても増えない", () => {
  const c = 時計();
  const run = createRun({ now: c.now, random: 乱数(7) });
  run.start();
  c.進める(10000); run.solve();
  c.進める(RUSH_MS);
  assert.equal(run.solve(), null);
  assert.equal(run.pass(), null);
  assert.equal(run.solved, 1);
  assert.deepEqual(run.passed, []);
});

test("走り出す前に解こうとしても壊れない", () => {
  const run = createRun({ now: 時計().now, random: 乱数(8) });
  assert.equal(run.solve(), null);
  assert.equal(run.pass(), null);
  assert.equal(run.solved, 0);
});

test("二度走り出しても、盤は取り替わらない", () => {
  const c = 時計();
  const run = createRun({ now: c.now, random: 乱数(9) });
  const a = run.start();
  c.進める(5000);
  assert.deepEqual(run.start(), a);
  assert.equal(run.elapsed(), 5000);
});

test("途中で止められる", () => {
  const c = 時計();
  const run = createRun({ now: c.now, random: 乱数(10) });
  run.start();
  run.stop();
  assert.equal(run.running, false);
  assert.equal(run.finished, true);
  assert.equal(run.solve(), null);
});

test("問数が同じなら、早く届いたほうが上", () => {
  assert.equal(better({ solved: 7, ms: 100 }, null), true);
  assert.equal(better({ solved: 8, ms: 999 }, { solved: 7, ms: 1 }), true);
  assert.equal(better({ solved: 7, ms: 100 }, { solved: 7, ms: 200 }), true);
  assert.equal(better({ solved: 7, ms: 200 }, { solved: 7, ms: 100 }), false);
  assert.equal(better({ solved: 6, ms: 1 }, { solved: 7, ms: 9999 }), false);
});
