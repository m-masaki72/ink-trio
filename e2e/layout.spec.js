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

    // バーの中身が文字単位で折り返すと、盤が画面外へ押し出される。
    // 「目標と盤が同時に見える」検査はバーの内部が崩れても通ってしまう
    test("遊び方のバーが縦に伸びすぎない", async ({ page }) => {
      await openGame(page, { done: true });
      for (const [mode, bar] of [["daily", "#issuebar"], ["rush", "#rushbar"]]) {
        await page.click(`.tab[data-mode="${mode}"]`);
        const h = await page.locator(bar).evaluate(e => e.getBoundingClientRect().height);
        expect(h, `${mode} のバーが ${Math.round(h)}px`).toBeLessThanOrEqual(130);
      }
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

  // 指の端末では hover が最後に触れた要素へ貼り付いて離れない。
  // 盤に白枠が残ると、色を見比べる遊びが成立しなくなる
  test("hover の見た目はポインタのある端末にだけ出す", async ({ page }) => {
    await openGame(page, {});
    const 素通し = await page.evaluate(() => {
      const 外 = [];
      const 辿る = (rules, 守られている) => {
        for (const r of rules) {
          if (r.media) 辿る(r.cssRules, 守られている || /hover\s*:\s*hover/.test(r.conditionText));
          else if (r.selectorText?.includes(":hover") && !守られている) 外.push(r.selectorText);
        }
      };
      // 別オリジンの書体シートは中を読めないので飛ばす
      for (const sheet of document.styleSheets) { try { 辿る(sheet.cssRules, false); } catch {} }
      return 外;
    });
    expect(素通し, "(hover:hover) の外に置くと、タップした要素に残る").toEqual([]);
  });

  test("タップしても青い矩形が乗らない", async ({ page }) => {
    await openGame(page, {});
    const 色 = await page.locator('#board .cell[data-i="0"]')
      .evaluate(e => getComputedStyle(e).webkitTapHighlightColor);
    expect(色, "色を見比べる遊びなので、マスに別の色を重ねさせない").toBe("rgba(0, 0, 0, 0)");
  });
});
