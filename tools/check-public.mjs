// 公開リポジトリに出してはいけないものが混ざっていないか調べる。
//   node tools/check-public.mjs
// 現在のツリーではなく git 履歴の全オブジェクトを見る。消したファイルも履歴には残るため。
//
// 固有の識別子（社内の ID やホスト名など）も見たいときは、このファイルに書かずに渡す。
// スクリプトに書いた時点で、それ自体が公開される。
//   EXTRA='pattern1|pattern2' node tools/check-public.mjs

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
const grepAll = pattern => {
  try {
    return git("grep", "-InE", pattern, "--", ...[]).trim();
  } catch { return ""; }
};

// 履歴の全コミットを対象にする
const revs = git("rev-list", "--all").trim().split("\n").filter(Boolean);
const grepHistory = pattern => {
  try {
    return git("grep", "-InE", pattern, ...revs).trim();
  } catch { return ""; }   // 見つからないと git grep は 1 を返す
};

const 見つかったもの = [];
const 調べる = (名前, pattern, 除外 = null) => {
  let hits = grepHistory(pattern).split("\n").filter(Boolean);
  if (除外) hits = hits.filter(l => !除外.test(l));
  if (hits.length) 見つかったもの.push({ 名前, hits });
  console.log(`${hits.length ? "✗" : "✓"} ${名前}${hits.length ? `  ${hits.length}件` : ""}`);
};

調べる("鍵・トークンらしき文字列",
  "api[_-]?key|secret|passwo?rd|BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20}|" +
  "sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|xox[baprs]-");

調べる("手元の絶対パス（利用者名が漏れる）", "/Users/[A-Za-z0-9._-]+|/home/[A-Za-z0-9._-]+|C:\\\\Users");

調べる("ファイル内のメールアドレス",
  "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
  /@media|@keyframes|@supports|@playwright|@anthropic|noreply@|users\.noreply/);

if (process.env.EXTRA) 調べる("外から渡された識別子", process.env.EXTRA);

// 履歴に一度でも入った、名前からして危ないファイル
const 危ない名前 = /(^|\/)(\.env|\.npmrc|\.netrc|id_[rd]sa|.*\.pem|.*\.p12|.*\.keystore|credentials|.*\.key)$/i;
const paths = new Set(git("rev-list", "--objects", "--all")
  .split("\n").map(l => l.split(" ").slice(1).join(" ")).filter(Boolean));
const 危ないファイル = [...paths].filter(p => 危ない名前.test(p));
if (危ないファイル.length) 見つかったもの.push({ 名前: "危ない名前のファイル", hits: 危ないファイル });
console.log(`${危ないファイル.length ? "✗" : "✓"} 危ない名前のファイルが履歴に無い`);

// PNG の付帯情報。手で撮ったスクショは機種名や位置情報を抱えている
const 許すchunk = new Set(["IHDR", "IDAT", "IEND", "PLTE", "tRNS", "sRGB", "gAMA", "pHYs", "cHRM", "iCCP"]);
const 余計なchunk = [];
for (const p of [...paths].filter(p => p.endsWith(".png"))) {
  let d;
  try { d = readFileSync(root + p); } catch { continue; }
  for (let i = 8; i + 8 <= d.length;) {
    const len = d.readUInt32BE(i);
    const type = d.toString("latin1", i + 4, i + 8);
    if (!許すchunk.has(type)) 余計なchunk.push(`${p}: ${type}`);
    i += 12 + len;
  }
}
if (余計なchunk.length) 見つかったもの.push({ 名前: "PNG の付帯情報", hits: 余計なchunk });
console.log(`${余計なchunk.length ? "✗" : "✓"} PNG に撮影機材や位置情報が付いていない`);

// コミットの著者は GitHub 上で誰でも見られる。止めはしないが必ず出す
console.log("\n— コミットの著者（GitHub で公開されます）");
for (const line of new Set(git("log", "--all", "--format=%an <%ae>").trim().split("\n"))) {
  console.log(`  ${line}`);
}

if (見つかったもの.length) {
  console.log("\n=== 出してはいけないものが見つかりました ===");
  for (const { 名前, hits } of 見つかったもの) {
    console.log(`\n[${名前}]`);
    for (const h of hits.slice(0, 20)) console.log(`  ${h}`);
    if (hits.length > 20) console.log(`  …ほか ${hits.length - 20}件`);
  }
  process.exit(1);
}
console.log("\n出してはいけないものは見つかりませんでした。");
