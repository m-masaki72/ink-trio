import { test, expect } from "@playwright/test";
import { openGame, press, status } from "./helpers.js";
import { SHAPE, issueOf, issueSet } from "../src/daily.js";
import { dayKeyOf } from "../src/tally.js";

// 号は日付から決まるので、検証側も同じ規則で引く
const 今日の号 = () => issueOf(dayKeyOf());
const 盤 = () => issueSet(今日の号());

// 刷り上がると3秒で勝手に進む。待たずに、盤を二度押して先へ送る
async function 次へ(page) {
  await page.waitForTimeout(400);
  await page.locator("#board").click();
  await page.locator("#board").click();
}

async function 一問解く(page, seq) {
  for (const i of seq) await press(page, i);
}

test("日刊のタブを開くと今日の号が出る", async ({ page }) => {
  const game = await openGame(page, { done: true });
  await page.click('.tab[data-mode="daily"]');

  await expect(page.locator("#issueNo")).toHaveText(`第${今日の号()}号`);
  await expect(page.locator("#issueStep")).toContainText(`1 / ${SHAPE.length}問目`);
  await expect(status(page)).toContainText(`第${今日の号()}号 1問目（${SHAPE[0]}手）`);
  await expect(page.locator("#par")).toHaveText(String(SHAPE[0]));
  await game.expectClean();
});

// 日刊は難易度が決まっている。選ぶ余地を出すと意味が変わる
test("日刊と練習では難易度ボタンを出さない", async ({ page }) => {
  await openGame(page, { done: true });
  await expect(page.locator("#levels")).toBeVisible();

  await page.click('.tab[data-mode="daily"]');
  await expect(page.locator("#levels")).toBeHidden();
  await expect(page.locator("#reroll")).toBeHidden();

  await page.click('.tab[data-mode="tutorial"]');
  await expect(page.locator("#levels")).toBeHidden();

  await page.click('.tab[data-mode="free"]');
  await expect(page.locator("#levels")).toBeVisible();
});

test("一問ごとに次へ進み、済みの数が増える", async ({ page }) => {
  const game = await openGame(page, { done: true });
  const set = 盤();
  await page.click('.tab[data-mode="daily"]');

  await 一問解く(page, set[0].seq);
  await expect(status(page)).toContainText("1問目、刷り上がりました");
  await expect(page.locator("#issueStep")).toContainText("済 1");

  await 次へ(page);
  await expect(page.locator("#issueStep")).toContainText(`2 / ${SHAPE.length}問目`);
  await expect(page.locator("#par")).toHaveText(String(SHAPE[1]));
  await game.expectClean();
});

test("五問そろえると号が刷り上がり、共有が出る", async ({ page }) => {
  const game = await openGame(page, { done: true });
  const set = 盤();
  await page.click('.tab[data-mode="daily"]');

  for (let i = 0; i < SHAPE.length; i++) {
    await 一問解く(page, set[i].seq);
    if (i < SHAPE.length - 1) await 次へ(page);
  }

  await expect(status(page)).toContainText(`第${今日の号()}号を刷り上げました`);
  await expect(page.locator("#issueStep")).toContainText(`済 ${SHAPE.length}`);
  await expect(page.locator("#shareRow")).toBeVisible();

  // 共有先へ渡す本文は、押した瞬間ではなくリンクに載っているので確かめられる
  const href = await page.locator("#shareX").getAttribute("href");
  expect(decodeURIComponent(href)).toContain(`Ink Trio 第${今日の号()}号`);
  expect(decodeURIComponent(href)).toContain("日刊 5問");
  await game.expectClean();
});

test("解いた記録は開き直しても残る", async ({ page }) => {
  const set = 盤();
  await openGame(page, { done: true });
  await page.click('.tab[data-mode="daily"]');
  await 一問解く(page, set[0].seq);
  await expect(page.locator("#issueStep")).toContainText("済 1");

  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll("#board .cell").length === 25);
  await page.click('.tab[data-mode="daily"]');

  // 済んだ問は飛ばして、続きから開く
  await expect(page.locator("#issueStep")).toContainText(`2 / ${SHAPE.length}問目　済 1`);
});

// 盤を読む時間まで計ると、読み上げで把握する人が一方的に不利になる
test("時計は最初の一手から動きだす", async ({ page }) => {
  const set = 盤();
  await openGame(page, { done: true });
  await page.click('.tab[data-mode="daily"]');

  await expect(page.locator("#issueClock")).toHaveText("0.0秒");
  await page.waitForTimeout(700);
  await expect(page.locator("#issueClock")).toHaveText("0.0秒", { timeout: 1000 });

  await press(page, set[0].seq[0]);
  await expect(page.locator("#issueClock")).not.toHaveText("0.0秒");
});

test("前の号へさかのぼれる", async ({ page }) => {
  await openGame(page, { done: true });
  await page.click('.tab[data-mode="daily"]');
  await expect(page.locator("#issueNext")).toBeDisabled();

  await page.click("#issuePrev");
  await expect(page.locator("#issueNo")).toHaveText(`第${今日の号() - 1}号`);
  await expect(page.locator("#issueNext")).toBeEnabled();
});
