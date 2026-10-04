import { test, expect } from "@playwright/test";
import { openGame, press, solve, remaining, par, status, STAGE } from "./helpers.js";

test("練習の1面目から始まり、最短手数と目標が示される", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.中心をひと押し });
  await expect(par(page)).toHaveText("1");
  await expect(remaining(page)).toHaveText("1");
  await expect(status(page)).toContainText("練習 1 / 21");
  await expect(page.locator("#proof .cell.lit")).toHaveCount(9, "中心を押した3×3が目標として光る");
  await expect(page.locator("#undoKey")).toBeDisabled();
  await game.expectClean();
});

test("インクはマゼンタ・イエロー・ブルーの順に巡る", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.総仕上げ });
  for (const name of ["マゼンタ", "イエロー", "ブルー", "マゼンタ"]) {
    await expect(page.locator("#inkName")).toHaveText(name);
    await press(page, 12);
  }
  await game.expectClean();
});

test("押した3×3にだけインクが乗る", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await expect(page.locator("#board .cell.lit")).toHaveCount(0);
  await press(page, 0);                       // 角なので盤の外が切り落とされる
  await expect(page.locator("#board .cell.lit")).toHaveCount(4);
  await game.expectClean();
});

test("一手もどすと直前の盤面に戻る", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await press(page, 6);
  await expect(remaining(page)).toHaveText("2");
  await expect(page.locator("#inkName")).toHaveText("イエロー");

  await page.click("#undoKey");
  await expect(remaining(page)).toHaveText("3");
  await expect(page.locator("#inkName")).toHaveText("マゼンタ");
  await expect(page.locator("#board .cell.lit")).toHaveCount(0);
  await game.expectClean();
});

test("盤の上の右クリックでも戻せる（メニューは出さない）", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await press(page, 6);
  await page.click('#board .cell[data-i="0"]', { button: "right" });
  await expect(remaining(page)).toHaveText("3");
  await game.expectClean();
});

test("白紙より先へは戻せない", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await press(page, 6);
  await page.click("#undoKey");
  await expect(page.locator("#undoKey")).toBeDisabled();
  await page.click('#board .cell[data-i="0"]', { button: "right" });
  await expect(status(page)).toContainText("これ以上は戻せません");
  await game.expectClean();
});

test("最短手数を超えては押せない", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.中心をひと押し });
  await press(page, 0);                       // par=1 を使い切る（揃わない手）
  await expect(remaining(page)).toHaveText("0");
  await expect(page.locator("#inkName")).toHaveText("使い切り");

  await press(page, 24);
  await expect(status(page)).toContainText("手数を使い切りました");
  await expect(remaining(page)).toHaveText("0", "弾かれた手は数えない");
  await game.expectClean();
});

test("答えの手順どおりに押すと校了になる", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await solve(page, [6, 8, 16]);

  await expect(page.locator("#finish")).toBeVisible();
  await expect(status(page)).toContainText("刷り上がりました。最短の3手です");
  await expect(remaining(page)).toHaveText("0");
  await expect(page.locator("#inkName")).toHaveText("刷り上がり");
  await expect(page.locator('#tallyList dt:text-is("練習") + .val + .gain'))
    .toHaveText("+1", "練習の今日ぶんが増える");
  await expect(page.locator("#undoKey")).toBeDisabled("揃えたあとは戻せない");
  await game.expectClean();
});

test("自動遷移はクリックで止められ、もう一度クリックで次へ進む", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await solve(page, [6, 8, 16]);
  await expect(page.locator("#count")).toContainText("秒後に次の練習へ");

  await page.click("#finish");
  await expect(page.locator("#count")).toHaveText("");
  await expect(status(page)).toContainText("盤をクリックすると次へ進みます");

  // 揃えた瞬間のクリックを拾わないよう、成立直後は受け付けない作りになっている
  await page.waitForTimeout(400);
  await press(page, 0);
  await expect(status(page)).toContainText("練習 12 / 21");
  await game.expectClean();
});

test("放っておくと次の課題へ自動で進む", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  await solve(page, [6, 8, 16]);
  await expect(status(page)).toContainText("練習 12 / 21", { timeout: 6000 });
  await expect(page.locator("#finish")).toBeHidden();
  await game.expectClean();
});

/* ---------- 押す場所の案内 ---------- */

const 案内 = page => page.locator("#board .cell.guide");

test("練習の序盤では次に押すマスを案内し、名前でも伝える", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.中心をひと押し });
  await expect(案内(page)).toHaveCount(1);
  await expect(案内(page)).toHaveAttribute("data-i", "12");
  await expect(案内(page)).toHaveAttribute("aria-label", /次に押すマス/);

  await press(page, 12);
  await expect(案内(page)).toHaveCount(0, "揃ったら案内しない");
  await game.expectClean();
});

test("手順から外れたら案内を消し、戻せばまた出す", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.二色をならべる });
  await expect(案内(page)).toHaveAttribute("data-i", "0");

  await press(page, 12);                      // 手順にない手
  await expect(案内(page)).toHaveCount(0);
  await page.click("#undoKey");
  await expect(案内(page)).toHaveAttribute("data-i", "0");

  await press(page, 0);
  await expect(案内(page)).toHaveAttribute("data-i", "4", "二手目の場所へ移る");
  await game.expectClean();
});

test("形と混色を覚えたあとの面では案内しない", async ({ page }) => {
  const game = await openGame(page, { reached: STAGE.帯が交わる });
  await expect(status(page)).toContainText("練習 7 / 21");
  await expect(案内(page)).toHaveCount(0);
  await game.expectClean();
});

test.describe("動きを減らす設定の案内", () => {
  test.use({ reducedMotion: "reduce" });

  test("案内の輪は止めたまま見せる", async ({ page }) => {
    const game = await openGame(page, { reached: STAGE.中心をひと押し });
    const anim = await 案内(page).evaluate(e => getComputedStyle(e, "::after").animationName);
    expect(anim).toBe("none");
    await game.expectClean();
  });
});
