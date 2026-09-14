import { expect } from "@playwright/test";

export const STAGE = { 中心をひと押し: 0, 三つの重なり: 10, 内側の四隅: 16, 総仕上げ: 19 };

// 練習は毎回同じ盤面が出るので、到達面を仕込めば出題を固定できる。
// ランダム出題に頼ると、検証が乱数任せになってしまう。
export function saved(overrides = {}) {
  return JSON.stringify({
    v: 2, reached: 0, cleared: [], done: false, level: 6,
    marks: "none", pal: "vivid", snd: false, crt: true,
    totals: {}, day: "", today: {}, ...overrides,
  });
}

export async function openGame(page, overrides) {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).split("\n")[0]));
  // 例外を投げずに描画だけ壊れるもの（SVG の属性エラーなど）も拾う。
  // 実際に、トンボの transform が3隅ぶん無言で失敗していた。
  // 書体の取得失敗と通信の失敗だけは除く ── 検証環境と圏外テストの都合で、
  // 製品の欠陥ではない（書体は system-ui に落ちて遊びは成立する）
  const 環境の雑音 = /downloadable font|download failed|Failed to load resource|net::ERR_|NS_ERROR_/i;
  page.on("console", m => {
    if (m.type() === "error" && !環境の雑音.test(m.text())) errors.push(m.text().slice(0, 200));
  });
  // addInitScript は再読み込みのたびに走って保存値を上書きしてしまい、
  // 「保存されるか」を検証できなくなる。一度だけ書いて読み直す。
  await page.goto("/index.html");
  if (overrides !== null) {
    await page.evaluate(s => localStorage.setItem("inktrio.v1", s), saved(overrides));
    await page.reload();
  }
  await page.waitForFunction(() => document.querySelectorAll("#board .cell").length === 25);
  return {
    // 検証の終わりに必ず呼ぶ。JS エラーと CSP 違反はどのテストでも許さない。
    async expectClean() {
      expect(errors, `ページのエラー: ${errors.join(" / ")}`).toEqual([]);
    },
  };
}

export const press = (page, i) => page.click(`#board .cell[data-i="${i}"]`);
export const remaining = page => page.locator("#moves");
export const par = page => page.locator("#par");
export const status = page => page.locator("#status");

// 答えの手順どおりに押して揃える
export async function solve(page, cells) {
  for (const i of cells) await press(page, i);
}

export async function openSettings(page) {
  if (await page.locator("#optpanel").isHidden()) await page.click("#opts");
}
