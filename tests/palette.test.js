import { test } from "node:test";
import assert from "node:assert/strict";
import { PAL, PALETTE_NAMES, DIM, luminance, contrastRatio, contrastOn } from "../src/palette.js";

const BITS = [0, 1, 2, 3, 4, 5, 6, 7];
// 相対輝度ではなく知覚明度。README が言う「明度の階段」はこちら。
const Lstar = Y => (Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y);

test("どの配色も8通りの配合すべてに色を持つ", () => {
  for (const name of PALETTE_NAMES) {
    for (const b of BITS) assert.match(PAL[name][b], /^#[0-9a-f]{6}$/, `${name}[${b}]`);
  }
});

test("インクが乗った7色は知覚明度が等間隔の階段になる", () => {
  for (const name of PALETTE_NAMES) {
    const ls = BITS.slice(1).map(b => Lstar(luminance(PAL[name][b]))).sort((a, b) => a - b);
    const steps = ls.slice(1).map((v, i) => v - ls[i]);
    const ratio = Math.max(...steps) / Math.min(...steps);
    assert.ok(ratio <= 1.4, `${name} の段差がばらついている（比 ${ratio.toFixed(2)}）`);
  }
});

test("白紙は7色のどれよりも暗く、離れている", () => {
  for (const name of PALETTE_NAMES) {
    const blank = Lstar(luminance(PAL[name][0]));
    const inked = BITS.slice(1).map(b => Lstar(luminance(PAL[name][b])));
    const lowest = Math.min(...inked);
    assert.ok(blank < lowest, `${name} の白紙が最暗ではない`);
    // インク同士の段差より大きく空けて、乗っているか否かを一目で分ける
    const inkSteps = inked.sort((a, b) => a - b).slice(1).map((v, i) => v - inked[i]);
    assert.ok(lowest - blank > Math.max(...inkSteps), `${name} の白紙が7色に近すぎる`);
  }
});

test("走査線と陰影を通したあとでも文字コントラストが AA を満たす", () => {
  for (const name of PALETTE_NAMES) {
    for (const b of BITS) {
      const hex = PAL[name][b];
      const L = luminance(hex, DIM);
      const ink = contrastOn(hex);
      const ratio = contrastRatio(L, ink === "#000000" ? 0 : 1);
      assert.ok(ratio >= 4.5, `${name}[${b}] ${hex} のコントラストが ${ratio.toFixed(2)}`);
    }
  }
});

test("contrastOn は明暗の二択を返し、より読めるほうを選ぶ", () => {
  assert.equal(contrastOn("#ffffff"), "#000000");
  assert.equal(contrastOn("#000000"), "#ffffff");
  for (const name of PALETTE_NAMES) {
    for (const b of BITS) assert.ok(["#000000", "#ffffff"].includes(contrastOn(PAL[name][b])));
  }
});

test("DIM はオーバーレイぶんだけ暗くする係数", () => {
  assert.ok(DIM > 0 && DIM < 1);
  assert.ok(luminance("#ffffff", DIM) < luminance("#ffffff"));
});
