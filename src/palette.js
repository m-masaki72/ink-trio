// 配色と、その上に置く文字の色。

// 明度を等間隔の階段に配し、一般色覚・P型・D型・T型の全てで
// 最小ΔEが最大化されるよう数値最適化した組。個別に差し替えると前提が崩れる。
export const PAL = {
  vivid: { 0: "#1e1420", 1: "#fe628c", 2: "#e8d716", 4: "#1718e1",
           3: "#ac0fa5", 5: "#f51900", 6: "#07d248", 7: "#f9f9fa" },
  pastel: { 0: "#2b2536", 1: "#e8a6bd", 2: "#eee4a8", 4: "#5d6bc2",
            3: "#b173b6", 5: "#c1987e", 6: "#a1dcb3", 7: "#f9f9f9" },
};

export const PALETTE_NAMES = Object.keys(PAL);

// ブラウン管表現のオーバーレイを通したあとの減光。文字はマス下部に出るため、
// そこがいちばん暗くなる。0.20/3 は走査線（3px周期に rgba(0,0,0,.20) が1px）、
// 0.26 は曲面ガラスの落ち込み。index.html の .screen 側を変えたらここも直すこと。
export const DIM = (1 - 0.20 / 3) * (1 - 0.26);

function srgb(hex, at) { return parseInt(hex.substr(at, 2), 16) / 255; }

export function luminance(hex, dim = 1) {
  const lin = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(srgb(hex, 1) * dim)
       + 0.7152 * lin(srgb(hex, 3) * dim)
       + 0.0722 * lin(srgb(hex, 5) * dim);
}

export function contrastRatio(a, b) {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

export function contrastOn(hex) {
  const L = luminance(hex, DIM);
  return contrastRatio(L, 0) >= contrastRatio(L, 1) ? "#000000" : "#ffffff";
}
