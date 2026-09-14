// Service Worker の登録。storage.js と同じで、使えない環境では静かに諦める。
// container を注入するのは、ブラウザ無しで「諦め方」を検証するため。

export function registerServiceWorker(container, url) {
  if (!container?.register) return Promise.resolve(null);
  try {
    // 握り潰さないと、未処理の reject が E2E の「エラーゼロ」検査を落とす
    return Promise.resolve(container.register(url)).catch(() => null);
  } catch {
    return Promise.resolve(null);   // 同期で投げる実装もある
  }
}
