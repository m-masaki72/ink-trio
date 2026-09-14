// 配線と起動。ここだけが DOM・音・保存・盤の進行をつなぐ。

import { PAL, PALETTE_NAMES } from "./palette.js";
import { openBackend, createSaveFile } from "./storage.js";
import { TUTORIAL, generateSequence } from "./puzzles.js";
import { createGame, PRESSED, BLOCKED, UNDONE } from "./game.js";
import { createAudio } from "./audio.js";
import { SZ, MAX_MOVES } from "./rules.js";
import {
  SHAPE, issueOf, issueSet, blankRecord, solvedCount, totalMs, nextSlot, mergeSlot, bumpDays,
} from "./daily.js";
import { boardText, shareText, formatDuration, clockText } from "./share.js";
import { RUSH_MS, RUNS_PER_DAY, createRun, better } from "./rush.js";
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
  deck: document.querySelector(".deck"), levels: $("levels"),
  issuebar: $("issuebar"), issueNo: $("issueNo"), issueStep: $("issueStep"),
  issueClock: $("issueClock"), issuePrev: $("issuePrev"), issueNext: $("issueNext"),
  shareRow: $("shareRow"), shareCopy: $("shareCopy"), shareX: $("shareX"),
  shareNote: $("shareNote"),
  rushbar: $("rushbar"), rushStart: $("rushStart"), rushPass: $("rushPass"),
  rushLeft: $("rushLeft"), rushCount: $("rushCount"), rushReview: $("rushReview"),
  rushQuit: $("rushQuit"),
  rushNote: $("rushNote"),
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
  cellCount: SZ,
  maxMoves: MAX_MOVES,
  slotCount: SHAPE.length,
});

let state = saveFile.load();
let stage = 0;           // 練習の何面目か。どのモードかは playMode が持つ
let winMsg = "";
let solvedAt = 0;
let advanceTimer = null;
let usedAid = false;      // この課題で補助を使ったか
let playMode = "free";    // "daily" | "tutorial" | "free"
let issue = 0;            // いま開いている号
let slot = 0;             // 号のなかの何問目
let issueBoards = [];
let pressedAt = 0;        // 最初の一手の時刻。盤を読む時間は計らない
let clockTimer = null;
let run = null;           // いまの走行
let rushTimer = null;
let review = [];          // パスした盤の見直し待ち
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
    days: state.daily.days, dailyToday: state.daily.lastDay === dayKeyOf(),
    rushBest: state.rush.best,
  });
}

/* ---------- 日刊 ---------- */

const todayIssue = () => issueOf(dayKeyOf());
const keyOf = n => String(n);
const recordOf = n => state.daily.sets[keyOf(n)] || blankRecord();

function drawClock() {
  if (playMode !== "daily" || !state.daily.clock) { el.issueClock.textContent = ""; return; }
  el.issueClock.textContent = pressedAt ? formatDuration(performance.now() - pressedAt) : "0.0秒";
}
function stopClock() { clearInterval(clockTimer); clockTimer = null; }
function startClock() {
  stopClock();
  if (playMode === "daily") clockTimer = setInterval(drawClock, 100);
}

function drawIssueBar() {
  el.issuebar.hidden = playMode !== "daily";
  if (playMode !== "daily") return;
  el.issueNo.textContent = `第${issue}号`;
  el.issueStep.textContent = `${slot + 1} / ${SHAPE.length}問目　済 ${solvedCount(recordOf(issue))}`;
  el.issuePrev.disabled = issue <= 1;
  el.issueNext.disabled = issue >= (todayIssue() || 1);
  drawClock();
}

function recordSlot(ms) {
  const rec = mergeSlot(recordOf(issue), {
    slot, ms, undo: game.undos, seq: game.pressed, aid: usedAid,
  });
  const daily = bumpDays(state.daily, {
    rec, issue, todayIssue: todayIssue(), today: dayKeyOf(),
  });
  state = { ...state,
    daily: { ...daily, sets: { ...daily.sets, [keyOf(issue)]: rec } } };
  save();
  return rec;
}

function loadDailySlot(n) {
  closeFinish();
  slot = Math.min(Math.max(n, 0), SHAPE.length - 1);
  const here = issueBoards[slot];
  start(here.seq);
  setStatus(`第${issue}号 ${slot + 1}問目（${here.level}手）。${TEXT.hint}`, false);
}

function openIssue(n) {
  issue = Math.min(Math.max(n, 1), todayIssue() || 1);
  issueBoards = issueSet(issue);
  const rec = recordOf(issue);
  const next = nextSlot(rec);
  loadDailySlot(next < 0 ? 0 : next);
  if (next < 0) showShare(rec);        // 済んだ号は結果をもう一度写せる
}

function showShare(rec) {
  const text = shareText({
    issue,
    solved: solvedCount(rec),
    total: SHAPE.length,
    ms: rec.ms.reduce((a, b) => a + b, 0),
    board: boardText(issueBoards[SHAPE.length - 1].seq),
  });
  el.shareRow.hidden = false;
  el.shareX.href = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
  el.shareCopy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      el.shareNote.textContent = "写しました";
    } catch {
      el.shareNote.textContent = "写せませんでした";
    }
  };
}

function setMode(m) {
  const from = playMode;
  // 走行中に同じタブを押しても取り替えない。無料の引き直しになってしまう
  if (m === "rush" && from === "rush" && run && run.running) return;
  // 起点より前の日付では号が無い。モードを移さずに知らせる
  if (m === "daily" && !todayIssue()) {
    setStatus("日刊はまだ始まっていません。端末の日付をご確認くださいませ。", false);
    return;
  }
  if (from === "rush" && m !== "rush") stopRush();

  playMode = m;
  el.shareRow.hidden = true;        // 日刊の結果をほかのタブへ持ち出さない

  if (m === "rush") {
    stopRushClock();
    run = null;
    review = [];
    rollRushDay();
    setStatus(`時間走です。「走る」で ${RUSH_MS / 60000}分の走行が始まります。`, false);
    drawBars();
    return;
  }
  if (m === "daily") {
    openIssue(issue || todayIssue());
  } else if (m === "tutorial") {
    loadStage(stage);
  } else {
    newGame(state.level);
  }
}

/* ---------- 時間走 ---------- */

// 日付が変わったら今日の走行回数を戻す。通算のベストには手を触れない
function rollRushDay() {
  const today = dayKeyOf();
  if (state.rush.day === today) return;
  state = { ...state, rush: { ...state.rush, day: today, count: 0, today: null } };
}

function stopRushClock() { clearInterval(rushTimer); rushTimer = null; }

// 走行中に動くのは残り時間だけ。9箇所を10回/秒で書き換えると、
// role="status" の #rushNote が同じ内容を読み上げ続ける
function tickRush() {
  if (!run) return;
  if (!run.running) return endRush();
  const left = clockText(run.remaining());
  if (left !== el.rushLeft.textContent) el.rushLeft.textContent = left;
}

function drawRushBar() {
  el.rushbar.hidden = playMode !== "rush";
  if (playMode !== "rush") return;
  const running = !!(run && run.running);
  el.rushLeft.textContent = clockText(running ? run.remaining() : RUSH_MS);
  el.rushCount.textContent = run ? `${run.solved}問` : "";
  el.rushPass.hidden = !running;
  el.rushQuit.hidden = !running;
  el.rushStart.hidden = running;
  el.rushStart.textContent = run ? "もう一度走る" : "走る";
  el.rushReview.hidden = running || review.length === 0;
  const rest = Math.max(0, RUNS_PER_DAY - state.rush.count);
  const best = state.rush.best ? `　自己最高 ${state.rush.best.solved}問` : "";
  const note = (rest > 0 ? `記録に残せる走行 あと${rest}回` : "練習走行") + best;
  if (note !== el.rushNote.textContent) el.rushNote.textContent = note;
}

// 表示の切替はここ一箇所。モードを足すたびに複数の関数を触らないため
function drawBars() {
  setSeg("data-mode", playMode);
  el.levels.hidden = playMode !== "free";
  if (playMode !== "daily") stopClock();
  if (playMode !== "rush") stopRushClock();
  drawIssueBar();
  drawRushBar();
}

function nextRushBoard(seq) {
  if (!seq) return endRush();
  closeFinish();
  start(seq);
}

function startRush() {
  rollRushDay();
  review = [];
  run = createRun({ now: () => performance.now() });
  const seq = run.start();
  closeFinish();
  start(seq);
  setStatus(`時間走。${RUSH_MS / 60000}分で何問さばけるか。行き詰まったら「パス」で次へ。`, false);
  stopRushClock();
  rushTimer = setInterval(tickRush, 250);
  drawBars();
}

function advanceRush() {
  audio.done();
  const count = run.solved + 1;
  nextRushBoard(run.solve());
  if (run.running) setStatus(`時間走 ${count}問。次の盤です。`, false);
}

function endRush() {
  stopRushClock();
  if (!run) return;
  run.stop();
  const res = run.result();
  review = res.passed;

  rollRushDay();
  const r = state.rush;
  const counts = r.count < RUNS_PER_DAY;
  const score = { solved: res.solved, ms: res.ms };
  state = { ...state, rush: {
    ...r,
    count: counts ? r.count + 1 : r.count,
    today: counts && better(score, r.today) ? score : r.today,
    best: counts && better(score, r.best) ? score : r.best,
  } };
  save();
  showTally();

  setStatus(`時間走 おわり。${res.solved}問`
    + (counts ? `（${formatDuration(res.ms)}）。` : "。記録には残しません（練習走行）。")
    + (review.length ? `　パスした${review.length}問を見直せます。` : ""), true);
  drawBars();
}

function stopRush() {
  stopRushClock();
  if (run && run.running) run.stop();
}

function showReview() {
  const seq = review.shift();
  if (!seq) return drawBars();
  closeFinish();
  start(seq);
  setStatus(`見直し。パスした盤です。「表示設定 → 答えを見る」で手順が出ます。残り${review.length}問。`, false);
  drawBars();
}

/* ---------- 出題 ---------- */

function start(cellSeq) {
  game.load(cellSeq);
  pressedAt = 0;
  el.peek.setAttribute("aria-pressed", "false");
  el.sol.classList.remove("open");
  // 答えを最初から DOM に置くと、押さなくても開発者ツールで読めてしまう。
  // 完全には守れないが、覗くのに一手間かかる状態にはできる
  el.sol.replaceChildren();
  usedAid = state.showDiff;
  el.count.textContent = "";
  el.deck.classList.remove("spent");
  el.reroll.textContent = playMode === "tutorial" ? "この面をやり直す" : "別の課題";
  el.reroll.hidden = playMode === "daily" || playMode === "rush";
  el.shareRow.hidden = true;
  el.shareNote.textContent = "";
  drawBars();
  renderChips(el.chips, pal());
  draw();
}

function newGame(level) {
  if (level) state = { ...state, level };
  closeFinish();
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
  playMode = "free";
  setSeg("data-k", "6");
  newGame(6);
  setStatus("練習はここまでです。ここからは毎回ちがう課題が出ます。", false);
}

function goNext() {
  // 走行の外（見直し）で自由出題へ落とすと、時間走のまま迷子になる
  if (playMode === "rush") return drawBars();
  if (playMode === "daily") {
    const next = nextSlot(recordOf(issue));
    // 済んだ号は順にめくれる。「過去の号はいつでも遊べる」という約束のため
    return loadDailySlot(next < 0 ? (slot + 1) % SHAPE.length : next);
  }
  if (playMode !== "tutorial") return newGame();
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

  // 盤を読む時間は計らない。読み上げで把握する人が一方的に不利になる。
  // 時計も一手目で動かしはじめる（眺めている間に空回りさせない）
  if (pressedAt === 0) { pressedAt = performance.now(); startClock(); }

  audio.ink(r.bit, 0);
  flashAround(cells, idx, "wet");
  if (r.solved) {
    // 時間走では校了の余韻を出さない。3秒の演出に持ち時間を食わせないため
    if (playMode === "rush" && run && run.running) return advanceRush();
    onSolved();
  }
  draw();
}

function onSolved() {
  const modeKey = playMode === "daily" ? String(issueBoards[slot].level)
    : playMode === "tutorial" ? "t" : String(state.level);
  if (playMode === "tutorial") {
    const cleared = state.cleared.slice();
    cleared[stage] = true;
    state = { ...state, cleared };
  }
  // 時間走は独自の記録を持つ。走行中は数えないのに見直しだけ数えると辻褄が合わない
  state = playMode === "rush"
    ? rollDay(state, dayKeyOf())
    : recordClear(rollDay(state, dayKeyOf()), modeKey);

  if (playMode === "daily") {
    stopClock();
    // recordSlot が保存する。ここで先に保存すると 64KB の同期書き込みが二度走る
    const rec = recordSlot(pressedAt ? performance.now() - pressedAt : 0);
    const done = solvedCount(rec);
    winMsg = done >= SHAPE.length
      ? `第${issue}号を刷り上げました。五問で${formatDuration(totalMs(rec))}です。`
      : `${slot + 1}問目、刷り上がりました。${formatDuration(rec.ms[slot])}。`;
    if (done >= SHAPE.length) showShare(rec);
    drawBars();
  } else {
    save();
    winMsg = `刷り上がりました。最短の${game.moves}手です。`;
  }
  showTally();
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
  const dest = playMode === "tutorial" && stage + 1 < TUTORIAL.length ? "次の練習" : "次の課題";
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

for (const b of document.querySelectorAll(".tab")) {
  b.addEventListener("click", () => setMode(b.dataset.mode));
}
el.issuePrev.addEventListener("click", () => openIssue(issue - 1));
el.rushStart.addEventListener("click", startRush);
el.rushPass.addEventListener("click", () => { if (run && run.running) nextRushBoard(run.pass()); });
el.rushReview.addEventListener("click", showReview);
// 詰まった人を5分縛り付けない。やめた時点までは記録に残す
el.rushQuit.addEventListener("click", () => { if (run && run.running) endRush(); });
el.issueNext.addEventListener("click", () => openIssue(issue + 1));

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
  if (state.showDiff) usedAid = true;
  draw();
  save();
});

// 答えは課題ごとに閉じる。ずっと開けておくものではない
el.peek.addEventListener("click", () => {
  const on = el.peek.getAttribute("aria-pressed") !== "true";
  el.peek.setAttribute("aria-pressed", String(on));
  if (on) {
    if (!el.sol.hasChildNodes()) renderSolution(el.sol, game.answer);
    usedAid = true;
  }
  el.sol.classList.toggle("open", on);
});

el.reroll.addEventListener("click", () => {
  if (playMode === "tutorial") loadStage(stage);
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

segWire(".seg button[data-k]", b => newGame(Number(b.dataset.k)));
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
  playMode = "tutorial";
  issue = 0;
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

playMode = state.tutorialDone ? "free" : "tutorial";
stage = state.reached;
if (state.tutorialDone) {
  setSeg("data-k", state.level);
  newGame(state.level);
} else {
  loadStage(state.reached);
}
showSaveInfo();
showTally();

// 圏外でも開けるようにする。使えない環境では何も起きない
registerServiceWorker(navigator.serviceWorker, "./sw.js");
