// 刷り上がりの数え方。日付またぎの扱いだけが要点で、DOM には触らない。

export const MODES = [
  { k: "t", label: "練習" },
  { k: "3", label: "やさしい" },
  { k: "6", label: "ふつう" },
  { k: "10", label: "むずかしい" },
];

export function dayKeyOf(date = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

// 日付が変わっていたら今日ぶんを 0 から数えなおす。通算には手を触れない。
export function rollDay(state, key) {
  if (state.dayKey === key) return state;
  return { ...state, dayKey: key, today: {} };
}

export function recordClear(state, modeKey) {
  return {
    ...state,
    totals: { ...state.totals, [modeKey]: (state.totals[modeKey] | 0) + 1 },
    today: { ...state.today, [modeKey]: (state.today[modeKey] | 0) + 1 },
  };
}

export const clearedCount = cleared => cleared.filter(Boolean).length;

export const gainedToday = today => MODES.reduce((n, m) => n + (today[m.k] | 0), 0);
