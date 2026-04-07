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
  hintShown: false,
  // Progress
  progress: JSON.parse(localStorage.getItem("eng5-progress") || "{}"),
};

// ===== SOUND =====
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playSound(type) {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.15;

    if (type === "correct") {
      osc.frequency.value = 523;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
      // Second tone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 659;
      osc2.type = "sine";
      gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc2.start(ctx.currentTime + 0.1);
      osc2.stop(ctx.currentTime + 0.4);
    } else if (type === "wrong") {
      osc.frequency.value = 200;
      osc.type = "sawtooth";
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === "click") {
      osc.frequency.value = 800;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === "flip") {
      osc.frequency.value = 600;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === "match") {
      osc.frequency.value = 440;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.connect(g2); g2.connect(ctx.destination);
      osc2.frequency.value = 660;
      g2.gain.setValueAtTime(0.12, ctx.currentTime + 0.1);
      g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc2.start(ctx.currentTime + 0.1);
      osc2.stop(ctx.currentTime + 0.3);
      const osc3 = ctx.createOscillator();
      const g3 = ctx.createGain();
      osc3.connect(g3); g3.connect(ctx.destination);
      osc3.frequency.value = 880;
      g3.gain.setValueAtTime(0.12, ctx.currentTime + 0.2);
      g3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc3.start(ctx.currentTime + 0.2);
      osc3.stop(ctx.currentTime + 0.45);
    } else if (type === "complete") {
      [523, 659, 784, 1047].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = freq;
        o.type = "sine";
        g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.4);
        o.start(ctx.currentTime + i * 0.12);
        o.stop(ctx.currentTime + i * 0.12 + 0.4);
      });
    }
  } catch (e) {
    // Audio not available
  }
}

function speakWord(word) {
  if ("speechSynthesis" in window) {
    const utter = new SpeechSynthesisUtterance(word);
    utter.lang = "en-US";
    utter.rate = 0.8;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  }
}

// ===== NAVIGATION =====
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
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
  if (state.currentScreen === "mode-select") {
    showScreen("home");
  } else if (["choose-mode", "match-mode", "type-mode"].includes(state.currentScreen)) {
    showScreen("mode-select");
  } else if (state.currentScreen === "result") {
    showScreen("mode-select");
  }
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
  let modes = 0;
  ["choose", "match", "type"].forEach((m) => {
    const key = `${catKey}_${m}`;
    if (state.progress[key] !== undefined) {
      totalPct += state.progress[key];
      modes++;
    }
  });
  if (modes === 0) return 0;
  const avg = totalPct / 3; // average across all 3 modes
  if (avg >= 90) return 3;
  if (avg >= 60) return 2;
  if (avg >= 30) return 1;
  return 0;
}

function renderStars(count) {
  return "★".repeat(count) + "☆".repeat(3 - count);
}

// ===== HOME SCREEN =====
function renderHome() {
  const grid = document.getElementById("category-grid");
  grid.innerHTML = "";
  Object.entries(WORD_DATA).forEach(([key, cat]) => {
    const stars = getCategoryStars(key);
    const card = document.createElement("div");
    card.className = "category-card";
    card.innerHTML = `
      <span class="icon">${cat.icon}</span>
      <div class="name">${cat.name}</div>
      <div class="word-count">${cat.words.length}もじ</div>
      <div class="stars">${renderStars(stars)}</div>
    `;
    card.addEventListener("click", () => {
      playSound("click");
      state.currentCategory = key;
      renderModeSelect(key);
      showScreen("mode-select");
    });
    grid.appendChild(card);
  });
}

// ===== MODE SELECT =====
function renderModeSelect(catKey) {
  const cat = WORD_DATA[catKey];
  const area = document.getElementById("mode-select");
  document.querySelector(".app-header h1").textContent = cat.name;
  area.innerHTML = `
    <div class="mode-header">
      <span class="cat-icon">${cat.icon}</span>
      <div class="cat-name">${cat.name}</div>
    </div>
    <div class="mode-cards">
      <div class="mode-card choose" data-mode="choose">
        <div class="mode-icon">🎯</div>
        <div class="mode-info">
          <h3>えらぶモード</h3>
          <p>4つの中から正しい英単語をえらぼう！</p>
        </div>
      </div>
      <div class="mode-card match" data-mode="match">
        <div class="mode-icon">🃏</div>
        <div class="mode-info">
          <h3>マッチングモード</h3>
          <p>英語と日本語のペアをさがそう！</p>
        </div>
      </div>
      <div class="mode-card type" data-mode="type">
        <div class="mode-icon">⌨️</div>
        <div class="mode-info">
          <h3>タイピングモード</h3>
          <p>英単語をキーボードで打ってみよう！</p>
        </div>
      </div>
    </div>
  `;
  area.querySelectorAll(".mode-card").forEach((card) => {
    card.addEventListener("click", () => {
      playSound("click");
      const mode = card.dataset.mode;
      state.currentMode = mode;
      if (mode === "choose") startChooseMode(catKey);
      else if (mode === "match") startMatchMode(catKey);
      else if (mode === "type") startTypeMode(catKey);
    });
  });
}

// ===== SHUFFLE HELPER =====
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== FEEDBACK =====
function showFeedback(isCorrect) {
  const overlay = document.getElementById("feedback-overlay");
  const text = overlay.querySelector(".feedback-text");
  text.textContent = isCorrect ? "⭕" : "❌";
  text.className = "feedback-text " + (isCorrect ? "correct" : "wrong");
  overlay.classList.add("show");
  setTimeout(() => overlay.classList.remove("show"), 600);
}

// ===== CONFETTI =====
function showConfetti() {
  const container = document.getElementById("confetti-container");
  const colors = ["#FF6B35", "#4ECDC4", "#FFE66D", "#FF6B6B", "#7C83FD", "#A8E6CF"];
  for (let i = 0; i < 50; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "%";
    c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    c.style.width = (Math.random() * 8 + 6) + "px";
    c.style.height = (Math.random() * 8 + 6) + "px";
    c.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    c.style.animationDuration = (Math.random() * 1.5 + 1) + "s";
    c.style.animationDelay = (Math.random() * 0.5) + "s";
    container.appendChild(c);
  }
  setTimeout(() => (container.innerHTML = ""), 3000);
}

// ===== CHOOSE MODE =====
function startChooseMode(catKey) {
  const cat = WORD_DATA[catKey];
  state.quizWords = shuffle(cat.words);
  state.quizIndex = 0;
  state.quizScore = 0;
  document.querySelector(".app-header h1").textContent = `${cat.name} - えらぶ`;
  showScreen("choose-mode");
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const area = document.getElementById("choose-mode");
  const word = state.quizWords[state.quizIndex];
  const total = state.quizWords.length;
  const progressPct = (state.quizIndex / total) * 100;

  // Get 3 wrong choices from all categories
  const allWords = Object.values(WORD_DATA).flatMap((c) => c.words);
  const wrongs = shuffle(allWords.filter((w) => w.en !== word.en)).slice(0, 3);
  const choices = shuffle([word, ...wrongs]);

  area.innerHTML = `
    <div class="quiz-area">
      <div class="quiz-progress">
        <span>${state.quizIndex + 1} / ${total}</span>
        <div class="quiz-progress-bar">
          <div class="quiz-progress-fill" style="width:${progressPct}%"></div>
        </div>
        <span>⭕ ${state.quizScore}</span>
      </div>
      <span class="quiz-emoji">${word.emoji}</span>
      <div class="quiz-japanese">${word.ja}</div>
      <button class="quiz-speaker-btn" id="speak-btn">🔊</button>
      <div class="quiz-hint">えいごでなんて言う？</div>
      <div class="quiz-choices">
        ${choices.map((c) => `<button class="quiz-choice" data-word="${c.en}">${c.en}</button>`).join("")}
      </div>
    </div>
  `;

  document.getElementById("speak-btn").addEventListener("click", () => speakWord(word.en));

  area.querySelectorAll(".quiz-choice").forEach((btn) => {
    btn.addEventListener("click", () => handleQuizAnswer(btn, word.en));
  });
}

function handleQuizAnswer(btn, correct) {
  const chosen = btn.dataset.word;
  const isCorrect = chosen === correct;
  const allBtns = document.querySelectorAll(".quiz-choice");

  allBtns.forEach((b) => {
    b.style.pointerEvents = "none";
    if (b.dataset.word === correct) b.classList.add("correct");
    else if (b === btn && !isCorrect) b.classList.add("wrong");
  });

  if (isCorrect) {
    state.quizScore++;
    playSound("correct");
    speakWord(correct);
  } else {
    playSound("wrong");
  }

  showFeedback(isCorrect);

  setTimeout(() => {
    state.quizIndex++;
    if (state.quizIndex < state.quizWords.length) {
      renderQuizQuestion();
    } else {
      showResult("choose");
    }
  }, 1200);
}

// ===== MATCH MODE =====
function startMatchMode(catKey) {
  const cat = WORD_DATA[catKey];
  // Pick 6 words for 12 cards (3x4 grid)
  const selected = shuffle(cat.words).slice(0, 6);
  state.matchTotal = selected.length;
  state.matchMatched = 0;
  state.matchAttempts = 0;
  state.matchFlipped = [];
  state.matchLocked = false;

  // Create card pairs
  const cards = [];
  selected.forEach((w, i) => {
    cards.push({ id: `en-${i}`, pairId: i, type: "en", text: w.en, emoji: w.emoji, word: w });
    cards.push({ id: `ja-${i}`, pairId: i, type: "ja", text: w.ja, emoji: w.emoji, word: w });
  });
  state.matchCards = shuffle(cards);

  document.querySelector(".app-header h1").textContent = `${cat.name} - マッチング`;
  showScreen("match-mode");
  renderMatchGrid();
}

function renderMatchGrid() {
  const area = document.getElementById("match-mode");
  area.innerHTML = `
    <div class="match-area">
      <div class="match-stats">
        <span>ペア: ${state.matchMatched} / ${state.matchTotal}</span>
        <span>トライ: ${state.matchAttempts}</span>
      </div>
      <div class="match-grid">
        ${state.matchCards
          .map(
            (c) => `
          <div class="match-card" data-id="${c.id}" data-pair="${c.pairId}" data-type="${c.type}">
            <span class="card-back">❓</span>
            <div class="card-front">
              <span class="card-emoji">${c.emoji}</span>
              <span>${c.text}</span>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;

  area.querySelectorAll(".match-card").forEach((card) => {
    card.addEventListener("click", () => handleMatchClick(card));
  });
}

function handleMatchClick(cardEl) {
  if (state.matchLocked) return;
  if (cardEl.classList.contains("flipped") || cardEl.classList.contains("matched")) return;

  playSound("flip");
  cardEl.classList.add("flipped");
  cardEl.classList.add(cardEl.dataset.type === "en" ? "en-card" : "ja-card");
  state.matchFlipped.push(cardEl);

  if (state.matchFlipped.length === 2) {
    state.matchAttempts++;
    state.matchLocked = true;
    const [a, b] = state.matchFlipped;

    if (a.dataset.pair === b.dataset.pair && a.dataset.type !== b.dataset.type) {
      // Match!
      setTimeout(() => {
        a.classList.add("matched");
        b.classList.add("matched");
        state.matchMatched++;
        playSound("match");

        // Speak the English word
        const word = state.matchCards.find((c) => c.id === a.dataset.id);
        if (word) speakWord(word.word.en);

        // Update stats
        document.querySelector(".match-stats").innerHTML = `
          <span>ペア: ${state.matchMatched} / ${state.matchTotal}</span>
          <span>トライ: ${state.matchAttempts}</span>
        `;

        state.matchFlipped = [];
        state.matchLocked = false;

        if (state.matchMatched === state.matchTotal) {
          setTimeout(() => showResult("match"), 600);
        }
      }, 400);
    } else {
      // No match
      setTimeout(() => {
        a.classList.remove("flipped", "en-card", "ja-card");
        b.classList.remove("flipped", "en-card", "ja-card");
        state.matchFlipped = [];
        state.matchLocked = false;
      }, 800);
    }
  }
}

// ===== TYPE MODE =====
function startTypeMode(catKey) {
  const cat = WORD_DATA[catKey];
  state.typeWords = shuffle(cat.words);
  state.typeIndex = 0;
  state.typeScore = 0;
  state.typeInput = "";
  state.shiftActive = false;
  state.hintShown = false;
  document.querySelector(".app-header h1").textContent = `${cat.name} - タイピング`;
  showScreen("type-mode");
  renderTypeQuestion();
}

function renderTypeQuestion() {
  const area = document.getElementById("type-mode");
  const word = state.typeWords[state.typeIndex];
  const total = state.typeWords.length;
  const progressPct = (state.typeIndex / total) * 100;
  state.typeInput = "";
  state.hintShown = false;

  area.innerHTML = `
    <div class="type-area">
      <div class="quiz-progress">
        <span>${state.typeIndex + 1} / ${total}</span>
        <div class="quiz-progress-bar">
          <div class="quiz-progress-fill" style="width:${progressPct}%"></div>
        </div>
        <span>⭕ ${state.typeScore}</span>
      </div>
      <span class="type-emoji">${word.emoji}</span>
      <div class="type-japanese">${word.ja}</div>
      <button class="quiz-speaker-btn" id="speak-btn-type">🔊</button>
      <div class="type-input-display" id="type-display"><span class="type-cursor"></span></div>
      <div class="type-hint-area">
        <button class="type-hint-btn" id="hint-btn">ヒントを見る</button>
      </div>
    </div>
    <div class="keyboard" id="keyboard"></div>
  `;

  document.getElementById("speak-btn-type").addEventListener("click", () => speakWord(word.en));
  document.getElementById("hint-btn").addEventListener("click", () => {
    state.hintShown = true;
    const hintArea = document.querySelector(".type-hint-area");
    // Show first letter and underscores
    const hint = word.en[0] + " " + word.en.slice(1).replace(/./g, "_ ").trim();
    hintArea.innerHTML = `<span class="type-hint-text">${hint}</span>`;
  });

  renderKeyboard();
  updateTypeDisplay();
}

function renderKeyboard() {
  const kb = document.getElementById("keyboard");
  const rows = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["SHIFT", "z", "x", "c", "v", "b", "n", "m", "⌫"],
    ["ENTER"],
  ];

  kb.innerHTML = rows
    .map(
      (row) => `
    <div class="kb-row">
      ${row
        .map((key) => {
          if (key === "SHIFT") return `<div class="kb-key shift wide" data-key="shift">⇧</div>`;
          if (key === "⌫") return `<div class="kb-key backspace wide" data-key="backspace">⌫</div>`;
          if (key === "ENTER") return `<div class="kb-key enter extra-wide" data-key="enter">けってい ✓</div>`;
          const display = state.shiftActive ? key.toUpperCase() : key;
          return `<div class="kb-key" data-key="${key}">${display}</div>`;
        })
        .join("")}
    </div>
  `
    )
    .join("");

  // Update shift button state
  const shiftBtn = kb.querySelector('[data-key="shift"]');
  if (state.shiftActive) shiftBtn.classList.add("active");

  kb.querySelectorAll(".kb-key").forEach((key) => {
    key.addEventListener("click", () => handleKeyPress(key.dataset.key));
  });
}

function handleKeyPress(key) {
  if (key === "shift") {
    state.shiftActive = !state.shiftActive;
    renderKeyboard();
    playSound("click");
    return;
  }

  if (key === "backspace") {
    if (state.typeInput.length > 0) {
      state.typeInput = state.typeInput.slice(0, -1);
      playSound("click");
      updateTypeDisplay();
    }
    return;
  }

  if (key === "enter") {
    checkTypeAnswer();
    return;
  }

  // Letter key
  const char = state.shiftActive ? key.toUpperCase() : key;
  state.typeInput += char;
  if (state.shiftActive) {
    state.shiftActive = false;
    renderKeyboard();
  }
  playSound("click");
  updateTypeDisplay();
}

function updateTypeDisplay() {
  const display = document.getElementById("type-display");
  if (!display) return;
  const word = state.typeWords[state.typeIndex];
  const target = word.en;
  let html = "";
  for (let i = 0; i < state.typeInput.length; i++) {
    const isCorrect = state.typeInput[i].toLowerCase() === (target[i] || "").toLowerCase();
    html += `<span class="char ${isCorrect ? "correct" : "wrong"}">${state.typeInput[i]}</span>`;
  }
  html += '<span class="type-cursor"></span>';
  display.innerHTML = html;
}

function checkTypeAnswer() {
  const word = state.typeWords[state.typeIndex];
  const isCorrect = state.typeInput.toLowerCase() === word.en.toLowerCase();

  if (isCorrect) {
    state.typeScore++;
    playSound("correct");
    speakWord(word.en);
    showFeedback(true);
  } else {
    playSound("wrong");
    showFeedback(false);
    // Show correct answer briefly
    const display = document.getElementById("type-display");
    display.innerHTML = `<span style="color:#DC3545;text-decoration:line-through">${state.typeInput || "　"}</span>
      <span style="margin-left:12px;color:#28A745">${word.en}</span>`;
  }

  setTimeout(() => {
    state.typeIndex++;
    if (state.typeIndex < state.typeWords.length) {
      renderTypeQuestion();
    } else {
      showResult("type");
    }
  }, 1500);
}

// Physical keyboard support
document.addEventListener("keydown", (e) => {
  if (state.currentScreen !== "type-mode") return;
  if (e.key === "Backspace") {
    e.preventDefault();
    handleKeyPress("backspace");
  } else if (e.key === "Enter") {
    e.preventDefault();
    handleKeyPress("enter");
  } else if (e.key === "Shift") {
    state.shiftActive = !state.shiftActive;
    renderKeyboard();
  } else if (/^[a-zA-Z]$/.test(e.key)) {
    const char = e.shiftKey ? e.key.toUpperCase() : e.key.toLowerCase();
    state.typeInput += char;
    playSound("click");
    updateTypeDisplay();
  }
});

// ===== RESULT SCREEN =====
function showResult(mode) {
  let score, total, pct;
  const catKey = state.currentCategory;

  if (mode === "choose") {
    score = state.quizScore;
    total = state.quizWords.length;
  } else if (mode === "match") {
    // Score based on efficiency
    const perfect = state.matchTotal;
    const attempts = state.matchAttempts;
    score = Math.max(0, Math.round((perfect / Math.max(attempts, perfect)) * perfect));
    total = perfect;
  } else if (mode === "type") {
    score = state.typeScore;
    total = state.typeWords.length;
  }

  pct = total > 0 ? Math.round((score / total) * 100) : 0;
  saveProgress(catKey, mode, score, total);

  let emoji, title;
  if (pct >= 90) { emoji = "🎉"; title = "すごい！かんぺき！"; }
  else if (pct >= 70) { emoji = "😄"; title = "よくできたね！"; }
  else if (pct >= 50) { emoji = "😊"; title = "がんばったね！"; }
  else { emoji = "💪"; title = "もういちどチャレンジ！"; }

  const stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0;

  playSound("complete");
  if (pct >= 70) showConfetti();

  const area = document.getElementById("result");
  area.innerHTML = `
    <div class="result-area">
      <span class="result-emoji">${emoji}</span>
      <div class="result-title">${title}</div>
      <div class="result-score">${pct}%</div>
      <div class="result-detail">${score} / ${total} もん正解</div>
      <div class="result-stars">${renderStars(stars)}</div>
      <div class="result-buttons">
        <button class="result-btn primary" id="retry-btn">もういちど ↻</button>
        <button class="result-btn secondary" id="mode-btn">モードをえらぶ</button>
        <button class="result-btn secondary" id="home-btn">ホームにもどる</button>
      </div>
    </div>
  `;

  showScreen("result");

  document.getElementById("retry-btn").addEventListener("click", () => {
    playSound("click");
    if (mode === "choose") startChooseMode(catKey);
    else if (mode === "match") startMatchMode(catKey);
    else if (mode === "type") startTypeMode(catKey);
  });
  document.getElementById("mode-btn").addEventListener("click", () => {
    playSound("click");
    renderModeSelect(catKey);
    showScreen("mode-select");
  });
  document.getElementById("home-btn").addEventListener("click", () => {
    playSound("click");
    renderHome();
    showScreen("home");
  });
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  renderHome();
  showScreen("home");

  document.querySelector(".back-btn").addEventListener("click", () => {
    playSound("click");
    goBack();
    if (state.currentScreen === "home") renderHome();
  });

  document.querySelector(".sound-toggle").addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    document.querySelector(".sound-toggle").textContent = state.soundEnabled ? "🔊" : "🔇";
  });
});
