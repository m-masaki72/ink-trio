// 盤と混色の規則。DOM にも保存にも依存しない、この遊びの数学だけを持つ。

export const N = 5;
export const SZ = N * N;

// インクは3bitのフラグ。重なりは XOR なので、同じ色を二度乗せると消える。
export const M = 1, Y = 2, B = 4;

// 何手目に何色が乗るかは押した順で決まり、選べない。
export const SEQ = [M, Y, B];

export const NAME = {
  0: "白紙",
  [M]: "マゼンタ", [Y]: "イエロー", [B]: "ブルー",
  [M | Y]: "パープル", [M | B]: "レッド", [Y | B]: "グリーン",
  [M | Y | B]: "ホワイト",
};

// MASK[i] は「マス i を押したときに色が変わるマス」を立てた25bit。
// 盤の外へ出た分は切り落とされるので、角なら4マス、辺なら6マスしか立たない。
export const MASK = (() => {
  const mask = [];
  for (let i = 0; i < SZ; i++) {
    const r = Math.floor(i / N), c = i % N;
    let m = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < N && cc >= 0 && cc < N) m ^= 1 << (rr * N + cc);
      }
    }
    mask.push(m);
  }
  return mask;
})();

// 押したマスの列から盤面を組む。n手目に乗る色は SEQ で固定されていて選べない
export function targetOf(cellSeq) {
  const target = new Array(SZ).fill(0);
  cellSeq.forEach((idx, j) => stamp(target, idx, SEQ[j % 3]));
  return target;
}

export function stamp(state, idx, bit) {
  const r = Math.floor(idx / N), c = idx % N;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N) state[rr * N + cc] ^= bit;
    }
  }
  return state;
}

export function popcount(x) {
  let n = 0;
  while (x) { x &= x - 1; n++; }
  return n;
}

// 色ごとに独立した GF(2) の連立一次方程式になる。MASK を掃き出して、
// piv にピボット、kernel に核（押しても盤面が変わらない押し方）を得る。
const { piv, kernel } = (() => {
  const piv = {}, kernel = [];
  for (let i = 0; i < SZ; i++) {
    let v = MASK[i], comb = 1 << i, placed = false;
    while (v) {
      const b = 31 - Math.clz32(v);
      if (piv[b]) { v ^= piv[b][0]; comb ^= piv[b][1]; }
      else { piv[b] = [v, comb]; placed = true; break; }
    }
    if (!placed && v === 0) kernel.push(comb);
  }
  return { piv, kernel };
})();

export const KERNEL = kernel.slice();
export const RANK = SZ - kernel.length;

// 1色ぶんの盤面を解く。像の外なら null。
export function solvePlane(target) {
  let v = target, comb = 0;
  while (v) {
    const b = 31 - Math.clz32(v);
    if (!piv[b]) return null;
    v ^= piv[b][0]; comb ^= piv[b][1];
  }
  return comb;
}

// 核を全通り足して [偶数手の最小, 奇数手の最小] を返す。
// 同じマスを二度押すと手数が2増えて盤面は変わらないため、
// パリティごとの最小さえ分かれば「n手の枠に収まるか」が判定できる。
export function minByParity(target) {
  const base = solvePlane(target);
  if (base === null) return null;
  const best = [Infinity, Infinity];
  for (let s = 0; s < (1 << kernel.length); s++) {
    let x = base;
    for (let k = 0; k < kernel.length; k++) if (s & (1 << k)) x ^= kernel[k];
    const w = popcount(x);
    if (w < best[w & 1]) best[w & 1] = w;
  }
  return best;
}

// m 手を三色へ順番に配ったときの、色ごとの手数
export function slotCounts(m) {
  const n = [0, 0, 0];
  for (let j = 0; j < m; j++) n[j % 3]++;
  return n;
}

export function planesOf(targetArr) {
  const planes = [0, 0, 0];
  for (let i = 0; i < SZ; i++) {
    if (targetArr[i] & M) planes[0] ^= 1 << i;
    if (targetArr[i] & Y) planes[1] ^= 1 << i;
    if (targetArr[i] & B) planes[2] ^= 1 << i;
  }
  return planes;
}

export const MAX_MOVES = 40;

// 色を選べないので、三色それぞれの最小手数を足しても答えにならない。
// 手数 m を小さい順に試し、m を三色へ配った枠に全色が収まる最初の m を採る。
export function trueMinimum(targetArr) {
  const mw = planesOf(targetArr).map(minByParity);
  if (mw.some(x => x === null)) return null;
  for (let m = 0; m <= MAX_MOVES; m++) {
    const n = slotCounts(m);
    let ok = true;
    for (let c = 0; c < 3; c++) {
      if (mw[c][n[c] & 1] > n[c]) { ok = false; break; }
    }
    if (ok) return m;
  }
  return null;
}
