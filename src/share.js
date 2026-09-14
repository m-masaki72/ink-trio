// 共有テキストの組み立て。DOM にもクリップボードにも触らない。

import { N, targetOf } from "./rules.js";

export const HOME = "https://m-masaki72.github.io/ink-trio/";

// 色に頼らない遊びなので、共有も色絵文字ではなく、この作品自身の数字表記を使う。
// マゼンタ1・イエロー2・ブルー4 の合計（0〜7）。目標は最初から見えているので答えは割れない。
export function boardText(cellSeq) {
  const target = targetOf(cellSeq);
  const rows = [];
  for (let r = 0; r < N; r++) rows.push(target.slice(r * N, (r + 1) * N).join(""));
  return rows.join("\n");
}

// 1分未満は小数一桁まで出す。数秒差が意味を持つ遊びなので、丸めすぎない
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  // 丸めた結果が60秒になる値を「60.0秒」と出すと、次の桁と並んだとき不格好になる
  const tenths = Math.round(ms / 100);
  if (tenths < 600) return `${(tenths / 10).toFixed(1)}秒`;
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}分${String(total % 60).padStart(2, "0")}秒`;
}

// 残り時間は分と秒で出す。経過を出す formatDuration とは別の見せ方
export function clockText(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export function shareText({
  issue, solved = 0, total = 5, ms = null, rush = null, board = null, home = HOME,
}) {
  const lines = [`Ink Trio 第${issue}号`];

  const parts = [];
  // 途中までの日は時間を出さない。全部そろえた人と並べても意味がないため
  if (solved >= total && ms !== null) parts.push(`日刊 ${total}問 ${formatDuration(ms)}`);
  else if (solved > 0) parts.push(`日刊 ${solved}/${total}問`);
  if (rush !== null) parts.push(`時間走 ${rush}問`);
  if (parts.length) lines.push(parts.join(" ／ "));

  if (board) lines.push("", board);
  lines.push("", home);
  return lines.join("\n");
}
