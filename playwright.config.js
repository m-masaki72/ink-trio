import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    // 揃えたときの演出や走査線は検証の対象ではないので、待ち時間を作らせない
    reducedMotion: "reduce",
  },

  // ビルドがないので、リポジトリをそのまま配って読ませる
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "ignore",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // 端末の再現に使う isMobile / hasTouch と、マニフェスト取得に使う CDP は
    // Chromium 専用なので、レイアウトと PWA の検証は chromium だけに任せる
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testIgnore: /(layout|pwa)\.spec\.js/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: /(layout|pwa)\.spec\.js/ },
  ],
});
