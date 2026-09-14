import { test, expect } from "@playwright/test";
import { openGame, press, openSettings, status, par, STAGE } from "./helpers.js";

test("色以外の目印を4通りに切り替えられる", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await openSettings(page);

  await page.click('.seg button[data-mark="bars"]');
  await expect(page.locator("#board .tag.show")).toHaveCount(25);
  await expect(page.locator("#board .tag.letters")).toHaveCount(0, "帯は文字を出さない");

  await page.click('.seg button[data-mark="letters"]');
  await expect(page.locator("#board .tag.show.letters")).toHaveCount(25);

  await page.click('.seg button[data-mark="digits"]');
  await expect(page.locator("#board .num.show")).toHaveCount(25);
  await expect(page.locator("#board .tag.show")).toHaveCount(0);

  await page.click('.seg button[data-mark="none"]');
  await expect(page.locator("#board .tag.show")).toHaveCount(0);
  await expect(page.locator("#board .num.show")).toHaveCount(0);
  await game.expectClean();
});

test("配色を替えると盤とインク表の両方に効く", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  const blank = page.locator("#proof .cell").nth(24);      // インクの乗らないマス
  await expect(blank).toHaveCSS("background-color", "rgb(30, 20, 32)");   // vivid の白紙

  await openSettings(page);
  await page.click('.seg button[data-pal="pastel"]');
  await expect(blank).toHaveCSS("background-color", "rgb(43, 37, 54)");   // pastel の白紙
  await expect(page.locator("#chips .chip")).toHaveCount(7);
  await game.expectClean();
});

test("ブラウン管とフラットを切り替えられる", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await expect(page.locator("html")).toHaveClass(/screen/);
  await openSettings(page);
  await page.click('.seg button[data-crt="off"]');
  await expect(page.locator("html")).not.toHaveClass(/screen/);
  await game.expectClean();
});

test("ズレを示すと、目標と違うマスに印が出る", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await openSettings(page);
  await page.click("#diff");
  const before = await page.locator("#board .miss.show").count();
  expect(before).toBeGreaterThan(0);

  await press(page, 6);
  // 6 と 8 の3×3は列2で重なるので、一手では9マスぶんきれいには合わない
  await expect.poll(() => page.locator("#board .miss.show").count()).toBeLessThan(before);

  await press(page, 8);
  await press(page, 16);
  await expect(page.locator("#board .miss.show")).toHaveCount(0, "揃えば印は消える");
  await game.expectClean();
});

test("答えを見ると手順が並び、次の課題では閉じる", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await openSettings(page);
  // 答えを最初から DOM に置くと、押さずに開発者ツールで読めてしまう
  await expect(page.locator("#sol li")).toHaveCount(0, "押すまで手順を書き出さない");
  await page.click("#peek");
  await expect(page.locator("#sol")).toBeVisible();
  await expect(page.locator("#sol li")).toHaveCount(3);
  await expect(page.locator("#sol li").first()).toHaveText(/行.*列.*マゼンタ/);

  await page.click('.tab[data-mode="free"]');   // 難易度は「自由」でだけ出す
  await page.click('.seg button[data-k="3"]');
  await expect(page.locator("#peek")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#sol")).toBeHidden();
  await game.expectClean();
});

test("表示設定は次に開いたときも残る", async ({ page }) => {
  const game = await openGame(page, null);          // 保存値を仕込まず、既定から始める
  await openSettings(page);
  await page.click('.seg button[data-mark="digits"]');
  await page.click('.seg button[data-pal="pastel"]');
  await page.click('.seg button[data-crt="off"]');

  await page.reload();
  await expect(page.locator('.seg button[data-mark="digits"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.seg button[data-pal="pastel"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).not.toHaveClass(/screen/);
  await expect(page.locator("#board .num.show")).toHaveCount(25, "保存値が描画にも反映される");
  await game.expectClean();
});

test("練習の続きから再開する", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.内側の四隅 });
  await expect(status(page)).toContainText("練習 17 / 21");
  await expect(par(page)).toHaveText("4");
  await game.expectClean();
});

test("記録を消すと練習の1面目に戻る", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.内側の四隅, totals: { "6": 12 } });
  await openSettings(page);
  await expect(page.locator("#saveInfo")).toHaveText("保存できます");

  await page.click("#wipe");
  await expect(status(page)).toContainText("記録を消しました");
  await expect(par(page)).toHaveText("1");
  await expect(page.locator('#tallyList dt:text-is("ふつう") + .val'))
    .toContainText("0", "通算も 0 に戻る");

  await page.reload();
  await expect(status(page)).toContainText("練習 1 / 21", "消したことが保存されている");
  await game.expectClean();
});

test("設定パネルは Escape で閉じる", async ({ page }) => {
  const game = await openGame(page, {});
  await page.click("#opts");
  await expect(page.locator("#optpanel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#optpanel")).toBeHidden();
  await expect(page.locator("#opts")).toHaveAttribute("aria-expanded", "false");
  await game.expectClean();
});

test("ズレを示すは、課題をまたいでも開き直しても残る", async ({ page }) => {
  const game = await openGame(page, null);
  await openSettings(page);
  await page.click("#diff");
  await expect(page.locator("#diff")).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.locator("#diff")).toHaveAttribute("aria-pressed", "true", "他の設定と同じく保存される");
  expect(await page.locator("#board .miss.show").count()).toBeGreaterThan(0, "描画にも反映される");

  await page.click('.tab[data-mode="free"]');   // 難易度は「自由」でだけ出す
  await page.click('.seg button[data-k="3"]');
  await expect(page.locator("#diff")).toHaveAttribute("aria-pressed", "true", "課題を変えても消えない");
  await game.expectClean();
});

test("別の課題ボタンは、いまの遊び方に合わせて振る舞う", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await expect(page.locator("#reroll")).toHaveText("この面をやり直す");

  await press(page, 6);
  await page.click("#reroll");
  await expect(page.locator("#board .cell.lit")).toHaveCount(0, "同じ面を白紙からやり直す");
  await expect(status(page)).toContainText("練習 11 / 21");

  await page.click('.tab[data-mode="free"]');   // 難易度は「自由」でだけ出す
  await page.click('.seg button[data-k="6"]');
  await expect(page.locator("#reroll")).toHaveText("別の課題");
  const 出題 = () => page.locator("#proof").getAttribute("aria-label")
    .then(() => page.evaluate(() =>
      [...document.querySelectorAll("#proof .cell")].map(c => c.getAttribute("aria-label")).join("|")));
  const 前 = await 出題();
  await page.click("#reroll");
  expect(await 出題()).not.toBe(前, "別の盤面に差し替わる");
  await game.expectClean();
});

test.describe("動きを減らす設定", () => {
  test.use({ reducedMotion: "reduce" });

  test("手数超過は、動かさずに明滅で伝える", async ({ page }) => {
    const game = await openGame(page, { reached: STAGE.中心をひと押し });
    await press(page, 0);                       // 揃わない手で使い切る
    await press(page, 24);                      // 超過
    await expect(page.locator(".deck")).toHaveClass(/spent/);
    const anim = await page.locator(".deck").evaluate(e => getComputedStyle(e).animationName);
    expect(anim, "nudge は動きなので使わない").toBe("blocked-flash");
    await game.expectClean();
  });
});

test.describe("動きを許す設定", () => {
  test.use({ reducedMotion: "no-preference" });

  test("既定では横に揺れて伝える", async ({ page }) => {
    const game = await openGame(page, { reached: STAGE.中心をひと押し });
    await press(page, 0);
    await press(page, 24);
    const anim = await page.locator(".deck").evaluate(e => getComputedStyle(e).animationName);
    expect(anim).toBe("nudge");
    await game.expectClean();
  });
});
