// 配線と起動。ここだけが DOM・音・保存・盤の進行をつなぐ。

import { PAL, PALETTE_NAMES } from "./palette.js";
import { openBackend, createSaveFile } from "./storage.js";
import { TUTORIAL, generateSequence } from "./puzzles.js";
import { createGame, PRESSED, BLOCKED, UNDONE } from "./game.js";
import { createAudio } from "./audio.js";
import { registerServiceWorker } from "./pwa.js";
import { dayKeyOf, rollDay, recordClear } from "./tally.js";
import {
  buildGrid, paintCell, flashAround, pulseFromCenter, clearEffects,
  renderChips, renderSolution, renderDeck, renderTally,
} from "./view.js";

const $ = id => document.getElementById(id);
const el = {
  board: $("board"), proof: $("proof"), moves: $("moves"), par: $("par"),
  inkName: $("inkName"), status: $("status"), sol: $("sol"), diff: $("diff"),
  peek: $("peek"), count: $("count"), finish: $("finish"), chips: $("chips"),
  ink0: $("ink0"), inkRest: $("inkRest"), undoKey: $("undoKey"), opts: $("opts"),
  optPanel: $("optpanel"), tallyList: $("tallyList"), tallyNote: $("tallyNote"),
  saveInfo: $("saveInfo"), wipe: $("wipe"), reroll: $("reroll"),
  deck: document.querySelector(".deck"),
};

const AUTO_SECONDS = 3;

// 右クリックのない端末に「右クリックで戻して」と言わない
const coarse = matchMedia("(pointer: coarse)").matches;
const TEXT = coarse ? {
  hint: "左の色校正と同じ配色になれば完成です。マスをタップしてインクを乗せ、「一手もどす」で戻します。",
  spent: "手数を使い切りました。「一手もどす」で戻してやり直してください。",
  next: "　盤をタップすると次へ進みます。",
} : {
  hint: "左の色校正と同じ配色になれば完成です。左クリックでインクを乗せ、右クリックで一手戻します。",
  spent: "手数を使い切りました。右クリックで戻してやり直してください。",
  next: "　盤をクリックすると次へ進みます。",
};

const game = createGame();
const audio = createAudio();
const saveFile = createSaveFile(openBackend(), {
  stageCount: TUTORIAL.length,
  paletteNames: PALETTE_NAMES,
});

let state = saveFile.load();
let stage = -1;          // -1 ならランダム出題、0以上なら練習の面番号
let winMsg = "";
let solvedAt = 0;
let advanceTimer = null;
let tickTimer = null;

const pal = () => PAL[state.palName];
const save = () => saveFile.save(state);

const cells = buildGrid(el.board, { interactive: true, onPress });
const proofCells = buildGrid(el.proof, { interactive: false });

/* ---------- 描画 ---------- */

function draw() {
  const showDiff = state.showDiff;
  for (let i = 0; i < cells.length; i++) {
    paintCell(cells[i], game.cellAt(i), {
      pal: pal(), markMode: state.markMode,
      showMiss: game.mismatched(i) && showDiff && !game.solved,
    });
    paintCell(proofCells[i], game.targetAt(i), { pal: pal(), markMode: state.markMode });
  }

  el.undoKey.disabled = !game.canUndo;
  const remaining = game.remaining();
  el.moves.textContent = remaining === Infinity ? "—" : remaining;
  el.par.textContent = game.par === null ? "—" : game.par;

  renderDeck({ blob: el.ink0, name: el.inkName, rest: el.inkRest },
    { remaining, nextBit: game.nextInk(), pal: pal(), solved: game.solved });
}

function setStatus(text, win) {
  el.status.textContent = text;
  el.status.className = win ? "status win" : "status";
}

function showTally() {
  state = rollDay(state, dayKeyOf());
  renderTally(el.tallyList, el.tallyNote, {
    cleared: state.cleared, totals: state.totals, today: state.today,
    stageCount: TUTORIAL.length, canSave: saveFile.available,
  });
}

/* ---------- 出題 ---------- */

function start(cellSeq) {
  game.load(cellSeq);
  el.peek.setAttribute("aria-pressed", "false");
  el.sol.classList.remove("open");
  el.count.textContent = "";
  el.deck.classList.remove("spent");
  el.reroll.textContent = stage >= 0 ? "この面をやり直す" : "別の課題";
  renderSolution(el.sol, game.answer);
  renderChips(el.chips, pal());
  draw();
}

function newGame(level) {
  if (level) state = { ...state, level };
  closeFinish();
  stage = -1;
  save();
  start(generateSequence(state.level));
  setStatus(TEXT.hint, false);
}

function loadStage(n) {
  closeFinish();
  stage = n;
  if (n > state.reached) { state = { ...state, reached: n }; save(); }
  const st = TUTORIAL[n];
  start(st.s);
  setStatus(`練習 ${n + 1} / ${TUTORIAL.length}「${st.t}」　${st.h}`, false);
}

// 練習を終えたら、ふつうの出題へ送り出す
function endTutorial() {
  state = { ...state, tutorialDone: true };
  save();
  setSeg("data-k", "6");
  newGame(6);
  setStatus("練習はここまでです。ここからは毎回ちがう課題が出ます。", false);
}

function goNext() {
  if (stage < 0) return newGame();
  if (stage + 1 < TUTORIAL.length) loadStage(stage + 1);
  else endTutorial();
}

/* ---------- 操作 ---------- */

function onPress(idx) {
  const r = game.press(idx);
  if (r.type === BLOCKED) {
    audio.blocked();
    if (navigator.vibrate) navigator.vibrate(18);
    el.deck.classList.remove("spent");
    void el.deck.offsetWidth;
    el.deck.classList.add("spent");
    setStatus(TEXT.spent, false);
    return;
  }
  if (r.type !== PRESSED) return;

  audio.ink(r.bit, 0);
  flashAround(cells, idx, "wet");
  if (r.solved) onSolved();
  draw();
}

function onSolved() {
  const mode = stage >= 0 ? "t" : String(state.level);
  if (stage >= 0) {
    const cleared = state.cleared.slice();
    cleared[stage] = true;
    state = { ...state, cleared };
  }
  state = recordClear(rollDay(state, dayKeyOf()), mode);
  save();
  showTally();

  winMsg = `刷り上がりました。最短の${game.moves}手です。`;
  solvedAt = Date.now();
  setStatus(winMsg, true);
  celebrate();
}

function undo() {
  const r = game.undo();
  if (r.type !== UNDONE) {
    setStatus("これ以上は戻せません。白紙の状態です。", false);
    return false;
  }
  audio.peel();
  flashAround(cells, r.idx, "lift");
  draw();
  return true;
}

/* ---------- 校了と自動遷移 ---------- */

function closeFinish() {
  clearTimeout(advanceTimer);
  clearInterval(tickTimer);
  advanceTimer = tickTimer = null;
  el.finish.hidden = true;
  el.count.textContent = "";
  el.board.classList.remove("done");
  clearEffects(cells);
}

function celebrate() {
  pulseFromCenter(cells);
  audio.done();
  el.board.classList.remove("done");
  void el.board.offsetWidth;
  el.board.classList.add("done");
  el.finish.hidden = false;

  let left = AUTO_SECONDS;
  const dest = stage >= 0 && stage + 1 < TUTORIAL.length ? "次の練習" : "次の課題";
  const tick = () => { el.count.textContent = `${left}秒後に${dest}へ（クリックで中断）`; };
  tick();
  tickTimer = setInterval(() => { left--; if (left > 0) tick(); }, 1000);
  advanceTimer = setTimeout(() => { closeFinish(); goNext(); }, AUTO_SECONDS * 1000);
}

function cancelAdvance() {
  if (!advanceTimer) return false;
  closeFinish();
  setStatus(winMsg + TEXT.next, true);
  return true;
}

/* ---------- 入力の配線 ---------- */

el.finish.addEventListener("click", cancelAdvance);

// 刷り上がったあとは、盤をクリックするだけで「眺める → 次へ」。
// 揃えた瞬間のクリックそのものを拾わないよう、成立直後だけ受け付けない。
el.board.addEventListener("click", () => {
  if (!game.solved || Date.now() - solvedAt < 350) return;
  if (!cancelAdvance()) goNext();
});

// 刷り台の上での右クリックは一手戻す（メニューは出さない）
el.board.addEventListener("contextmenu", e => {
  e.preventDefault();
  if (game.solved) {
    if (!cancelAdvance()) setStatus(winMsg + TEXT.next, true);
    return;
  }
  undo();
});

// 戻すキー。押し続けると続けて戻せる（12手ぶん戻す場面があるため）
let holdStart = null, holdRepeat = null;
const stopHold = () => {
  clearTimeout(holdStart);
  clearInterval(holdRepeat);
  holdStart = holdRepeat = null;
};
el.undoKey.addEventListener("click", () => { if (!holdRepeat) undo(); });
el.undoKey.addEventListener("pointerdown", () => {
  stopHold();
  holdStart = setTimeout(() => {
    holdStart = null;
    holdRepeat = setInterval(() => { if (!undo()) stopHold(); }, 150);
  }, 420);
});
for (const ev of ["pointerup", "pointerleave", "pointercancel"]) {
  el.undoKey.addEventListener(ev, () => {
    const wasRepeating = !!holdRepeat;
    stopHold();
    if (wasRepeating) setTimeout(() => { holdRepeat = null; }, 0);
  });
}

el.diff.addEventListener("click", () => {
  state = { ...state, showDiff: el.diff.getAttribute("aria-pressed") !== "true" };
  el.diff.setAttribute("aria-pressed", String(state.showDiff));
  draw();
  save();
});

// 答えは課題ごとに閉じる。ずっと開けておくものではない
el.peek.addEventListener("click", () => {
  const on = el.peek.getAttribute("aria-pressed") !== "true";
  el.peek.setAttribute("aria-pressed", String(on));
  el.sol.classList.toggle("open", on);
});

el.reroll.addEventListener("click", () => {
  if (stage >= 0) loadStage(stage);
  else newGame();
});

function segWire(selector, apply) {
  const buttons = document.querySelectorAll(selector);
  for (const b of buttons) {
    b.addEventListener("click", () => {
      for (const x of buttons) x.setAttribute("aria-pressed", "false");
      b.setAttribute("aria-pressed", "true");
      apply(b);
    });
  }
}

function setSeg(attr, value) {
  for (const b of document.querySelectorAll(`.seg button[${attr}]`)) {
    b.setAttribute("aria-pressed", String(b.getAttribute(attr) === String(value)));
  }
}

segWire(".seg button[data-k]", b => {
  if (b.dataset.k === "t") loadStage(stage >= 0 ? stage : state.reached);
  else newGame(Number(b.dataset.k));
});
segWire(".seg button[data-pal]", b => {
  state = { ...state, palName: b.dataset.pal };
  renderChips(el.chips, pal());
  draw();
  save();
});
segWire(".seg button[data-mark]", b => {
  state = { ...state, markMode: b.dataset.mark };
  draw();
  save();
});
segWire(".seg button[data-crt]", b => {
  state = { ...state, crtOn: b.dataset.crt === "on" };
  document.documentElement.classList.toggle("screen", state.crtOn);
  save();
});
segWire(".seg button[data-snd]", b => {
  state = { ...state, soundOn: b.dataset.snd === "on" };
  audio.setEnabled(state.soundOn);
  if (state.soundOn) audio.ink(1, 0);   // 試聴を兼ねて一度だけ鳴らす
  save();
});

el.opts.addEventListener("click", () => {
  const open = el.opts.getAttribute("aria-expanded") === "true";
  el.opts.setAttribute("aria-expanded", String(!open));
  el.optPanel.hidden = open;
});

el.wipe.addEventListener("click", () => {
  saveFile.clear();
  state = saveFile.load();
  showSaveInfo();
  showTally();
  setSeg("data-k", "t");
  loadStage(0);
  setStatus("記録を消しました。練習の1面目からやり直します。", false);
});

// 矢印キーで盤上を移動する
el.board.addEventListener("keydown", e => {
  const i = cells.indexOf(document.activeElement);
  if (i < 0) return;
  const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (!step) return;
  e.preventDefault();
  const r = Math.min(Math.max(Math.floor(i / 5) + step[0], 0), 4);
  const c = Math.min(Math.max((i % 5) + step[1], 0), 4);
  cells[r * 5 + c].focus();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (cancelAdvance()) return;
    if (!el.optPanel.hidden) {
      el.optPanel.hidden = true;
      el.opts.setAttribute("aria-expanded", "false");
      el.opts.focus();
    }
    return;
  }
  if (e.key === "z" || e.key === "Z" || e.key === "Backspace") {
    if (game.solved) return;
    e.preventDefault();
    undo();
  }
});

function showSaveInfo() {
  el.saveInfo.textContent = saveFile.available ? "保存できます" : "この環境では保存できません";
  el.wipe.disabled = !saveFile.available;
}

/* ---------- 起動 ---------- */

audio.setEnabled(state.soundOn);
document.documentElement.classList.toggle("screen", state.crtOn);
setSeg("data-crt", state.crtOn ? "on" : "off");
setSeg("data-pal", state.palName);
setSeg("data-mark", state.markMode);
setSeg("data-snd", state.soundOn ? "on" : "off");
el.diff.setAttribute("aria-pressed", String(state.showDiff));

if (state.tutorialDone) {
  setSeg("data-k", state.level);
  newGame(state.level);
} else {
  setSeg("data-k", "t");
  loadStage(state.reached);
}
showSaveInfo();
showTally();

// 圏外でも開けるようにする。使えない環境では何も起きない
registerServiceWorker(navigator.serviceWorker, "./sw.js");
