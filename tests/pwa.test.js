import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { registerServiceWorker } from "../src/pwa.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const 実在 = rel => existsSync(root + rel.replace(/^\.\//, ""));

// sw.js は self に触れるので Node では読み込めない。配布一覧だけを文面から取り出す
const swSource = readFileSync(root + "sw.js", "utf8");
const ASSETS = swSource.match(/const ASSETS = \[([\s\S]*?)\];/)[1]
  .match(/"([^"]+)"/g).map(s => s.slice(1, -1));
const manifest = JSON.parse(readFileSync(root + "manifest.webmanifest", "utf8"));

test("使えない環境では静かに諦める", async () => {
  assert.equal(await registerServiceWorker(undefined, "./sw.js"), null);
  assert.equal(await registerServiceWorker(null, "./sw.js"), null);
  assert.equal(await registerServiceWorker({}, "./sw.js"), null);
});

// 握り潰さないと未処理の reject になり、E2E の「エラーゼロ」検査を巻き添えで落とす
test("登録が失敗しても投げない", async () => {
  const 拒否 = { register: () => Promise.reject(new Error("安全でないオリジン")) };
  assert.equal(await registerServiceWorker(拒否, "./sw.js"), null);
  const 同期で投げる = { register() { throw new Error("使えない"); } };
  assert.equal(await registerServiceWorker(同期で投げる, "./sw.js"), null);
});

test("使える環境では登録結果を返す", async () => {
  const container = { register: url => Promise.resolve({ scope: url }) };
  assert.deepEqual(await registerServiceWorker(container, "./sw.js"), { scope: "./sw.js" });
});

// addAll は1つでも欠けると全部を捨て、Service Worker が一度も立たない。
// 「圏外で開けない」ではなく「何も起きない」形で壊れるので、目視では気づけない
test("先に取り込む一式が実在する", () => {
  for (const a of ASSETS) {
    if (a === "./") continue;                       // ディレクトリの索引はサーバが返す
    assert.ok(実在(a), `${a} が無い`);
  }
});

// 新しいモジュールを足して一覧に入れ忘れると、圏外でだけ動かなくなる
test("src の全モジュールが一式に入っている", () => {
  for (const f of readdirSync(root + "src")) {
    assert.ok(ASSETS.includes(`./src/${f}`), `./src/${f} が一式に無い`);
  }
});

test("マニフェストの絵柄が実在する", () => {
  assert.ok(manifest.icons.length > 0);
  for (const i of manifest.icons) assert.ok(実在(i.src), `${i.src} が無い`);
  assert.ok(manifest.icons.some(i => i.purpose === "maskable"), "maskable が要る");
});

// プロジェクトページ配信（/ink-trio/ の下）なので、絶対パスだと起点がずれる
test("起点はリポジトリ名に依存しない相対指定", () => {
  for (const k of ["start_url", "scope", "id"]) {
    assert.ok(manifest[k].startsWith("."), `${k} が相対でない: ${manifest[k]}`);
  }
});

// 横向きは支えないと決めたので、入れたあとの窓は縦で開く
test("縦向きで開く", () => {
  assert.equal(manifest.orientation, "portrait");
});
