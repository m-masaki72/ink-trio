// itch.io へ上げる zip を作る。
//   node tools/pack-itch.mjs
// 配るファイルは sw.js の ASSETS から導く。圏外用の取り込み一覧が
// 「遊ぶのに要るもの全部」なので、ここに二つ目の一覧を作らない。
// （src/ にモジュールを足して sw.js に入れ忘れると tests/pwa.test.js が落ちる）
//
// 組んだあと、itch の配り方を模して検査する。itch はゲームを別オリジンの
// iframe で、深いサブパスから配る。相対パスと Service Worker の範囲がそこで崩れる。

import { chromium } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const PORT = 4321;
const root = fileURLToPath(new URL("../", import.meta.url));
const dist = root + "dist/";
const pack = dist + "pack/";
const game = pack + "ink-trio/";
const zip = dist + "ink-trio-itch.zip";

/* ---------- 一覧を sw.js から導く ---------- */

const swSource = readFileSync(root + "sw.js", "utf8");
const assets = swSource.match(/const ASSETS = \[([\s\S]*?)\];/)[1]
  .match(/"([^"]+)"/g).map(s => s.slice(1, -1).replace(/^\.\//, ""))
  .filter(p => p !== "");                 // "./" はディレクトリの索引なので実体がない

// sw.js は自分自身を先読みしないので ASSETS に載っていない。
// 入れ忘れても画面は普通に動き、圏外で開けないだけなので気づけない
const extras = ["sw.js", "LICENSE"];
const files = [...assets, ...extras];

rmSync(dist, { recursive: true, force: true });
for (const f of files) {
  const from = root + f;
  if (!existsSync(from)) throw new Error(`${f} が無い（sw.js の一覧と実物が食い違っている）`);
  mkdirSync(dirname(game + f), { recursive: true });
  cpSync(from, game + f);
}
console.log(`${files.length} ファイルを組みました`);

/* ---------- itch の配り方を模して検査する ---------- */

// itch は iframe でゲームを配る。埋め込み側を真似た宿主を置く
writeFileSync(pack + "host.html",
  '<!doctype html><meta charset="utf-8"><title>itch 模擬</title>\n' +
  '<iframe src="/ink-trio/index.html" width="960" height="720" frameborder="0"></iframe>\n');

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"],
  { cwd: pack, stdio: "ignore" });
server.unref();
process.on("exit", () => server.kill());

const host = `http://127.0.0.1:${PORT}/host.html`;
for (let i = 0; ; i++) {
  try { await fetch(host); break; } catch {
    if (i > 50) throw new Error("簡易サーバが立ち上がらない");
    await new Promise(r => setTimeout(r, 100));
  }
}

const browser = await chromium.launch();
const page = await browser.newPage();
const 苦情 = [];
page.on("pageerror", e => 苦情.push("JS: " + String(e).split("\n")[0]));
// CSP だけでなくコンソールのエラー全部を見る。
// SVG の属性エラーのように、例外を投げずに描画だけ壊れるものを拾うため
page.on("console", m => {
  if (m.type() === "error") 苦情.push("console: " + m.text().slice(0, 160));
});

await page.goto(host);
const frame = page.frameLocator("iframe");
await frame.locator("#board .cell").first().waitFor();

// 練習の1面目に固定して、実際に解けるところまで見る
await page.frames()[1].evaluate(() => localStorage.setItem("inktrio.v1", JSON.stringify({
  v: 3, reached: 0, cleared: [], done: false, level: 6, marks: "none", pal: "vivid",
  snd: false, crt: true, totals: {}, day: "", today: {},
})));
await page.reload();
const frame2 = page.frameLocator("iframe");
await frame2.locator("#board .cell").first().waitFor();

const cells = await frame2.locator("#board .cell").count();
await frame2.locator('#board .cell[data-i="12"]').click();   // 中心ひと押しで揃う面
await page.waitForTimeout(400);
const status = (await frame2.locator("#status").textContent()).trim();

// 登録は起動から少し遅れる。待たずに読むと空振りする
let sw = null;
try {
  sw = await page.frames()[1].waitForFunction(async () => {
    const rs = await navigator.serviceWorker.getRegistrations();
    return rs[0]?.scope ?? null;
  }, null, { timeout: 10000 }).then(h => h.jsonValue());
} catch { /* 登録されないままなら下の検査で落ちる */ }
await browser.close();
server.kill();

const 不合格 = [];
if (cells !== 25) 不合格.push(`盤のマスが ${cells} 個（25 のはず）`);
if (!status.includes("刷り上がりました")) 不合格.push(`解けていない（状態文: ${status}）`);
if (!sw?.endsWith("/ink-trio/")) 不合格.push(`Service Worker の範囲が ${sw}`);
if (苦情.length) 不合格.push(...苦情);

console.log(`盤のマス ${cells} / 状態文「${status}」`);
console.log(`Service Worker の範囲 ${sw}`);

if (不合格.length) {
  console.log("\n=== サブパス配信で壊れています ===");
  for (const x of 不合格) console.log(`  ${x}`);
  process.exit(1);
}

/* ---------- zip にする ---------- */

// itch は zip の直下に index.html があることを求める
try {
  execFileSync("zip", ["-qr", zip, "."], { cwd: game });
} catch {
  throw new Error("zip コマンドが見つからない（macOS と ubuntu には入っています）");
}
const 大きさ = (readFileSync(zip).length / 1024).toFixed(0);
console.log(`\n${zip.replace(root, "")}  ${大きさ}KB`);
console.log("掲載の設定と文面は docs/itch.md を見てください。");
