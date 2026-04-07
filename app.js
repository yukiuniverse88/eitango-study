// ===== APP STATE =====
const state = {
  currentScreen: "home",
  currentCategory: null,
  currentMode: null,
  soundEnabled: true,
  // Quiz state
  quizWords: [],
  quizIndex: 0,
  quizScore: 0,
  // Match state
  matchCards: [],
  matchFlipped: [],
  matchMatched: 0,
  matchTotal: 0,
  matchAttempts: 0,
  matchLocked: false,
  // Type state
  typeWords: [],
  typeIndex: 0,
  typeInput: "",
  typeScore: 0,
  shiftActive: false,
  hintLevel: 0,
  // Reorder state
  reorderSentences: [],
  reorderIndex: 0,
  reorderScore: 0,
  reorderPlaced: [],
  reorderBank: [],
  // Choose Sentence state
  csSentences: [],
  csIndex: 0,
  csScore: 0,
  // Fill Blank state
  fbSentences: [],
  fbIndex: 0,
  fbScore: 0,
  // Progress
  progress: JSON.parse(localStorage.getItem("eng5-progress") || "{}"),
};

// ===== SOUND =====
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let audioUnlocked = false;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  // Silkブラウザ等でsuspended状態なら resume
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// Fireタブレット(Silk)対策: 最初のタッチでAudioContextをアンロック
function unlockAudio() {
  if (audioUnlocked) return;
  try {
    const ctx = getAudioCtx();
    // 無音を一瞬再生してアンロック
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    audioUnlocked = true;
  } catch (e) {}
  // SpeechSynthesisもアンロック（空発話）
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

// 複数イベントでアンロック（タッチ・クリック両方対応）
["touchstart", "touchend", "click"].forEach(evt => {
  document.addEventListener(evt, unlockAudio, { once: false, passive: true });
});

function playSound(type) {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    gain.gain.value = 0.15;
    if (type === "correct") {
      osc.frequency.value = 523; osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
      const o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination);
      o2.frequency.value = 659; o2.type = "sine";
      g2.gain.setValueAtTime(0.15, ctx.currentTime + 0.1);
      g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      o2.start(ctx.currentTime + 0.1); o2.stop(ctx.currentTime + 0.4);
    } else if (type === "wrong") {
      osc.frequency.value = 200; osc.type = "sawtooth";
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } else if (type === "click") {
      osc.frequency.value = 800; osc.type = "sine";
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
    } else if (type === "flip") {
      osc.frequency.value = 600; osc.type = "sine";
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
    } else if (type === "match") {
      osc.frequency.value = 440; osc.type = "sine";
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
      const o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination); o2.frequency.value = 660;
      g2.gain.setValueAtTime(0.12, ctx.currentTime + 0.1);
      g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      o2.start(ctx.currentTime + 0.1); o2.stop(ctx.currentTime + 0.3);
      const o3 = ctx.createOscillator(), g3 = ctx.createGain();
      o3.connect(g3); g3.connect(ctx.destination); o3.frequency.value = 880;
      g3.gain.setValueAtTime(0.12, ctx.currentTime + 0.2);
      g3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      o3.start(ctx.currentTime + 0.2); o3.stop(ctx.currentTime + 0.45);
    } else if (type === "complete") {
      [523, 659, 784, 1047].forEach((freq, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.frequency.value = freq; o.type = "sine";
        g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.4);
        o.start(ctx.currentTime + i * 0.12); o.stop(ctx.currentTime + i * 0.12 + 0.4);
      });
    } else if (type === "place") {
      osc.frequency.value = 500; osc.type = "sine";
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
    }
  } catch (e) {}
}

function speakWord(word) {
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    // Fireタブレット対策: 少し遅延させて発話
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(word);
      u.lang = "en-US";
      u.rate = 0.8;
      u.volume = 1;
      speechSynthesis.speak(u);
    }, 50);
  } catch (e) {}
}

function speakSentence(text) {
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 0.75;
      u.volume = 1;
      speechSynthesis.speak(u);
    }, 50);
  } catch (e) {}
}

// ===== NAVIGATION =====
const ALL_MODE_SCREENS = ["choose-mode", "match-mode", "type-mode", "reorder-mode", "choose-sentence-mode", "fillblank-mode"];

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
  state.currentScreen = screenId;
  const backBtn = document.querySelector(".back-btn");
  if (screenId === "home") {
    backBtn.classList.remove("visible");
    document.querySelector(".app-header h1").textContent = "English Words 5";
  } else {
    backBtn.classList.add("visible");
  }
}

function goBack() {
  if (state.currentScreen === "mode-select") showScreen("home");
  else if (ALL_MODE_SCREENS.includes(state.currentScreen)) showScreen("mode-select");
  else if (state.currentScreen === "result") showScreen("mode-select");
}

// ===== PROGRESS =====
function saveProgress(category, mode, score, total) {
  const key = `${category}_${mode}`;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  if (!state.progress[key] || pct > state.progress[key]) {
    state.progress[key] = pct;
    localStorage.setItem("eng5-progress", JSON.stringify(state.progress));
  }
}

function getCategoryStars(catKey) {
  let totalPct = 0;
  const modes = ["choose", "match", "type", "reorder", "choose-sentence", "fillblank"];
  modes.forEach(m => {
    const key = `${catKey}_${m}`;
    if (state.progress[key] !== undefined) totalPct += state.progress[key];
  });
  const avg = totalPct / modes.length;
  if (avg >= 90) return 3;
  if (avg >= 60) return 2;
  if (avg >= 30) return 1;
  return 0;
}

function renderStars(count) { return "★".repeat(count) + "☆".repeat(3 - count); }

// ===== HELPERS =====
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function showFeedback(isCorrect) {
  if (!isCorrect) return;
  const overlay = document.getElementById("feedback-overlay");
  const text = overlay.querySelector(".feedback-text");
  text.textContent = "⭕"; text.className = "feedback-text correct";
  overlay.classList.add("show");
  setTimeout(() => overlay.classList.remove("show"), 600);
}

function showWrongPopup(word, chosenText, onClose) {
  const existing = document.querySelector(".popup-overlay");
  if (existing) existing.remove();
  const popup = document.createElement("div");
  popup.className = "popup-overlay";
  popup.innerHTML = `
    <div class="popup-card">
      <div class="popup-label">❌ ざんねん！</div>
      <span class="popup-emoji">${word.emoji}</span>
      <div class="popup-ja">${word.ja}</div>
      ${chosenText ? `<div class="popup-wrong">${chosenText}</div>` : ""}
      <div class="popup-correct-word">${word.en}</div>
      <button class="popup-speak-btn" id="popup-speak">🔊</button>
      <div class="popup-tip"><div class="popup-tip-label">💡 こうやって覚えよう！</div><div class="popup-tip-text">${word.tip || ""}</div></div>
      <button class="popup-close-btn" id="popup-close">とじる</button>
    </div>`;
  document.body.appendChild(popup);
  document.getElementById("popup-speak").addEventListener("click", () => speakWord(word.en));
  document.getElementById("popup-close").addEventListener("click", () => { popup.remove(); if (onClose) onClose(); });
}

function showWrongPopupSentence(correctText, chosenText, onClose) {
  const existing = document.querySelector(".popup-overlay");
  if (existing) existing.remove();
  const popup = document.createElement("div");
  popup.className = "popup-overlay";
  popup.innerHTML = `
    <div class="popup-card">
      <div class="popup-label">❌ ざんねん！</div>
      ${chosenText ? `<div class="popup-wrong" style="font-size:14px">${chosenText}</div>` : ""}
      <div class="popup-correct-word" style="font-size:24px;letter-spacing:0">${correctText}</div>
      <button class="popup-speak-btn" id="popup-speak">🔊</button>
      <div class="popup-tip"><div class="popup-tip-label">💡 正しい文はこれ！</div><div class="popup-tip-text">声に出して読んでみよう！<br>「${correctText}」</div></div>
      <button class="popup-close-btn" id="popup-close">とじる</button>
    </div>`;
  document.body.appendChild(popup);
  document.getElementById("popup-speak").addEventListener("click", () => speakSentence(correctText));
  document.getElementById("popup-close").addEventListener("click", () => { popup.remove(); if (onClose) onClose(); });
}

function showConfetti() {
  const container = document.getElementById("confetti-container");
  const colors = ["#FF6B35", "#4ECDC4", "#FFE66D", "#FF6B6B", "#7C83FD", "#A8E6CF"];
  for (let i = 0; i < 50; i++) {
    const c = document.createElement("div"); c.className = "confetti";
    c.style.left = Math.random() * 100 + "%";
    c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    c.style.width = (Math.random() * 8 + 6) + "px"; c.style.height = (Math.random() * 8 + 6) + "px";
    c.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    c.style.animationDuration = (Math.random() * 1.5 + 1) + "s";
    c.style.animationDelay = (Math.random() * 0.5) + "s";
    container.appendChild(c);
  }
  setTimeout(() => container.innerHTML = "", 3000);
}

// ===== HOME SCREEN =====
function renderHome() {
  const grid = document.getElementById("category-grid");
  grid.innerHTML = "";
  Object.entries(WORD_DATA).forEach(([key, cat]) => {
    const stars = getCategoryStars(key);
    const card = document.createElement("div");
    card.className = "category-card";
    card.innerHTML = `<span class="icon">${cat.icon}</span><div class="name">${cat.name}</div><div class="word-count">${cat.words.length}もじ</div><div class="stars">${renderStars(stars)}</div>`;
    card.addEventListener("click", () => { playSound("click"); state.currentCategory = key; renderModeSelect(key); showScreen("mode-select"); });
    grid.appendChild(card);
  });
}

// ===== MODE SELECT =====
function renderModeSelect(catKey) {
  const cat = WORD_DATA[catKey];
  const hasSentences = SENTENCE_DATA && SENTENCE_DATA[catKey];
  const area = document.getElementById("mode-select");
  document.querySelector(".app-header h1").textContent = cat.name;

  let sentenceSection = "";
  if (hasSentences) {
    sentenceSection = `
      <div class="mode-section-title"><span class="section-icon">✏️</span> 文をつくる</div>
      <div class="mode-cards">
        <div class="mode-card choose" data-mode="reorder">
          <div class="mode-icon">🔀</div>
          <div class="mode-info"><h3>ならべかえ</h3><p>ことばを正しい順番にならべよう！</p></div>
        </div>
        <div class="mode-card match" data-mode="choose-sentence">
          <div class="mode-icon">🖼️</div>
          <div class="mode-info"><h3>絵から文をえらぶ</h3><p>絵に合う英語の文をえらぼう！</p></div>
        </div>
        <div class="mode-card type" data-mode="fillblank">
          <div class="mode-icon">✍️</div>
          <div class="mode-info"><h3>穴うめ</h3><p>（　）に入る単語をえらぼう！</p></div>
        </div>
      </div>`;
  }

  area.innerHTML = `
    <div class="mode-header"><span class="cat-icon">${cat.icon}</span><div class="cat-name">${cat.name}</div></div>
    <div class="mode-section-title"><span class="section-icon">🔤</span> 単語をおぼえる</div>
    <div class="mode-cards">
      <div class="mode-card choose" data-mode="choose">
        <div class="mode-icon">🎯</div>
        <div class="mode-info"><h3>えらぶモード</h3><p>4つの中から正しい英単語をえらぼう！</p></div>
      </div>
      <div class="mode-card match" data-mode="match">
        <div class="mode-icon">🃏</div>
        <div class="mode-info"><h3>マッチングモード</h3><p>英語と日本語のペアをさがそう！</p></div>
      </div>
      <div class="mode-card type" data-mode="type">
        <div class="mode-icon">⌨️</div>
        <div class="mode-info"><h3>タイピングモード</h3><p>英単語をキーボードで打ってみよう！</p></div>
      </div>
    </div>
    ${sentenceSection}`;

  area.querySelectorAll(".mode-card").forEach(card => {
    card.addEventListener("click", () => {
      playSound("click");
      const mode = card.dataset.mode;
      state.currentMode = mode;
      if (mode === "choose") startChooseMode(catKey);
      else if (mode === "match") startMatchMode(catKey);
      else if (mode === "type") startTypeMode(catKey);
      else if (mode === "reorder") startReorderMode(catKey);
      else if (mode === "choose-sentence") startChooseSentenceMode(catKey);
      else if (mode === "fillblank") startFillBlankMode(catKey);
    });
  });
}

// ===== CHOOSE MODE (4択) =====
function startChooseMode(catKey) {
  const cat = WORD_DATA[catKey];
  state.quizWords = shuffle(cat.words); state.quizIndex = 0; state.quizScore = 0;
  document.querySelector(".app-header h1").textContent = `${cat.name} - えらぶ`;
  showScreen("choose-mode"); renderQuizQuestion();
}

function renderQuizQuestion() {
  const area = document.getElementById("choose-mode");
  const word = state.quizWords[state.quizIndex];
  const total = state.quizWords.length;
  const pct = (state.quizIndex / total) * 100;
  const confusables = word.confusables ? shuffle(word.confusables).slice(0, 2) : [];
  const allWords = Object.values(WORD_DATA).flatMap(c => c.words);
  const realWrongs = shuffle(allWords.filter(w => w.en !== word.en)).slice(0, 3 - confusables.length);
  const wrongChoices = [...confusables.map(c => ({ en: c })), ...realWrongs.map(w => ({ en: w.en }))].slice(0, 3);
  const choices = shuffle([{ en: word.en }, ...wrongChoices]);

  area.innerHTML = `<div class="quiz-area">
    <div class="quiz-progress"><span>${state.quizIndex + 1} / ${total}</span><div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div><span>⭕ ${state.quizScore}</span></div>
    <span class="quiz-emoji">${word.emoji}</span><div class="quiz-japanese">${word.ja}</div>
    <button class="quiz-speaker-btn" id="speak-btn">🔊</button>
    <div class="quiz-hint">えいごでなんて言う？</div>
    <div class="quiz-choices">${choices.map(c => `<button class="quiz-choice" data-word="${c.en}">${c.en}</button>`).join("")}</div></div>`;
  document.getElementById("speak-btn").addEventListener("click", () => speakWord(word.en));
  area.querySelectorAll(".quiz-choice").forEach(btn => btn.addEventListener("click", () => handleQuizAnswer(btn, word)));
}

function handleQuizAnswer(btn, word) {
  const chosen = btn.dataset.word, isCorrect = chosen === word.en;
  document.querySelectorAll(".quiz-choice").forEach(b => {
    b.style.pointerEvents = "none";
    if (b.dataset.word === word.en) b.classList.add("correct");
    else if (b === btn && !isCorrect) b.classList.add("wrong");
  });
  if (isCorrect) { state.quizScore++; playSound("correct"); speakWord(word.en); showFeedback(true); setTimeout(() => advanceQuiz(), 1200); }
  else { playSound("wrong"); setTimeout(() => showWrongPopup(word, chosen, () => advanceQuiz()), 400); }
}

function advanceQuiz() { state.quizIndex++; if (state.quizIndex < state.quizWords.length) renderQuizQuestion(); else showResult("choose"); }

// ===== MATCH MODE =====
function startMatchMode(catKey) {
  const cat = WORD_DATA[catKey];
  const selected = shuffle(cat.words).slice(0, 6);
  state.matchTotal = selected.length; state.matchMatched = 0; state.matchAttempts = 0; state.matchFlipped = []; state.matchLocked = false;
  const cards = [];
  selected.forEach((w, i) => {
    cards.push({ id: `en-${i}`, pairId: i, type: "en", text: w.en, emoji: w.emoji, word: w });
    cards.push({ id: `ja-${i}`, pairId: i, type: "ja", text: w.ja, emoji: w.emoji, word: w });
  });
  state.matchCards = shuffle(cards);
  document.querySelector(".app-header h1").textContent = `${cat.name} - マッチング`;
  showScreen("match-mode"); renderMatchGrid();
}

function renderMatchGrid() {
  const area = document.getElementById("match-mode");
  area.innerHTML = `<div class="match-area"><div class="match-stats"><span>ペア: ${state.matchMatched} / ${state.matchTotal}</span><span>トライ: ${state.matchAttempts}</span></div>
    <div class="match-grid">${state.matchCards.map(c => `<div class="match-card" data-id="${c.id}" data-pair="${c.pairId}" data-type="${c.type}"><span class="card-back">❓</span><div class="card-front"><span class="card-emoji">${c.emoji}</span><span>${c.text}</span></div></div>`).join("")}</div></div>`;
  area.querySelectorAll(".match-card").forEach(card => card.addEventListener("click", () => handleMatchClick(card)));
}

function handleMatchClick(el) {
  if (state.matchLocked || el.classList.contains("flipped") || el.classList.contains("matched")) return;
  playSound("flip"); el.classList.add("flipped", el.dataset.type === "en" ? "en-card" : "ja-card");
  state.matchFlipped.push(el);
  if (state.matchFlipped.length === 2) {
    state.matchAttempts++; state.matchLocked = true;
    const [a, b] = state.matchFlipped;
    if (a.dataset.pair === b.dataset.pair && a.dataset.type !== b.dataset.type) {
      setTimeout(() => {
        a.classList.add("matched"); b.classList.add("matched"); state.matchMatched++; playSound("match");
        const w = state.matchCards.find(c => c.id === a.dataset.id); if (w) speakWord(w.word.en);
        document.querySelector(".match-stats").innerHTML = `<span>ペア: ${state.matchMatched} / ${state.matchTotal}</span><span>トライ: ${state.matchAttempts}</span>`;
        state.matchFlipped = []; state.matchLocked = false;
        if (state.matchMatched === state.matchTotal) setTimeout(() => showResult("match"), 600);
      }, 400);
    } else {
      setTimeout(() => { a.classList.remove("flipped", "en-card", "ja-card"); b.classList.remove("flipped", "en-card", "ja-card"); state.matchFlipped = []; state.matchLocked = false; }, 800);
    }
  }
}

// ===== TYPE MODE =====
function startTypeMode(catKey) {
  const cat = WORD_DATA[catKey];
  state.typeWords = shuffle(cat.words); state.typeIndex = 0; state.typeScore = 0;
  state.typeInput = ""; state.shiftActive = false; state.hintLevel = 0;
  document.querySelector(".app-header h1").textContent = `${cat.name} - タイピング`;
  showScreen("type-mode"); renderTypeQuestion();
}

function getHintText(word, level) {
  const en = word.en;
  if (level === 1) return `${en[0]} ${"_ ".repeat(en.length - 1).trim()}　（${en.length}文字）`;
  if (level === 2) { if (en.length <= 2) return en; return `${en[0]} ${"_ ".repeat(en.length - 2).trim()} ${en[en.length - 1]}　（${en.length}文字）`; }
  if (level === 3) { let h = ""; for (let i = 0; i < en.length; i++) h += (i === 0 || i === en.length - 1 || i % 2 === 0) ? en[i] + " " : "_ "; return h.trim() + `　（${en.length}文字）`; }
  return "";
}

function renderTypeQuestion() {
  const area = document.getElementById("type-mode");
  const word = state.typeWords[state.typeIndex];
  const total = state.typeWords.length;
  const pct = (state.typeIndex / total) * 100;
  state.typeInput = ""; state.hintLevel = 0;
  area.innerHTML = `<div class="type-area">
    <div class="quiz-progress"><span>${state.typeIndex + 1} / ${total}</span><div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div><span>⭕ ${state.typeScore}</span></div>
    <span class="type-emoji">${word.emoji}</span><div class="type-japanese">${word.ja}</div>
    <button class="quiz-speaker-btn" id="speak-btn-type">🔊</button>
    <div class="type-input-display" id="type-display"><span class="type-cursor"></span></div>
    <div class="type-hint-area" id="hint-area"><button class="type-hint-btn" id="hint-btn">ヒント① を見る</button></div></div>
    <div class="keyboard" id="keyboard"></div>`;
  document.getElementById("speak-btn-type").addEventListener("click", () => speakWord(word.en));
  setupHintButton();
  renderKeyboard(); updateTypeDisplay();
}

function setupHintButton() {
  const btn = document.getElementById("hint-btn");
  if (!btn) return;
  btn.addEventListener("click", function hintClick() {
    state.hintLevel++;
    const word = state.typeWords[state.typeIndex];
    const hintArea = document.getElementById("hint-area");
    const hintText = getHintText(word, state.hintLevel);
    let nextHtml = "";
    if (state.hintLevel < 3) {
      const lbl = state.hintLevel + 1;
      nextHtml = `<button class="type-hint-btn" id="hint-btn" style="margin-left:10px">ヒント${lbl === 2 ? "②" : "③"} を見る</button>`;
    }
    hintArea.innerHTML = `<span class="type-hint-text">${hintText}</span>${nextHtml}`;
    setupHintButton();
  });
}

function renderKeyboard() {
  const kb = document.getElementById("keyboard");
  const rows = [["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l"],["SHIFT","z","x","c","v","b","n","m","⌫"],["ENTER"]];
  kb.innerHTML = rows.map(row => `<div class="kb-row">${row.map(key => {
    if (key === "SHIFT") return `<div class="kb-key shift wide${state.shiftActive ? " active" : ""}" data-key="shift">⇧</div>`;
    if (key === "⌫") return `<div class="kb-key backspace wide" data-key="backspace">⌫</div>`;
    if (key === "ENTER") return `<div class="kb-key enter extra-wide" data-key="enter">けってい ✓</div>`;
    return `<div class="kb-key" data-key="${key}">${state.shiftActive ? key.toUpperCase() : key}</div>`;
  }).join("")}</div>`).join("");
  kb.querySelectorAll(".kb-key").forEach(k => k.addEventListener("click", () => handleKeyPress(k.dataset.key)));
}

function handleKeyPress(key) {
  if (key === "shift") { state.shiftActive = !state.shiftActive; renderKeyboard(); playSound("click"); return; }
  if (key === "backspace") { if (state.typeInput.length > 0) { state.typeInput = state.typeInput.slice(0, -1); playSound("click"); updateTypeDisplay(); } return; }
  if (key === "enter") { checkTypeAnswer(); return; }
  const char = state.shiftActive ? key.toUpperCase() : key;
  state.typeInput += char;
  if (state.shiftActive) { state.shiftActive = false; renderKeyboard(); }
  playSound("click"); updateTypeDisplay();
}

function updateTypeDisplay() {
  const display = document.getElementById("type-display"); if (!display) return;
  const word = state.typeWords[state.typeIndex];
  let html = "";
  for (let i = 0; i < state.typeInput.length; i++) {
    const ok = state.typeInput[i].toLowerCase() === (word.en[i] || "").toLowerCase();
    html += `<span class="char ${ok ? "correct" : "wrong"}">${state.typeInput[i]}</span>`;
  }
  display.innerHTML = html + '<span class="type-cursor"></span>';
}

function checkTypeAnswer() {
  const word = state.typeWords[state.typeIndex];
  if (state.typeInput.toLowerCase() === word.en.toLowerCase()) {
    state.typeScore++; playSound("correct"); speakWord(word.en); showFeedback(true); setTimeout(() => advanceType(), 1200);
  } else {
    playSound("wrong"); setTimeout(() => showWrongPopup(word, state.typeInput || "(なにもうってない)", () => advanceType()), 300);
  }
}

function advanceType() { state.typeIndex++; if (state.typeIndex < state.typeWords.length) renderTypeQuestion(); else showResult("type"); }

document.addEventListener("keydown", e => {
  if (state.currentScreen !== "type-mode" || document.querySelector(".popup-overlay")) return;
  if (e.key === "Backspace") { e.preventDefault(); handleKeyPress("backspace"); }
  else if (e.key === "Enter") { e.preventDefault(); handleKeyPress("enter"); }
  else if (e.key === "Shift") { state.shiftActive = !state.shiftActive; renderKeyboard(); }
  else if (/^[a-zA-Z]$/.test(e.key)) { state.typeInput += e.shiftKey ? e.key.toUpperCase() : e.key.toLowerCase(); playSound("click"); updateTypeDisplay(); }
});

// ===== REORDER MODE (並べ替え) =====
function startReorderMode(catKey) {
  const data = SENTENCE_DATA[catKey];
  if (!data) return;
  state.reorderSentences = shuffle(data.reorder);
  state.reorderIndex = 0; state.reorderScore = 0;
  document.querySelector(".app-header h1").textContent = `${WORD_DATA[catKey].name} - ならべかえ`;
  showScreen("reorder-mode"); renderReorderQuestion();
}

function renderReorderQuestion() {
  const area = document.getElementById("reorder-mode");
  const item = state.reorderSentences[state.reorderIndex];
  const total = state.reorderSentences.length;
  const pct = (state.reorderIndex / total) * 100;
  state.reorderPlaced = [];
  state.reorderBank = shuffle([...item.parts]);

  area.innerHTML = `<div class="reorder-area">
    <div class="quiz-progress"><span>${state.reorderIndex + 1} / ${total}</span><div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div><span>⭕ ${state.reorderScore}</span></div>
    <div class="reorder-instruction">ことばを正しい順番にタップしてならべよう！</div>
    <div class="reorder-answer-zone" id="answer-zone"><span class="placeholder-text">ここに文ができるよ</span></div>
    <div class="reorder-word-bank" id="word-bank"></div>
    <button class="reorder-check-btn" id="reorder-check" disabled>チェック ✓</button></div>`;

  renderWordBank();
  document.getElementById("reorder-check").addEventListener("click", checkReorder);
}

function renderWordBank() {
  const bankEl = document.getElementById("word-bank");
  const zoneEl = document.getElementById("answer-zone");
  const checkBtn = document.getElementById("reorder-check");

  // Render bank
  bankEl.innerHTML = state.reorderBank.map((w, i) => {
    const placed = state.reorderPlaced.includes(i);
    return `<div class="reorder-word${placed ? " placed" : ""}" data-idx="${i}" data-src="bank">${w}</div>`;
  }).join("");

  // Render answer zone
  if (state.reorderPlaced.length === 0) {
    zoneEl.innerHTML = '<span class="placeholder-text">ここに文ができるよ</span>';
    zoneEl.classList.remove("has-words");
  } else {
    zoneEl.innerHTML = state.reorderPlaced.map(idx => `<div class="reorder-word in-answer" data-idx="${idx}" data-src="answer">${state.reorderBank[idx]}</div>`).join("");
    zoneEl.classList.add("has-words");
  }

  checkBtn.disabled = state.reorderPlaced.length !== state.reorderBank.length;

  // Events: bank words
  bankEl.querySelectorAll(".reorder-word:not(.placed)").forEach(el => {
    el.addEventListener("click", () => {
      playSound("place");
      state.reorderPlaced.push(parseInt(el.dataset.idx));
      renderWordBank();
    });
  });

  // Events: answer words (tap to remove)
  zoneEl.querySelectorAll(".reorder-word.in-answer").forEach(el => {
    el.addEventListener("click", () => {
      playSound("click");
      const idx = parseInt(el.dataset.idx);
      state.reorderPlaced = state.reorderPlaced.filter(i => i !== idx);
      renderWordBank();
    });
  });
}

function checkReorder() {
  const item = state.reorderSentences[state.reorderIndex];
  const userAnswer = state.reorderPlaced.map(i => state.reorderBank[i]).join(" ");
  const isCorrect = userAnswer === item.answer;

  if (isCorrect) {
    state.reorderScore++; playSound("correct"); speakSentence(item.answer); showFeedback(true);
    setTimeout(() => advanceReorder(), 1200);
  } else {
    playSound("wrong");
    setTimeout(() => showWrongPopupSentence(item.answer, userAnswer, () => advanceReorder()), 400);
  }
}

function advanceReorder() { state.reorderIndex++; if (state.reorderIndex < state.reorderSentences.length) renderReorderQuestion(); else showResult("reorder"); }

// ===== CHOOSE SENTENCE MODE (絵から文を選ぶ) =====
function startChooseSentenceMode(catKey) {
  const data = SENTENCE_DATA[catKey];
  if (!data) return;
  state.csSentences = shuffle(data.choose);
  state.csIndex = 0; state.csScore = 0;
  document.querySelector(".app-header h1").textContent = `${WORD_DATA[catKey].name} - 絵から文`;
  showScreen("choose-sentence-mode"); renderCSQuestion();
}

function renderCSQuestion() {
  const area = document.getElementById("choose-sentence-mode");
  const item = state.csSentences[state.csIndex];
  const total = state.csSentences.length;
  const pct = (state.csIndex / total) * 100;
  const choices = shuffle([item.correct, ...item.wrongs]);

  area.innerHTML = `<div class="choose-sentence-area">
    <div class="quiz-progress"><span>${state.csIndex + 1} / ${total}</span><div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div><span>⭕ ${state.csScore}</span></div>
    <span class="cs-emoji">${item.emoji}</span>
    <div class="cs-japanese">${item.ja}</div>
    <div class="cs-choices">${choices.map(c => `<button class="cs-choice" data-text="${c}">${c}</button>`).join("")}</div></div>`;

  area.querySelectorAll(".cs-choice").forEach(btn => {
    btn.addEventListener("click", () => {
      const chosen = btn.dataset.text;
      const isCorrect = chosen === item.correct;
      area.querySelectorAll(".cs-choice").forEach(b => {
        b.style.pointerEvents = "none";
        if (b.dataset.text === item.correct) b.classList.add("correct");
        else if (b === btn && !isCorrect) b.classList.add("wrong");
      });
      if (isCorrect) { state.csScore++; playSound("correct"); speakSentence(item.correct); showFeedback(true); setTimeout(() => advanceCS(), 1200); }
      else { playSound("wrong"); setTimeout(() => showWrongPopupSentence(item.correct, chosen, () => advanceCS()), 400); }
    });
  });
}

function advanceCS() { state.csIndex++; if (state.csIndex < state.csSentences.length) renderCSQuestion(); else showResult("choose-sentence"); }

// ===== FILL BLANK MODE (穴埋め) =====
function startFillBlankMode(catKey) {
  const data = SENTENCE_DATA[catKey];
  if (!data) return;
  state.fbSentences = shuffle(data.fillblank);
  state.fbIndex = 0; state.fbScore = 0;
  document.querySelector(".app-header h1").textContent = `${WORD_DATA[catKey].name} - 穴うめ`;
  showScreen("fillblank-mode"); renderFBQuestion();
}

function renderFBQuestion() {
  const area = document.getElementById("fillblank-mode");
  const item = state.fbSentences[state.fbIndex];
  const total = state.fbSentences.length;
  const pct = (state.fbIndex / total) * 100;
  const choices = shuffle([...item.choices]);
  const sentenceHtml = item.sentence.replace("___", '<span class="fb-blank" id="fb-blank">___</span>');

  area.innerHTML = `<div class="fillblank-area">
    <div class="quiz-progress"><span>${state.fbIndex + 1} / ${total}</span><div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div><span>⭕ ${state.fbScore}</span></div>
    <div class="fb-sentence">${sentenceHtml}</div>
    <div class="fb-choices">${choices.map(c => `<button class="fb-choice" data-word="${c}">${c}</button>`).join("")}</div></div>`;

  area.querySelectorAll(".fb-choice").forEach(btn => {
    btn.addEventListener("click", () => {
      const chosen = btn.dataset.word;
      const isCorrect = chosen === item.answer;
      const blank = document.getElementById("fb-blank");
      blank.textContent = chosen;
      blank.classList.add("filled");
      area.querySelectorAll(".fb-choice").forEach(b => {
        b.style.pointerEvents = "none";
        if (b.dataset.word === item.answer) b.classList.add("correct");
        else if (b === btn && !isCorrect) b.classList.add("wrong");
      });
      if (isCorrect) {
        blank.classList.add("correct-fill");
        state.fbScore++; playSound("correct");
        const fullSentence = item.sentence.replace("___", item.answer);
        speakSentence(fullSentence);
        showFeedback(true); setTimeout(() => advanceFB(), 1200);
      } else {
        blank.classList.add("wrong-fill");
        playSound("wrong");
        const correctFull = item.sentence.replace("___", item.answer);
        const wrongFull = item.sentence.replace("___", chosen);
        setTimeout(() => showWrongPopupSentence(correctFull, wrongFull, () => advanceFB()), 400);
      }
    });
  });
}

function advanceFB() { state.fbIndex++; if (state.fbIndex < state.fbSentences.length) renderFBQuestion(); else showResult("fillblank"); }

// ===== RESULT SCREEN =====
function showResult(mode) {
  let score, total;
  const catKey = state.currentCategory;
  if (mode === "choose") { score = state.quizScore; total = state.quizWords.length; }
  else if (mode === "match") { const p = state.matchTotal; score = Math.max(0, Math.round((p / Math.max(state.matchAttempts, p)) * p)); total = p; }
  else if (mode === "type") { score = state.typeScore; total = state.typeWords.length; }
  else if (mode === "reorder") { score = state.reorderScore; total = state.reorderSentences.length; }
  else if (mode === "choose-sentence") { score = state.csScore; total = state.csSentences.length; }
  else if (mode === "fillblank") { score = state.fbScore; total = state.fbSentences.length; }

  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  saveProgress(catKey, mode, score, total);

  let emoji, title;
  if (pct >= 90) { emoji = "🎉"; title = "すごい！かんぺき！"; }
  else if (pct >= 70) { emoji = "😄"; title = "よくできたね！"; }
  else if (pct >= 50) { emoji = "😊"; title = "がんばったね！"; }
  else { emoji = "💪"; title = "もういちどチャレンジ！"; }

  const stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0;
  playSound("complete"); if (pct >= 70) showConfetti();

  const area = document.getElementById("result");
  area.innerHTML = `<div class="result-area">
    <span class="result-emoji">${emoji}</span><div class="result-title">${title}</div>
    <div class="result-score">${pct}%</div><div class="result-detail">${score} / ${total} もん正解</div>
    <div class="result-stars">${renderStars(stars)}</div>
    <div class="result-buttons">
      <button class="result-btn primary" id="retry-btn">もういちど ↻</button>
      <button class="result-btn secondary" id="mode-btn">モードをえらぶ</button>
      <button class="result-btn secondary" id="home-btn">ホームにもどる</button></div></div>`;
  showScreen("result");

  document.getElementById("retry-btn").addEventListener("click", () => {
    playSound("click");
    if (mode === "choose") startChooseMode(catKey);
    else if (mode === "match") startMatchMode(catKey);
    else if (mode === "type") startTypeMode(catKey);
    else if (mode === "reorder") startReorderMode(catKey);
    else if (mode === "choose-sentence") startChooseSentenceMode(catKey);
    else if (mode === "fillblank") startFillBlankMode(catKey);
  });
  document.getElementById("mode-btn").addEventListener("click", () => { playSound("click"); renderModeSelect(catKey); showScreen("mode-select"); });
  document.getElementById("home-btn").addEventListener("click", () => { playSound("click"); renderHome(); showScreen("home"); });
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  renderHome(); showScreen("home");
  document.querySelector(".back-btn").addEventListener("click", () => { playSound("click"); goBack(); if (state.currentScreen === "home") renderHome(); });
  document.querySelector(".sound-toggle").addEventListener("click", () => { state.soundEnabled = !state.soundEnabled; document.querySelector(".sound-toggle").textContent = state.soundEnabled ? "🔊" : "🔇"; });
});
