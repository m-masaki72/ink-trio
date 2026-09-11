import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SAVE_KEY, SAVE_VERSION, DEFAULTS, LEVELS, MARK_MODES,
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
  for (const raw of [null, undefined, {}, { v: 3 }, { v: "2" }, [], 42, "x"]) {
    assert.deepEqual(sanitize(raw, OPTS), { ...DEFAULTS, cleared: [], totals: {}, today: {} });
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
  assert.deepEqual(keys, ["cleared", "crt", "day", "done", "level", "marks", "pal", "reached", "snd", "today", "totals", "v"]);
});
