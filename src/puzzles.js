// 出題。押すマスの列だけで盤面も手順も決まる（色は順番から自動で決まる）ので、
// 面の定義はマス番号の配列ひとつで足りる。

import { SZ, SEQ, stamp, targetOf, trueMinimum } from "./rules.js";

export const TUTORIAL = [
  { t: "中心をひと押し", h: "盤の中心をひとつ押すだけ。周りの8マスにも同時にインクが乗ります。", s: [12] },
  { t: "角をひと押し", h: "角では盤の外へ出た分が切り落とされ、4マスだけ染まります。", s: [0] },
  { t: "辺をひと押し", h: "辺の上なら6マス。押す場所で染まる形が変わります。", s: [2] },
  { t: "二色をならべる", h: "一手目はマゼンタ、二手目はイエロー。離れた2か所へ置いてみてください。", s: [0, 4] },
  { t: "少しだけ重ねる", h: "二つの3×3をずらして置くと、重なった帯だけ色が変わります。", s: [1, 3] },
  { t: "同じ場所に二色", h: "同じマスを続けて押すと、二色が混ざります。", s: [12, 12] },
  { t: "帯が交わる", h: "上辺と中心。重なった横一列がどうなるか見てください。", s: [2, 12] },
  { t: "一マスだけ混ざる", h: "斜めに離して置くと、角が触れ合う1マスだけが混色になります。", s: [6, 18] },
  { t: "三色をならべる", h: "マゼンタ・イエロー・ブルーが順に出ます。重ならない3か所へ。", s: [0, 4, 22] },
  { t: "同じ場所に三色", h: "三色すべてが同じ場所で重なると白になります。", s: [12, 12, 12] },
  { t: "三つの重なり", h: "三つの3×3を少しずつずらして。混ざり方が6種類に分かれます。", s: [6, 8, 16] },
  { t: "七色がそろう", h: "たった3手で、この遊びに出る7色がすべて盤上にそろいます。", s: [1, 3, 12] },
  { t: "いらない色を消す", h: "お手本にマゼンタがありません。でも一手目は必ずマゼンタ。どこかに置いて、あとで同じ場所を押して消します。", s: [12, 0, 4, 12] },
  { t: "重なりだけ消す", h: "同じ色を少しずらして二度置くと、重なった部分だけが消えます。", s: [11, 0, 0, 13] },
  { t: "四隅をまわる", h: "四つの角へ順に。一手目と四手目はどちらもマゼンタです。", s: [0, 4, 20, 24] },
  { t: "四辺をまわる", h: "四つの辺の中央へ。重なりが十字に残ります。", s: [2, 10, 14, 22] },
  { t: "内側の四隅", h: "一マス内側の四隅へ。盤がすべて埋まります。", s: [6, 8, 16, 18] },
  { t: "たすきに掛ける", h: "対角線に沿って5手。重なりの連なりを追ってください。", s: [0, 12, 24, 6, 18] },
  { t: "五点を打つ", h: "内側の四隅と中心。サイコロの五の目です。", s: [6, 8, 16, 18, 12] },
  { t: "総仕上げ", h: "6手。ここまでの全部を使います。", s: [0, 2, 4, 10, 12, 14] },
  { t: "一面の白", h: "盤をちょうど覆い分ける四か所を見つけ、そこへ三色ずつ重ねます。12手。", s: [0, 0, 0, 3, 3, 3, 15, 15, 15, 18, 18, 18] },
];

// 引き直しが尽きたときに使う、検算済みの確実な手順
export const FALLBACK = {
  3: [10, 4, 12],
  6: [20, 1, 2, 17, 3, 11],
  10: [18, 1, 16, 6, 1, 2, 13, 13, 2, 7],
};

export const GENERATE_ATTEMPTS = 400;

export function buildPuzzle(cellSeq) {
  const target = targetOf(cellSeq);
  return {
    target,
    answer: cellSeq.map((idx, j) => ({ i: idx, bit: SEQ[j % 3] })),
    par: trueMinimum(target),
  };
}

// 同じ手数でも盤の見た目は揃わない（6手で「乗ったマス数」が2〜25まで散る）。
// 帯を外れた盤面は捨てて引き直す。実測では平均0.2回で収まる。
// この表を変えると過去の日刊号が別の盤面に化けるので、tests/daily.test.js が
// 代表号を実値で固定して見張っている。
export const BANDS = {
  3: { inked: [10, 20], colors: [3, 6] },
  6: { inked: [15, 23], colors: [4, 7] },
  10: { inked: [17, 24], colors: [5, 7] },
};
export const MAX_SHIFT = 50;

export function featuresOf(cellSeq) {
  const on = targetOf(cellSeq).filter(v => v !== 0);
  return { inked: on.length, colors: new Set(on).size };
}

export function inBand(cellSeq, level, bands = BANDS) {
  const b = bands[level];
  if (!b) return true;
  const f = featuresOf(cellSeq);
  return f.inked >= b.inked[0] && f.inked <= b.inked[1]
    && f.colors >= b.colors[0] && f.colors <= b.colors[1];
}

// 帯に入るまで引き直す。入りきらなくても出題は止めない。
// randomAt(k) が k 回目の乱数を返す（日刊は種つき、時間走は素の乱数）
export function pickInBand(level, randomAt, bands = BANDS, tries = MAX_SHIFT) {
  let first = null;
  for (let k = 0; k < tries; k++) {
    const seq = generateSequence(level, randomAt(k));
    if (first === null) first = seq;
    if (inBand(seq, level, bands)) return seq;
  }
  return first;
}

// 最短手数がちょうど level になる問題が出るまで引き直す。
// 引き直しが尽きても空の盤面を出さないよう、検算済みの手順に落とす。
export function generateSequence(level, random = Math.random, attempts = GENERATE_ATTEMPTS) {
  for (let a = 0; a < attempts; a++) {
    const target = new Array(SZ).fill(0);
    const seq = [];
    for (let s = 0; s < level; s++) {
      const idx = Math.floor(random() * SZ);
      seq.push(idx);
      stamp(target, idx, SEQ[s % 3]);
    }
    if (trueMinimum(target) === level) return seq;
  }
  return (FALLBACK[level] || FALLBACK[6]).slice();
}
