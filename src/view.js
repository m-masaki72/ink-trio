// 描画。盤の状態を受け取って DOM に反映するだけで、進行の判断はしない。

import { N, SZ, M, Y, B, NAME } from "./rules.js";
import { contrastOn } from "./palette.js";
import { MODES, clearedCount, gainedToday } from "./tally.js";

const LETTERS = ["M", "Y", "B"];

// 目印は opacity で見せ消ししている。display:none と違い要素は残るので、
// 隠していても読み上げには届いてしまう。配合は aria-label で伝えるため、
// 見た目のための M・Y・B と数字はツリーから外す。
function buildInner(el) {
  const miss = document.createElement("div");
  miss.className = "miss";
  miss.setAttribute("aria-hidden", "true");
  el.appendChild(miss);

  const tag = document.createElement("div");
  tag.className = "tag";
  tag.setAttribute("aria-hidden", "true");
  for (const ch of LETTERS) {
    const sp = document.createElement("span");
    sp.textContent = ch;
    tag.appendChild(sp);
  }
  el.appendChild(tag);

  const num = document.createElement("div");
  num.className = "num";
  num.setAttribute("aria-hidden", "true");
  el.appendChild(num);

  return { miss, tag, slots: tag.children, num };
}

const place = i => `${Math.floor(i / N) + 1}行${(i % N) + 1}列`;

export function buildGrid(container, { interactive, onPress } = {}) {
  const cells = [];
  for (let i = 0; i < SZ; i++) {
    const el = document.createElement(interactive ? "button" : "div");
    el.className = "cell";
    el.dataset.i = i;
    if (interactive) {
      el.type = "button";
      el.addEventListener("click", () => onPress(i));
    } else {
      // 目標の盤は押せないが、配合は読めなければならない
      el.setAttribute("role", "img");
    }
    el.parts = buildInner(el);
    container.appendChild(el);
    cells.push(el);
  }
  return cells;
}

export function paintCell(el, bits, { pal, markMode, showMiss }) {
  const hex = pal[bits];
  el.style.background = hex;
  el.style.color = contrastOn(hex);
  el.style.setProperty("--c", hex);
  el.classList.toggle("lit", bits !== 0);
  el.title = `${NAME[bits]}（${bits}）`;
  // 位置だけでなく、いま何が乗っているかを名前に含める
  el.setAttribute("aria-label",
    `${place(Number(el.dataset.i))} ${NAME[bits]}${showMiss ? "　ずれている" : ""}`);

  const s = el.parts.slots;
  s[0].className = bits & M ? "on" : "";
  s[1].className = bits & Y ? "on" : "";
  s[2].className = bits & B ? "on" : "";

  el.parts.tag.classList.toggle("show", markMode === "bars" || markMode === "letters");
  el.parts.tag.classList.toggle("letters", markMode === "letters");
  el.parts.num.textContent = String(bits);
  el.parts.num.classList.toggle("show", markMode === "digits");
  el.parts.miss.classList.toggle("show", !!showMiss);
}

// 押した3×3を、中心から外へわずかに遅らせて光らせる
export function flashAround(cells, idx, cls) {
  const r = Math.floor(idx / N), c = idx % N;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
      const el = cells[rr * N + cc];
      el.classList.remove("wet", "lift");
      void el.offsetWidth;
      el.style.animationDelay = `${Math.abs(dr) || Math.abs(dc) ? 26 : 0}ms`;
      el.classList.add(cls);
    }
  }
}

// 中央から外へ広がるように、各マスの発光を少しずつ遅らせる
export function pulseFromCenter(cells) {
  for (let i = 0; i < SZ; i++) {
    const d = Math.max(Math.abs(Math.floor(i / N) - 2), Math.abs((i % N) - 2));
    cells[i].classList.remove("pulse");
    void cells[i].offsetWidth;
    cells[i].style.animationDelay = `${d * 40}ms`;
    cells[i].classList.add("pulse");
  }
}

export function clearEffects(cells) {
  for (const c of cells) {
    c.classList.remove("pulse", "wet", "lift");
    c.style.animationDelay = "";
  }
}

export function renderChips(el, pal) {
  el.innerHTML = "";
  for (const k of [M, Y, B, M | Y, M | B, Y | B, M | Y | B]) {
    const chip = document.createElement("span");
    chip.className = "chip";
    const swatch = document.createElement("i");
    swatch.style.background = pal[k];
    chip.append(swatch, NAME[k]);
    el.appendChild(chip);
  }
}

export function renderSolution(el, answer) {
  el.innerHTML = "";
  const head = document.createElement("b");
  head.textContent = "最短手順のひとつ";
  el.append(head, "（この通りに押せば揃います）");

  const ol = document.createElement("ol");
  for (const m of answer) {
    const li = document.createElement("li");
    li.textContent = `${Math.floor(m.i / N) + 1}行${(m.i % N) + 1}列　${NAME[m.bit]}`;
    ol.appendChild(li);
  }
  el.appendChild(ol);
}

export function renderDeck({ blob, name, rest }, { remaining, nextBit, pal, solved }) {
  const spent = remaining === 0;
  blob.classList.toggle("spent", spent);
  if (spent) {
    blob.style.background = "transparent";
    name.textContent = solved ? "刷り上がり" : "使い切り";
  } else {
    blob.style.background = pal[nextBit];
    blob.style.color = pal[nextBit];
    name.textContent = NAME[nextBit];
  }

  // 次の一手のあとに控えるインクを並べる
  rest.innerHTML = "";
  const shown = remaining === Infinity ? 3 : Math.min(remaining - 1, 9);
  for (let q = 1; q <= shown; q++) {
    const dot = document.createElement("i");
    const c = pal[[M, Y, B][(nextBitIndex(nextBit) + q) % 3]];
    dot.style.background = c;
    dot.style.color = c;
    rest.appendChild(dot);
  }
}

const nextBitIndex = bit => [M, Y, B].indexOf(bit);

export function renderTally(list, note,
  { cleared, totals, today, stageCount, canSave, days = 0, dailyToday = false }) {
  list.innerHTML = "";

  // 日刊は看板なので先頭に置く。数えるのは回数ではなく、五問そろえた日の数
  {
    const dt = document.createElement("dt");
    dt.textContent = "日刊";
    const val = document.createElement("dd");
    val.className = "val";
    const small = document.createElement("small");
    small.textContent = " 日";
    val.append(String(days), small);
    const gain = document.createElement("dd");
    gain.className = "gain";
    gain.textContent = dailyToday ? "+1" : "";
    list.append(dt, val, gain);
  }

  for (const m of MODES) {
    const dt = document.createElement("dt");
    dt.textContent = m.label;

    const val = document.createElement("dd");
    val.className = "val";
    const small = document.createElement("small");
    if (m.k === "t") {
      small.textContent = ` / ${stageCount} 面`;
      val.append(String(clearedCount(cleared)), small);
    } else {
      small.textContent = " 回";
      val.append(String(totals[m.k] | 0), small);
    }

    const gain = document.createElement("dd");
    gain.className = "gain";
    const g = today[m.k] | 0;
    gain.textContent = g > 0 ? `+${g}` : "";   // 0 は出さない。増えたときだけ知らせる

    list.append(dt, val, gain);
  }

  const gained = gainedToday(today);
  note.textContent = !canSave
    ? "この端末では記録を保存できません。数えるのは今回だけです。"
    : (gained > 0 ? `今日は ${gained} 枚 刷り上がりました。` : "");
}
