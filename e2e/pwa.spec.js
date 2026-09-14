import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openGame, press, status, STAGE } from "./helpers.js";

const 並べた数 = readFileSync(fileURLToPath(new URL("../sw.js", import.meta.url)), "utf8")
  .match(/const ASSETS = \[([\s\S]*?)\];/)[1].match(/"([^"]+)"/g).length;

// マニフェストの取得は CDP でしか強制できず、Service Worker の扱いもブラウザ差が大きい。
// layout.spec.js と同じく chromium の project だけが拾う（playwright.config.js の testIgnore）。

const 制御されるまで待つ = page =>
  page.waitForFunction(() => navigator.serviceWorker.controller !== null);

test("マニフェストが CSP に阻まれず読める", async ({ page, context }) => {
  const game = await openGame(page, {});

  // Chrome はマニフェストを遅延取得する。ページを開くだけでは要求が飛ばず、
  // 遮断されていても静かなまま。ここで明示的に取りにいかないと検査にならない
  const cdp = await context.newCDPSession(page);
  const man = await cdp.send("Page.getAppManifest");

  expect(man.data, "manifest-src を書かないと default-src 'none' に落ちて消える").toBeTruthy();
  expect(JSON.parse(man.data).name).toContain("Ink Trio");
  await game.expectClean();
});

test("Service Worker がページを制御する", async ({ page }) => {
  const game = await openGame(page, {});
  await 制御されるまで待つ(page);
  await game.expectClean();
});

test("圏外でも開けて、最後まで遊べる", async ({ page, context }) => {
  const game = await openGame(page, { reached: STAGE.中心をひと押し });
  await 制御されるまで待つ(page);

  await context.setOffline(true);
  await page.reload();

  await expect(page.locator("#board .cell")).toHaveCount(25);
  await press(page, 12);                                  // 練習1面目は中心ひと押しで揃う
  await expect(status(page)).toContainText("刷り上がりました");
  await game.expectClean();

  await context.setOffline(false);
});

// 一式を並べ間違えると addAll が全部を捨て、登録が一度も立たない。
// 画面は普通に動くので、圏外にしてみるまで気づけない
test("取り込みそこねが無い", async ({ page }) => {
  await openGame(page, {});
  await 制御されるまで待つ(page);
  const 取り込み数 = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (await (await caches.open(keys[0])).keys()).length;
  });
  expect(取り込み数, `${並べた数} 件を並べたのに ${取り込み数} 件しか入っていない`).toBe(並べた数);
});

// 同じオリジンに他のプロジェクトが同居している。Cache Storage はオリジン単位なので、
// 古い取り込みの掃除が接頭辞で絞られていないと、よそのぶんまで消える
test("掃除がよそのプロジェクトの取り込みを巻き込まない", async ({ page }) => {
  await openGame(page, {});
  await 制御されるまで待つ(page);

  const 残ったもの = await page.evaluate(async () => {
    await caches.open("よそのプロジェクト-v1");
    // 登録し直すと install と activate がもう一度走り、掃除が発火する
    await (await navigator.serviceWorker.getRegistration()).unregister();
    await navigator.serviceWorker.register("./sw.js");
    await navigator.serviceWorker.ready;
    return caches.keys();
  });

  expect(残ったもの).toContain("よそのプロジェクト-v1");
  expect(残ったもの).toContain("inktrio-v1");
});
