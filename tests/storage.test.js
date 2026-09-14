import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SAVE_KEY, SAVE_VERSION, KNOWN_VERSIONS, DEFAULTS, LEVELS, MARK_MODES,
  MAX_SETS, MAX_MS, freshDaily, freshRush,
  sanitize, serialize, openBackend, createSaveFile,
} from "../src/storage.js";

const OPTS = { stageCount: 21, paletteNames: ["vivid", "pastel"] };
const full = extra => ({ v: SAVE_VERSION, reached: 0, cleared: [], done: false,
  level: 6, marks: "none", pal: "vivid", snd: true, crt: true,
  totals: {}, day: "", today: {}, ...extra });

function fakeBackend(initial) {
  const m = new Map();
  if (initial !== undefined) m.set(SAVE_KEY, initial);
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    size: () => m.size,
  };
}
const brokenBackend = () => ({
  getItem() { throw new Error("使えない"); },
  setItem() { throw new Error("使えない"); },
  removeItem() { throw new Error("使えない"); },
});

test("到達面数は下限も上限も枠に収める", () => {
  // 同一オリジンの別ページからも書ける値なので、負数で起動不能にさせない
  assert.equal(sanitize(full({ reached: -5 }), OPTS).reached, 0);
  assert.equal(sanitize(full({ reached: -1e9 }), OPTS).reached, 0);
  assert.equal(sanitize(full({ reached: 999 }), OPTS).reached, 20);
  assert.equal(sanitize(full({ reached: "3" }), OPTS).reached, 3);
  assert.equal(sanitize(full({ reached: "abc" }), OPTS).reached, 0);
  assert.equal(sanitize(full({ reached: NaN }), OPTS).reached, 0);
});

test("知らない版と壊れた値は既定に落とす", () => {
  for (const raw of [null, undefined, {}, { v: 9 }, { v: "2" }, [], 42, "x"]) {
    assert.deepEqual(sanitize(raw, OPTS),
      { ...DEFAULTS, cleared: [], totals: {}, today: {}, daily: freshDaily(), rush: freshRush() });
  }
});

// 版を上げたときに古い保存を弾くと、遊んでいた人の進行度がその場で消える
test("前の版の保存を読んでも進行度は消えない", () => {
  for (const v of KNOWN_VERSIONS) {
    const out = sanitize({ ...full({ reached: 7, done: true }), v }, OPTS);
    assert.equal(out.reached, 7, `v${v} の到達面`);
    assert.equal(out.tutorialDone, true, `v${v} の練習済み`);
    assert.deepEqual(out.daily, freshDaily(), `v${v} には日刊が無い`);
  }
});

test("選択肢のある項目は許可リストで照合する", () => {
  for (const lv of LEVELS) assert.equal(sanitize(full({ level: lv }), OPTS).level, lv);
  assert.equal(sanitize(full({ level: 7 }), OPTS).level, DEFAULTS.level);
  assert.equal(sanitize(full({ level: "6" }), OPTS).level, DEFAULTS.level);

  for (const mk of MARK_MODES) assert.equal(sanitize(full({ marks: mk }), OPTS).markMode, mk);
  assert.equal(sanitize(full({ marks: "<img onerror=x>" }), OPTS).markMode, DEFAULTS.markMode);

  assert.equal(sanitize(full({ pal: "pastel" }), OPTS).palName, "pastel");
  assert.equal(sanitize(full({ pal: "neon" }), OPTS).palName, DEFAULTS.palName);
});

test("集計は素のオブジェクトだけ受け取る", () => {
  assert.deepEqual(sanitize(full({ totals: [1, 2] }), OPTS).totals, {});
  assert.deepEqual(sanitize(full({ totals: "x" }), OPTS).totals, {});
  assert.deepEqual(sanitize(full({ totals: { "6": 3 } }), OPTS).totals, { "6": 3 });
  assert.deepEqual(sanitize(full({ cleared: "x" }), OPTS).cleared, []);
  assert.equal(sanitize(full({ day: 20260911 }), OPTS).dayKey, "");
});

test("ズレ表示は既定がオフで、他の設定と同じく保存される", () => {
  assert.equal(sanitize(full(), OPTS).showDiff, false);
  assert.equal(sanitize(full({ diff: true }), OPTS).showDiff, true);
  assert.equal(sanitize(full({ diff: "yes" }), OPTS).showDiff, false);
  assert.equal(serialize(sanitize(full({ diff: true }), OPTS)).diff, true);
});

test("音と画面は既定がオン、明示的な false だけ効く", () => {
  assert.equal(sanitize(full({ snd: undefined }), OPTS).soundOn, true);
  assert.equal(sanitize(full({ snd: false }), OPTS).soundOn, false);
  assert.equal(sanitize(full({ snd: 0 }), OPTS).soundOn, true);
  assert.equal(sanitize(full({ crt: false }), OPTS).crtOn, false);
});

test("__proto__ を含む保存値でも汚染されない", () => {
  const raw = JSON.parse('{"v":2,"reached":0,"__proto__":{"polluted":1}}');
  sanitize(raw, OPTS);
  assert.equal({}.polluted, undefined);
});

test("書いて読むと同じ状態に戻る", () => {
  const file = createSaveFile(fakeBackend(), OPTS);
  const state = sanitize(full({ reached: 7, level: 10, marks: "digits", pal: "pastel",
    snd: false, crt: false, totals: { "6": 2 }, today: { "6": 1 }, day: "2026-09-11" }), OPTS);
  assert.equal(file.save(state), true);
  assert.deepEqual(file.load(), state);
});

test("保存領域が無くても遊びは止まらない", () => {
  const file = createSaveFile(null, OPTS);
  assert.equal(file.available, false);
  assert.equal(file.save({}), false);
  assert.deepEqual(file.load().reached, 0);
  file.clear();
});

test("保存領域が例外を投げても落ちない", () => {
  const file = createSaveFile(brokenBackend(), OPTS);
  assert.equal(file.save(sanitize(full(), OPTS)), false);
  assert.deepEqual(file.load(), sanitize(null, OPTS));
  file.clear();
});

test("壊れた JSON は既定に落ちる", () => {
  assert.deepEqual(createSaveFile(fakeBackend("{not json"), OPTS).load(), sanitize(null, OPTS));
});

test("記録を消すと入れ物から消える", () => {
  const backend = fakeBackend();
  const file = createSaveFile(backend, OPTS);
  file.save(sanitize(full(), OPTS));
  assert.equal(backend.size(), 1);
  file.clear();
  assert.equal(backend.size(), 0);
});

test("openBackend は使えない環境で null を返す", () => {
  assert.equal(openBackend({ get localStorage() { throw new Error("拒否"); } }), null);
  assert.equal(openBackend({}), null);
  const ok = fakeBackend();
  assert.equal(openBackend({ localStorage: ok }), ok);
});

test("serialize は保存する項目だけを書き出す", () => {
  const keys = Object.keys(serialize(sanitize(full(), OPTS))).sort();
  assert.deepEqual(keys, ["cleared", "crt", "daily", "day", "diff", "done", "level", "marks", "pal", "reached", "rush", "snd", "today", "totals", "v"]);
});

/* ---------- 日刊（v3）---------- */

const withDaily = daily => full({ daily });
const 一組 = extra => ({ ms: [1000, 2000, 3000, 4000, 5000], undo: [0, 1, 0, 0, 2],
  aid: false, seq: [[1], [2, 3], [4, 5], [6], [7]], ...extra });

test("送信は既定でオフ、時計の表示は既定でオン", () => {
  const d = sanitize(withDaily({}), OPTS).daily;
  assert.equal(d.send, false);
  assert.equal(d.clock, true);
});

// ここを真っぽい値で通すと、同意していない人の記録が外へ出る
test("送信は真偽値でしかオンにならない", () => {
  for (const v of ["yes", 1, {}, [], "true"]) {
    assert.equal(sanitize(withDaily({ send: v }), OPTS).daily.send, false, String(v));
  }
  assert.equal(sanitize(withDaily({ send: true }), OPTS).daily.send, true);
});

test("号でないキーは捨てる", () => {
  const sets = { "123": 一組(), "0": 一組(), "-1": 一組(), "1.5": 一組(),
    "abc": 一組(), "12345678": 一組(), "__proto__": 一組() };
  const out = sanitize(withDaily({ sets }), OPTS).daily.sets;
  assert.deepEqual(Object.keys(out), ["123"]);
});

test("形の壊れた号は、その号ごと無かったことにする", () => {
  const sets = {
    "1": 一組(),
    "2": 一組({ seq: null }),                    // 手順がない
    "3": 一組({ seq: [[1], [2]] }),              // 問数が合わない
    "4": 一組({ ms: [] }),                       // 空
    "5": { },                                    // 何もない
  };
  const out = sanitize(withDaily({ sets }), OPTS).daily.sets;
  assert.deepEqual(Object.keys(out), ["1"]);
});

// あとでサーバーへ出して検証してもらう値なので、盤の外を混ぜてはいけない
test("盤の外のマス番号は盤に収める", () => {
  const sets = { "1": 一組({ seq: [[99], [-5], [1.9], [NaN], ["x"]] }) };
  const out = sanitize(withDaily({ sets }), OPTS, ).daily.sets["1"];
  assert.deepEqual(out.seq, [[24], [0], [1], [0], [0]]);
});

test("桁の大きすぎる所要時間は上限で止める", () => {
  const out = sanitize(withDaily({ sets: { "1": 一組({ ms: [1e15, -1, 0, 0, 0] }) } }), OPTS)
    .daily.sets["1"];
  assert.equal(out.ms[0], MAX_MS);
  assert.equal(out.ms[1], 0);
});

test("手戻りの数が欠けていても零で埋める", () => {
  const out = sanitize(withDaily({ sets: { "1": 一組({ undo: undefined }) } }), OPTS)
    .daily.sets["1"];
  assert.deepEqual(out.undo, [0, 0, 0, 0, 0]);
});

// 枠数の合わない記録を通すと「済んだ号」と誤認して、日刊が進まなくなる
test("五問ぶんでない記録は受け取らない", () => {
  for (const ms of [[1], [1, 2, 3], [1, 2, 3, 4, 5, 6]]) {
    const sets = { "257": 一組({ ms, seq: ms.map(() => []) }) };
    assert.deepEqual(Object.keys(sanitize(withDaily({ sets }), OPTS).daily.sets), [],
      `${ms.length}枠`);
  }
  const 正 = { "257": 一組() };
  assert.deepEqual(Object.keys(sanitize(withDaily({ sets: 正 }), OPTS).daily.sets), ["257"]);
});

// 同一オリジンの別ページから保存領域を埋められないようにする
test("号の件数には上限がある", () => {
  const sets = {};
  for (let i = 1; i <= MAX_SETS + 50; i++) sets[String(i)] = 一組();
  const out = sanitize(withDaily({ sets }), OPTS).daily.sets;
  assert.equal(Object.keys(out).length, MAX_SETS);
});

test("日刊は書いて読み戻しても変わらない", () => {
  const daily = { days: 12, lastDay: "2026-09-14", clock: false, send: true,
    sets: { "257": 一組() } };
  const once = sanitize(withDaily(daily), OPTS);
  const twice = sanitize({ ...serialize(once), v: SAVE_VERSION }, OPTS);
  assert.deepEqual(twice.daily, once.daily);
});

/* ---------- 時間走（v3）---------- */

const withRush = rush => full({ rush });

test("走っていなければ記録は空", () => {
  const r = sanitize(withRush({}), OPTS).rush;
  assert.deepEqual(r, freshRush());
});

test("走行の記録は数として読み直す", () => {
  const r = sanitize(withRush({ day: "2026-09-14", count: 2,
    today: { solved: 7, ms: 240000 }, best: { solved: 9, ms: 280000 } }), OPTS).rush;
  assert.equal(r.day, "2026-09-14");
  assert.equal(r.count, 2);
  assert.deepEqual(r.today, { solved: 7, ms: 240000 });
  assert.deepEqual(r.best, { solved: 9, ms: 280000 });
});

// 同一オリジンの別ページから桁の大きい値を入れられても、表示が壊れないようにする
test("走行の記録も値域で止める", () => {
  const r = sanitize(withRush({ count: 1e9,
    today: { solved: 1e9, ms: 1e15 }, best: "こわれている" }), OPTS).rush;
  assert.equal(r.count, 99);
  assert.deepEqual(r.today, { solved: 9999, ms: MAX_MS });
  assert.equal(r.best, null, "数でないものは走っていない扱い");
});

test("時間走も書いて読み戻して変わらない", () => {
  const rush = { day: "2026-09-14", count: 3,
    today: { solved: 5, ms: 100000 }, best: { solved: 8, ms: 250000 } };
  const once = sanitize(withRush(rush), OPTS);
  const twice = sanitize({ ...serialize(once), v: SAVE_VERSION }, OPTS);
  assert.deepEqual(twice.rush, once.rush);
});

// 昇順のまま打ち切ると、上限を超えたあと新しい記録が一切残らなくなる
test("上限を超えたら古い号から捨てる", () => {
  const sets = {};
  for (let i = 1; i <= MAX_SETS + 10; i++) sets[String(i)] = 一組();
  const keys = Object.keys(sanitize(withDaily({ sets }), OPTS).daily.sets).map(Number);
  assert.equal(keys.length, MAX_SETS);
  assert.ok(keys.includes(MAX_SETS + 10), "いちばん新しい号が残る");
  assert.ok(!keys.includes(1), "いちばん古い号が捨てられる");
});
