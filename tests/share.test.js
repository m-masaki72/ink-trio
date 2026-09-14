import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME, boardText, formatDuration, shareText } from "../src/share.js";
import { issueSet } from "../src/daily.js";

// 押した中心の3×3だけがマゼンタ(1)になる。ゲームの規則と表記が一致していることの確認
test("盤面はこの作品自身の数字表記になる", () => {
  assert.equal(boardText([12]), [
    "00000",
    "01110",
    "01110",
    "01110",
    "00000",
  ].join("\n"));
});

test("盤面は五行五列で、0〜7しか出ない", () => {
  for (const n of [1, 100, 257]) {
    for (const { seq } of issueSet(n)) {
      const rows = boardText(seq).split("\n");
      assert.equal(rows.length, 5, `第${n}号の行数`);
      for (const row of rows) assert.match(row, /^[0-7]{5}$/, `第${n}号: ${row}`);
    }
  }
});

test("時間の表記は分の手前で切り替わる", () => {
  assert.equal(formatDuration(41200), "41.2秒");
  assert.equal(formatDuration(59900), "59.9秒");
  assert.equal(formatDuration(59999), "1分00秒", "丸めて60秒になる値は分にする");
  assert.equal(formatDuration(60000), "1分00秒");
  assert.equal(formatDuration(252000), "4分12秒");
  assert.equal(formatDuration(-1), "—");
  assert.equal(formatDuration(NaN), "—");
});

test("五問そろえた日は時間まで出す", () => {
  const t = shareText({ issue: 257, solved: 5, ms: 252000, rush: 7 });
  assert.match(t, /^Ink Trio 第257号\n日刊 5問 4分12秒 ／ 時間走 7問\n\n/);
  assert.ok(t.endsWith(HOME));
});

// 途中までの記録に時間を添えると、全部そろえた人の記録と見分けがつかなくなる
test("途中までの日は時間を出さない", () => {
  const t = shareText({ issue: 257, solved: 3, ms: 90000 });
  assert.match(t, /日刊 3\/5問/);
  assert.ok(!t.includes("秒"), t);
});

test("時間走だけの日も出せる", () => {
  const t = shareText({ issue: 257, rush: 9 });
  assert.match(t, /^Ink Trio 第257号\n時間走 9問\n/);
});

test("何もしていない日は号と行き先だけ", () => {
  assert.equal(shareText({ issue: 257 }), `Ink Trio 第257号\n\n${HOME}`);
});

// 色に頼らない作品なので、共有に色絵文字を混ぜない
test("共有テキストに絵文字を混ぜない", () => {
  const t = shareText({ issue: 257, solved: 5, ms: 1000, rush: 3, board: boardText([12]) });
  assert.ok(!/\p{Extended_Pictographic}/u.test(t), t);
});
