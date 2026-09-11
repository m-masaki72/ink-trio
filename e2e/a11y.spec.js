import { test, expect } from "@playwright/test";
import { openGame, press, openSettings, STAGE } from "./helpers.js";

test("盤のマスは位置だけでなく、いま乗っている配合を名乗る", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await expect(page.getByRole("button", { name: "1行1列 白紙", exact: true })).toHaveCount(1);

  await press(page, 6);                       // 1手目はマゼンタ
  await expect(page.getByRole("button", { name: "1行1列 マゼンタ", exact: true })).toHaveCount(1);
  await press(page, 6);                       // 2手目のイエローを重ねる
  await expect(page.getByRole("button", { name: "1行1列 パープル", exact: true })).toHaveCount(1);
  await game.expectClean();
});

test("めざす配色も一マスずつ読める", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  const proof = page.locator("#proof");
  await expect(proof).toHaveAttribute("role", "group");
  await expect(proof).toHaveAttribute("aria-label", /色校正/);
  await expect(proof.getByRole("img")).toHaveCount(25);
  await expect(proof.getByRole("img", { name: "1行1列 マゼンタ", exact: true })).toHaveCount(1);
  await game.expectClean();
});

test("色以外の目印は飾りなので、読み上げには混ざらない", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await openSettings(page);

  // 目印をどれに切り替えても、読み上げ用の名前は変わらない
  for (const mark of ["bars", "letters", "digits", "none"]) {
    await page.click(`.seg button[data-mark="${mark}"]`);
    await expect(page.getByRole("button", { name: "1行1列 白紙", exact: true })).toHaveCount(1);
  }
  // opacity で見せ消ししている M・Y・B と数字がツリーに出ていないこと
  const snapshot = await page.locator("#board").ariaSnapshot();
  expect(snapshot).not.toMatch(/\bM\s+Y\s+B\b/);
  await game.expectClean();
});

test("ずれているマスは、印だけでなく名前でも分かる", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await openSettings(page);
  await page.click("#diff");
  await expect(page.locator("#board .cell[aria-label$='ずれている']").first()).toBeVisible();

  const ずれ数 = await page.locator("#board .cell[aria-label$='ずれている']").count();
  expect(ずれ数).toBe(await page.locator("#board .miss.show").count(), "印と名前の数が一致する");
  await game.expectClean();
});

test("盤と目標のグループに名前が付いている", async ({ page }) => {
  const game = await openGame(page, {});
  await expect(page.getByRole("group", { name: "刷り台 5×5" })).toBeVisible();
  await expect(page.getByRole("group", { name: /色校正/ })).toBeVisible();
  await game.expectClean();
});
