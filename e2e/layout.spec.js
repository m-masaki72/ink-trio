import { test, expect, devices } from "@playwright/test";
import { openGame, STAGE } from "./helpers.js";

// 色を見比べる遊びなので、目標と盤が同時に見えないと成立しない。
// 端末の再現（isMobile / hasTouch）は Chromium でしか使えないため、
// このファイルは chromium の project だけが拾う（playwright.config.js の testIgnore）。
const 端末 = ["iPhone SE", "iPhone 12 Mini", "iPhone 14", "iPhone 15 Pro", "Pixel 7"];
const プロファイル = name => {
  const { defaultBrowserType, ...rest } = devices[name];   // describe 内でブラウザは変えられない
  return rest;
};

for (const name of 端末) {
  test.describe(name, () => {
    test.use(プロファイル(name));

    test("目標と盤が同時に見える", async ({ page }) => {
      await openGame(page, { reached: STAGE.三つの重なり });
      const { 必要な高さ, 表示領域 } = await page.evaluate(() => {
        const r = s => document.querySelector(s).getBoundingClientRect();
        return { 必要な高さ: r("#board").bottom - r("#proof").top, 表示領域: innerHeight };
      });
      expect(必要な高さ, `${Math.round(必要な高さ)}px 必要だが ${表示領域}px しかない`)
        .toBeLessThanOrEqual(表示領域);
    });

    test("盤を見ながら状態文も読める", async ({ page }) => {
      await openGame(page, { reached: STAGE.三つの重なり });
      const { 必要な高さ, 表示領域 } = await page.evaluate(() => {
        const r = s => document.querySelector(s).getBoundingClientRect();
        return { 必要な高さ: r(".statusline").bottom - r("#board").top, 表示領域: innerHeight };
      });
      expect(必要な高さ).toBeLessThanOrEqual(表示領域);
    });

    test("押すマスは指で狙える大きさを保つ", async ({ page }) => {
      await openGame(page, { reached: STAGE.三つの重なり });
      const w = await page.locator("#board .cell").first().evaluate(e => e.getBoundingClientRect().width);
      expect(w, "刷り台のマスは縮めない").toBeGreaterThanOrEqual(44);
    });

    test("横スクロールは出ない", async ({ page }) => {
      await openGame(page, { reached: STAGE.三つの重なり });
      const over = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
    });
  });
}

test.describe("タッチ端末", () => {
  test.use(プロファイル("iPhone 14"));

  test("右クリックのない端末には、そう案内しない", async ({ page }) => {
    await openGame(page, { done: true, level: 3 });
    await expect(page.locator("#status")).toContainText("タップ");
    await expect(page.locator("#status")).not.toContainText("右クリック");

    for (const i of [0, 1, 2]) await page.tap(`#board .cell[data-i="${i}"]`);
    await page.tap('#board .cell[data-i="24"]');
    await expect(page.locator("#status")).toContainText("一手もどす");
    await expect(page.locator("#status")).not.toContainText("右クリック");
  });
});
