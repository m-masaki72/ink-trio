// 取り込んだ一式を丸ごと持っておいて、圏外でも遊べるようにする。
// ビルド工程がないので、配るファイルはここに手で並べる。
// 中身を差し替えたら CACHE の版を上げる。上げないと古い一式が出続ける。
// Cache Storage はオリジン単位で、GitHub Pages では全プロジェクトが同じオリジンに乗る。
// 掃除のときに接頭辞で絞らないと、よそのプロジェクトの取り込みまで消してしまう。
// storage.js の保存値と同じ事情（自分でしか壊せない場所ではない）。
const PREFIX = "inktrio-";
const CACHE = PREFIX + "v1";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./favicon.svg",
  "./manifest.webmanifest",
  "./src/main.js",
  "./src/audio.js",
  "./src/daily.js",
  "./src/game.js",
  "./src/share.js",
  "./src/palette.js",
  "./src/pwa.js",
  "./src/puzzles.js",
  "./src/rules.js",
  "./src/storage.js",
  "./src/tally.js",
  "./src/view.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

// addAll は1つでも取れなければ全部を捨てる。並べ間違えると登録そのものが立たない
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys
      .filter(k => k.startsWith(PREFIX) && k !== CACHE)
      .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  // 書体は別オリジン。握らずブラウザに任せる（圏外では素の書体に落ちる）
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  // ページそのものは網があれば新しい方を見に行く。無ければ取り込んだ一式で開く
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("./index.html").then(r => r ?? caches.match("./"))));
    return;
  }

  e.respondWith(caches.match(req).then(hit => hit ?? fetch(req).then(res => {
    if (res.ok) {
      const copy = res.clone();
      // 書き終える前に止められないよう待たせる。容量不足で失敗しても本体は返す
      e.waitUntil(caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}));
    }
    return res;
  })));
});
