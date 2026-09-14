// docs/*.png を焼き直す。ビルド工程ではなく、画面が変わったときだけ手で回す。
//   node tools/make-shots.mjs
// 画面写真を手で撮ると再現できなくなる（どの面のどこを押したか分からなくなる）ので、
// 押す手順と保存値までここに書いてある。簡易サーバも自分で立てる。

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { issueOf, issueSet } from "../src/daily.js";
import { dayKeyOf } from "../src/tally.js";

const PORT = 4319;
const root = fileURLToPath(new URL("../", import.meta.url));
const docs = root + "docs/";
const url = `http://127.0.0.1:${PORT}/index.html`;

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"],
  { cwd: root, stdio: "ignore" });
// unref しないと、子プロセスが親の event loop を握ったままで終了しない
server.unref();
process.on("exit", () => server.kill());

for (let i = 0; ; i++) {
  try { await fetch(url); break; } catch {
    if (i > 50) throw new Error("簡易サーバが立ち上がらない");
    await new Promise(r => setTimeout(r, 100));
  }
}

// 練習11面「三つの重なり」を土台にする。毎回同じ盤面が出るので写真が揃う
const STAGE = 10;
const ANSWER = [6, 8, 16];

const saved = extra => JSON.stringify({
  v: 3, reached: STAGE, cleared: [], done: false, level: 6,
  marks: "none", pal: "vivid", snd: false, crt: true, diff: false,
  totals: { t: 8, 3: 4, 6: 11, 10: 2 }, day: "", today: {},
  daily: { days: 7, lastDay: "", clock: true, send: false, sets: {} },
  rush: { day: "", count: 1, today: null, best: { solved: 8, ms: 240000 } },
  ...extra,
});

const browser = await chromium.launch();

async function open({ width = 932, height = 1100, state = saved() } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const ready = () => page.waitForFunction(() => document.querySelectorAll("#board .cell").length === 25);
  await page.goto(url);
  await ready();
  // addInitScript は再読み込みのたびに走って保存値を上書きするので、一度書いて読み直す
  await page.evaluate(s => localStorage.setItem("inktrio.v1", s), state);
  await page.reload();
  await ready();
  return { ctx, page };
}

const press = (page, i) => page.click(`#board .cell[data-i="${i}"]`);
// 筐体ごと写す。下に節が増えても写真の枠が変わらない
const shot = (page, name) => page.locator(".console").screenshot({ path: docs + name });

async function take(name, act, opts) {
  const { ctx, page } = await open(opts);
  await act(page);
  await (opts?.viewportShot ? page.screenshot({ path: docs + name }) : shot(page, name));
  await ctx.close();
  console.log(name);
}

// 遊びの基本。途中まで押した状態
await take("play.png", async page => {
  await press(page, ANSWER[0]);
  await press(page, ANSWER[1]);
  await page.waitForTimeout(400);
});

// 校了。3秒で自動遷移するので、それより前に撮る
await take("done.png", async page => {
  for (const i of ANSWER) await press(page, i);
  await page.waitForTimeout(700);        // 判が押される演出を待つ
});

// 色以外の目印
await take("marks.png", async page => {
  await press(page, ANSWER[0]);
  await press(page, ANSWER[1]);
  await page.waitForTimeout(400);
}, { state: saved({ marks: "letters" }) });

await take("pastel.png", async page => {
  await press(page, ANSWER[0]);
  await press(page, ANSWER[1]);
  await page.waitForTimeout(400);
}, { state: saved({ pal: "pastel", crt: false }) });

// 日刊号。号は日付で変わるので、写真の号数も撮った日のものになる
await take("daily.png", async page => {
  await page.click('.tab[data-mode="daily"]');
  const first = issueSet(issueOf(dayKeyOf()))[0].seq;
  await press(page, first[0]);
  await page.waitForTimeout(500);
}, { state: saved({ done: true }) });

// 時間走。盤はプールから引くので、撮るたびに違う盤が出る
await take("rush.png", async page => {
  await page.click('.tab[data-mode="rush"]');
  await page.click("#rushStart");
  await page.waitForTimeout(2600);       // 時計が動いたところ
}, { state: saved({ done: true }) });

// OGP は 1200×630 ちょうど。校了の判は盤を覆うので出さない
await take("og.png", async page => {
  await press(page, ANSWER[0]);
  await press(page, ANSWER[1]);
  await page.waitForTimeout(400);
}, { width: 1200, height: 630, state: saved(), viewportShot: true });

await browser.close();
server.kill();
