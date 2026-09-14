import { test, expect } from "@playwright/test";
import { openGame, status } from "./helpers.js";
import { RUSH_LEVEL } from "../src/rush.js";

// 時間走の盤はプールから引くので、検証側は答えを知らない。
// 画面の「答えを見る」から読み取って押す。遊ぶ人と同じ経路をたどる
async function 答えを読む(page) {
  if (await page.locator("#optpanel").isHidden()) await page.click("#opts");
  if (await page.locator("#peek").getAttribute("aria-pressed") !== "true") {
    await page.click("#peek");
  }
  const rows = await page.locator("#sol li").allTextContents();
  return rows.map(t => {
    const m = t.match(/(\d+)行(\d+)列/);
    return (Number(m[1]) - 1) * 5 + (Number(m[2]) - 1);
  });
}

async function 一問さばく(page) {
  for (const i of await 答えを読む(page)) {
    await page.click(`#board .cell[data-i="${i}"]`);
  }
}

test("時間走のタブは、走り出す前は満タンで待っている", async ({ page }) => {
  const game = await openGame(page, { done: true });
  await page.click('.tab[data-mode="rush"]');

  await expect(page.locator("#rushLeft")).toHaveText("5:00");
  await expect(page.locator("#rushStart")).toBeVisible();
  await expect(page.locator("#rushPass")).toBeHidden();
  await expect(page.locator("#rushQuit")).toBeHidden();
  await expect(page.locator("#rushNote")).toContainText("あと3回");
  await expect(status(page)).toContainText("「走る」で 5分の走行が始まります");
  await game.expectClean();
});

test("走り出すと十手の盤が出て、時計が減る", async ({ page }) => {
  const game = await openGame(page, { done: true });
  await page.click('.tab[data-mode="rush"]');
  await page.click("#rushStart");

  await expect(page.locator("#par")).toHaveText(String(RUSH_LEVEL));
  await expect(page.locator("#rushPass")).toBeVisible();
  await expect(page.locator("#rushStart")).toBeHidden();

  await page.waitForTimeout(1300);
  await expect(page.locator("#rushLeft")).not.toHaveText("5:00");
  await game.expectClean();
});

// 校了の3秒演出を出すと、持ち時間をそのぶん食う
test("解くとすぐ次の盤が来る。校了の判は出ない", async ({ page }) => {
  await openGame(page, { done: true });
  await page.click('.tab[data-mode="rush"]');
  await page.click("#rushStart");

  await 一問さばく(page);
  await expect(page.locator("#rushCount")).toHaveText("1問");
  await expect(page.locator("#finish")).toBeHidden();
  await expect(page.locator("#board .cell.lit")).toHaveCount(0, "次の盤は白紙から");
  await expect(page.locator("#par")).toHaveText(String(RUSH_LEVEL));
});

test("パスしても問数は増えず、次の盤が来る", async ({ page }) => {
  await openGame(page, { done: true });
  await page.click('.tab[data-mode="rush"]');
  await page.click("#rushStart");

  await page.click("#rushPass");
  await expect(page.locator("#rushCount")).toHaveText("0問");
  await expect(page.locator("#board .cell.lit")).toHaveCount(0);
});

test("やめると記録が残り、パスした問を見直せる", async ({ page }) => {
  const game = await openGame(page, { done: true });
  await page.click('.tab[data-mode="rush"]');
  await page.click("#rushStart");

  await 一問さばく(page);
  await page.click("#rushPass");
  await page.click("#rushQuit");

  await expect(status(page)).toContainText("時間走 おわり。1問");
  await expect(status(page)).toContainText("パスした1問を見直せます");
  await expect(page.locator("#rushReview")).toBeVisible();
  await expect(page.locator("#rushNote")).toContainText("あと2回");
  await expect(page.locator('#tallyList dt:text-is("時間走") + .val'))
    .toContainText("1", "自己最高が記録欄に出る");

  await page.click("#rushReview");
  await expect(status(page)).toContainText("見直し");
  await expect(page.locator("#rushReview")).toBeHidden("見直す問がなくなったら隠す");
  await game.expectClean();
});

test("記録に残せる走行を使い切ると練習走行になる", async ({ page }) => {
  await openGame(page, { done: true, rush: { day: "", count: 3, today: null, best: null } });
  await page.click('.tab[data-mode="rush"]');
  // 日付が変わっているので回数は戻る
  await expect(page.locator("#rushNote")).toContainText("あと3回");

  for (let i = 0; i < 3; i++) {
    await page.click("#rushStart");
    await page.click("#rushQuit");
  }
  await expect(page.locator("#rushNote")).toContainText("練習走行");

  // 四回目からは記録しない
  await page.click("#rushStart");
  await page.click("#rushQuit");
  await expect(status(page)).toContainText("記録には残しません（練習走行）");
});

test("ほかのタブへ移ると走行は止まる", async ({ page }) => {
  await openGame(page, { done: true });
  await page.click('.tab[data-mode="rush"]');
  await page.click("#rushStart");
  await page.click('.tab[data-mode="free"]');
  await expect(page.locator("#rushbar")).toBeHidden();

  await page.click('.tab[data-mode="rush"]');
  await expect(page.locator("#rushLeft")).toHaveText("5:00", "走行はやり直しから");
  await expect(page.locator("#rushStart")).toBeVisible();
});
