// icons/*.svg から PNG を焼く。ビルド工程ではなく、意匠を変えたときだけ手で回す。
//   node tools/make-icons.mjs
// Safari の apple-touch-icon が PNG しか受けないため、SVG だけでは済まない。
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../icons/", import.meta.url));

// 透過を残すもの（角丸の外側）と、全面を塗るもの。
// iOS は自前の丸マスクをかけたうえ、透過部を黒で合成するので、角丸を渡してはいけない。
const 焼くもの = [
  { src: "icon.svg",          out: "icon-192.png",           size: 192, 透過: true },
  { src: "icon.svg",          out: "icon-512.png",           size: 512, 透過: true },
  { src: "icon-maskable.svg", out: "icon-maskable-512.png",  size: 512, 透過: false },
  { src: "icon.svg",          out: "apple-touch-icon.png",   size: 180, 透過: false },
];

const browser = await chromium.launch();
for (const { src, out, size, 透過 } of 焼くもの) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // 透過を落とす側は、角丸の外に地の色を敷いて正方形に均す
  await page.setContent(
    `<style>html,body{margin:0;background:${透過 ? "transparent" : "#1e1420"}}
     svg{display:block;width:${size}px;height:${size}px}</style>` + readFileSync(dir + src, "utf8"));
  writeFileSync(dir + out, await page.screenshot({ omitBackground: 透過 }));
  await page.close();
  console.log(`${out}  ${size}x${size}`);
}
await browser.close();
