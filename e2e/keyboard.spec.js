import { test, expect } from "@playwright/test";
import { openGame, solve, remaining, status, STAGE } from "./helpers.js";

const focused = page => page.evaluate(() => document.activeElement?.dataset?.i ?? null);

test("矢印キーで盤上を移動し、盤の外へは出ない", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.総仕上げ });
  await page.locator('#board .cell[data-i="0"]').focus();

  await page.keyboard.press("ArrowRight");
  expect(await focused(page)).toBe("1");
  await page.keyboard.press("ArrowDown");
  expect(await focused(page)).toBe("6");

  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  expect(await focused(page)).toBe("1", "上端で止まる");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  expect(await focused(page)).toBe("0", "左端で止まる");
  await game.expectClean();
});

test("Enter と Space でインクを乗せられる", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.総仕上げ });
  await page.locator('#board .cell[data-i="12"]').focus();
  await page.keyboard.press("Enter");
  await expect(remaining(page)).toHaveText("5");
  await page.keyboard.press(" ");
  await expect(remaining(page)).toHaveText("4");
  await game.expectClean();
});

test("Z と Backspace で一手もどせる", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.総仕上げ });
  await page.locator('#board .cell[data-i="12"]').focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(remaining(page)).toHaveText("4");

  await page.keyboard.press("z");
  await expect(remaining(page)).toHaveText("5");
  await page.keyboard.press("Backspace");
  await expect(remaining(page)).toHaveText("6");
  await page.keyboard.press("z");
  await expect(status(page)).toContainText("これ以上は戻せません");
  await game.expectClean();
});

test("Escape で自動遷移を止められる", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await solve(page, [6, 8, 16]);
  await expect(page.locator("#count")).toContainText("秒後に");

  await page.keyboard.press("Escape");
  await expect(page.locator("#count")).toHaveText("");
  await expect(status(page)).toContainText("盤をクリックすると次へ進みます");
  // 止めたあとは勝手に進まない
  await page.waitForTimeout(3500);
  await expect(status(page)).toContainText("盤をクリックすると次へ進みます");
  await game.expectClean();
});

test("キーボードで辿った操作要素にフォーカスリングが出る", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.総仕上げ });
  await page.locator('#board .cell[data-i="0"]').focus();
  await page.keyboard.press("ArrowRight");
  const ring = await page.evaluate(() => {
    const el = document.activeElement;
    return { visible: el.matches(":focus-visible"), width: getComputedStyle(el).outlineWidth };
  });
  expect(ring.visible).toBe(true);
  expect(ring.width).not.toBe("0px");
  await game.expectClean();
});
