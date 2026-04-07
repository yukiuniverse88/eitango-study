// ===== APP STATE =====
const state = {
  currentScreen: "home",
  currentCategory: null,
  currentMode: null,
  soundEnabled: true,
  quizWords: [], quizIndex: 0, quizScore: 0,
  matchCards: [], matchFlipped: [], matchMatched: 0, matchTotal: 0, matchAttempts: 0, matchLocked: false,
  typeWords: [], typeIndex: 0, typeInput: "", typeScore: 0, shiftActive: false, hintLevel: 0,
  reorderSentences: [], reorderIndex: 0, reorderScore: 0, reorderPlaced: [], reorderBank: [],
  csSentences: [], csIndex: 0, csScore: 0,
  fbSentences: [], fbIndex: 0, fbScore: 0,
  progress: JSON.parse(localStorage.getItem("eng5-progress") || "{}"),
};

// ===== SOUND (WAV生成 + HTMLAudio方式 - 全デバイス対応) =====
function writeStr(v, o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }

function genWav(sr, samples) {
  const n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  writeStr(v, 0, "RIFF"); v.setUint32(4, 36 + n * 2, true); writeStr(v, 8, "WAVE");
  writeStr(v, 12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  writeStr(v, 36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7FFF, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

function tone(freq, dur, vol, saw) {
  const sr = 22050, len = Math.floor(sr * dur), s = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const w = saw ? 2 * (t * freq - Math.floor(0.5 + t * freq)) : Math.sin(2 * Math.PI * freq * t);
    s[i] = w * vol * Math.max(0, 1 - t / dur);
  }
  return s;
}

function merge(sr, parts) {
  let len = 0;
  for (const p of parts) len = Math.max(len, Math.floor(sr * p.d) + p.s.length);
  const out = new Float32Array(len);
  for (const p of parts) { const off = Math.floor(sr * p.d); for (let i = 0; i < p.s.length; i++) out[off + i] += p.s[i]; }
  return out;
}

const SR = 22050;
const SND = {};
SND.correct = genWav(SR, merge(SR, [{ d: 0, s: tone(523, 0.25, 0.25) }, { d: 0.1, s: tone(659, 0.3, 0.25) }]));
SND.wrong = genWav(SR, tone(200, 0.3, 0.18, true));
SND.click = genWav(SR, tone(800, 0.06, 0.15));
SND.flip = genWav(SR, tone(600, 0.08, 0.15));
SND.place = genWav(SR, tone(500, 0.1, 0.15));
SND.match = genWav(SR, merge(SR, [{ d: 0, s: tone(440, 0.15, 0.18) }, { d: 0.1, s: tone(660, 0.15, 0.18) }, { d: 0.2, s: tone(880, 0.25, 0.18) }]));
SND.complete = genWav(SR, merge(SR, [{ d: 0, s: tone(523, 0.35, 0.18) }, { d: 0.12, s: tone(659, 0.35, 0.18) }, { d: 0.24, s: tone(784, 0.35, 0.18) }, { d: 0.36, s: tone(1047, 0.5, 0.18) }]));

function playSound(type) {
  if (!state.soundEnabled || !SND[type]) return;
  try {
    const a = new Audio(SND[type]);
    a.volume = 1.0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

// === 発音: SpeechSynthesis優先 → ダメならローカルMP3に自動切替 ===
// speechWorks: null=未判定, true=使える(iPhone/PC), false=使えない(Fireタブレット)
let speechWorks = null;

function speak(text) {
  if (!state.soundEnabled) return;

  // 既にSpeechSynthesisが使えないと判明 → ローカルMP3
  if (speechWorks === false) {
    speakLocal(text);
    return;
  }

  // SpeechSynthesisが使えると判明 → SpeechSynthesis
  if (speechWorks === true) {
    speakBrowser(text);
    return;
  }

  // まだ未判定 → SpeechSynthesisを試して判定
  if (!("speechSynthesis" in window)) {
    speechWorks = false;
    speakLocal(text);
    return;
  }

  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.8;

    let resolved = false;

    // 発話が始まったら → SpeechSynthesis使える！
    u.onstart = () => {
      if (!resolved) { resolved = true; speechWorks = true; }
    };
    u.onend = () => {
      if (!resolved) { resolved = true; speechWorks = true; }
    };
    u.onerror = () => {
      if (!resolved) { resolved = true; speechWorks = false; speakLocal(text); }
    };

    speechSynthesis.speak(u);

    // 500ms経っても始まらなかったら → 使えないと判定してMP3へ
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        speechWorks = false;
        speechSynthesis.cancel();
        speakLocal(text);
      }
    }, 500);
  } catch (e) {
    speechWorks = false;
    speakLocal(text);
  }
}

function speakBrowser(text) {
  if (!("speechSynthesis" in window)) { speakLocal(text); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = 0.8;
    speechSynthesis.speak(u);
  } catch (e) { speakLocal(text); }
}

function speakLocal(text) {
  const key = text.toLowerCase();
  const file = (typeof AUDIO_MAP !== "undefined") ? AUDIO_MAP[key] : null;
  if (!file) return;
  try {
    const a = new Audio(file);
    a.volume = 1.0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

function speakWord(word) { speak(word); }
function speakSentence(text) { speak(text); }

// タッチでAudio解禁
let _aUnlock = false;
function _unlock() {
  if (_aUnlock) return; _aUnlock = true;
  try { const a = new Audio(SND.click); a.volume = 0.01; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}
["touchstart", "touchend", "click"].forEach(e => document.addEventListener(e, _unlock, { passive: true }));

// ===== NAVIGATION =====
const ALL_MODES = ["choose-mode", "match-mode", "type-mode", "reorder-mode", "choose-sentence-mode", "fillblank-mode"];

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  state.currentScreen = id;
  const bb = document.querySelector(".back-btn");
  if (id === "home") { bb.classList.remove("visible"); document.querySelector(".app-header h1").textContent = "English Words 5"; }
  else bb.classList.add("visible");
}

function goBack() {
  if (state.currentScreen === "mode-select") showScreen("home");
  else if (ALL_MODES.includes(state.currentScreen)) showScreen("mode-select");
  else if (state.currentScreen === "result") showScreen("mode-select");
}

// ===== PROGRESS =====
function saveProgress(cat, mode, score, total) {
  const k = `${cat}_${mode}`, pct = total > 0 ? Math.round((score / total) * 100) : 0;
  if (!state.progress[k] || pct > state.progress[k]) { state.progress[k] = pct; localStorage.setItem("eng5-progress", JSON.stringify(state.progress)); }
}

function getCategoryStars(catKey) {
  let tot = 0;
  const ms = ["choose", "match", "type", "reorder", "choose-sentence", "fillblank"];
  ms.forEach(m => { const k = `${catKey}_${m}`; if (state.progress[k] !== undefined) tot += state.progress[k]; });
  const avg = tot / ms.length;
  return avg >= 90 ? 3 : avg >= 60 ? 2 : avg >= 30 ? 1 : 0;
}

function renderStars(n) { return "★".repeat(n) + "☆".repeat(3 - n); }

// ===== HELPERS =====
function shuffle(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function showFeedback(ok) {
  if (!ok) return;
  const o = document.getElementById("feedback-overlay"), t = o.querySelector(".feedback-text");
  t.textContent = "⭕"; t.className = "feedback-text correct";
  o.classList.add("show"); setTimeout(() => o.classList.remove("show"), 600);
}

function showWrongPopup(word, chosen, onClose) {
  const ex = document.querySelector(".popup-overlay"); if (ex) ex.remove();
  const p = document.createElement("div"); p.className = "popup-overlay";
  p.innerHTML = `<div class="popup-card"><div class="popup-label">❌ ざんねん！</div><span class="popup-emoji">${word.emoji}</span><div class="popup-ja">${word.ja}</div>${chosen ? `<div class="popup-wrong">${chosen}</div>` : ""}<div class="popup-correct-word">${word.en}</div><button class="popup-speak-btn" id="popup-speak">🔊</button><div class="popup-tip"><div class="popup-tip-label">💡 こうやって覚えよう！</div><div class="popup-tip-text">${word.tip || ""}</div></div><button class="popup-close-btn" id="popup-close">とじる</button></div>`;
  document.body.appendChild(p);
  document.getElementById("popup-speak").addEventListener("click", () => speakWord(word.en));
  document.getElementById("popup-close").addEventListener("click", () => { p.remove(); if (onClose) onClose(); });
}

function showWrongPopupSentence(correct, chosen, onClose) {
  const ex = document.querySelector(".popup-overlay"); if (ex) ex.remove();
  const p = document.createElement("div"); p.className = "popup-overlay";
  p.innerHTML = `<div class="popup-card"><div class="popup-label">❌ ざんねん！</div>${chosen ? `<div class="popup-wrong" style="font-size:14px">${chosen}</div>` : ""}<div class="popup-correct-word" style="font-size:24px;letter-spacing:0">${correct}</div><button class="popup-speak-btn" id="popup-speak">🔊</button><div class="popup-tip"><div class="popup-tip-label">💡 正しい文はこれ！</div><div class="popup-tip-text">声に出して読んでみよう！<br>「${correct}」</div></div><button class="popup-close-btn" id="popup-close">とじる</button></div>`;
  document.body.appendChild(p);
  document.getElementById("popup-speak").addEventListener("click", () => speakSentence(correct));
  document.getElementById("popup-close").addEventListener("click", () => { p.remove(); if (onClose) onClose(); });
}

function showConfetti() {
  const c = document.getElementById("confetti-container"), cols = ["#FF6B35", "#4ECDC4", "#FFE66D", "#FF6B6B", "#7C83FD", "#A8E6CF"];
  for (let i = 0; i < 50; i++) {
    const d = document.createElement("div"); d.className = "confetti";
    d.style.left = Math.random() * 100 + "%"; d.style.backgroundColor = cols[Math.floor(Math.random() * cols.length)];
    d.style.width = (Math.random() * 8 + 6) + "px"; d.style.height = (Math.random() * 8 + 6) + "px";
    d.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    d.style.animationDuration = (Math.random() * 1.5 + 1) + "s"; d.style.animationDelay = (Math.random() * 0.5) + "s";
    c.appendChild(d);
  }
  setTimeout(() => c.innerHTML = "", 3000);
}

// ===== HOME =====
function renderHome() {
  const g = document.getElementById("category-grid"); g.innerHTML = "";
  Object.entries(WORD_DATA).forEach(([k, cat]) => {
    const s = getCategoryStars(k), d = document.createElement("div"); d.className = "category-card";
    d.innerHTML = `<span class="icon">${cat.icon}</span><div class="name">${cat.name}</div><div class="word-count">${cat.words.length}もじ</div><div class="stars">${renderStars(s)}</div>`;
    d.addEventListener("click", () => { playSound("click"); state.currentCategory = k; renderModeSelect(k); showScreen("mode-select"); });
    g.appendChild(d);
  });
}

// ===== MODE SELECT =====
function renderModeSelect(ck) {
  const cat = WORD_DATA[ck], hasSent = SENTENCE_DATA && SENTENCE_DATA[ck], area = document.getElementById("mode-select");
  document.querySelector(".app-header h1").textContent = cat.name;
  let sentHtml = "";
  if (hasSent) {
    sentHtml = `<div class="mode-section-title"><span class="section-icon">✏️</span> 文をつくる</div><div class="mode-cards">
      <div class="mode-card choose" data-mode="reorder"><div class="mode-icon">🔀</div><div class="mode-info"><h3>ならべかえ</h3><p>ことばを正しい順番にならべよう！</p></div></div>
      <div class="mode-card match" data-mode="choose-sentence"><div class="mode-icon">🖼️</div><div class="mode-info"><h3>絵から文をえらぶ</h3><p>絵に合う英語の文をえらぼう！</p></div></div>
      <div class="mode-card type" data-mode="fillblank"><div class="mode-icon">✍️</div><div class="mode-info"><h3>穴うめ</h3><p>（　）に入る単語をえらぼう！</p></div></div></div>`;
  }
  area.innerHTML = `<div class="mode-header"><span class="cat-icon">${cat.icon}</span><div class="cat-name">${cat.name}</div></div>
    <div class="mode-section-title"><span class="section-icon">🔤</span> 単語をおぼえる</div><div class="mode-cards">
    <div class="mode-card choose" data-mode="choose"><div class="mode-icon">🎯</div><div class="mode-info"><h3>えらぶモード</h3><p>4つの中から正しい英単語をえらぼう！</p></div></div>
    <div class="mode-card match" data-mode="match"><div class="mode-icon">🃏</div><div class="mode-info"><h3>マッチングモード</h3><p>英語と日本語のペアをさがそう！</p></div></div>
    <div class="mode-card type" data-mode="type"><div class="mode-icon">⌨️</div><div class="mode-info"><h3>タイピングモード</h3><p>英単語をキーボードで打ってみよう！</p></div></div></div>${sentHtml}`;
  area.querySelectorAll(".mode-card").forEach(c => {
    c.addEventListener("click", () => {
      playSound("click"); const m = c.dataset.mode; state.currentMode = m;
      if (m === "choose") startChooseMode(ck); else if (m === "match") startMatchMode(ck);
      else if (m === "type") startTypeMode(ck); else if (m === "reorder") startReorderMode(ck);
      else if (m === "choose-sentence") startChooseSentenceMode(ck); else if (m === "fillblank") startFillBlankMode(ck);
    });
  });
}

// ===== CHOOSE MODE =====
function startChooseMode(ck) {
  state.quizWords = shuffle(WORD_DATA[ck].words); state.quizIndex = 0; state.quizScore = 0;
  document.querySelector(".app-header h1").textContent = `${WORD_DATA[ck].name} - えらぶ`;
  showScreen("choose-mode"); renderQuizQ();
}

function renderQuizQ() {
  const a = document.getElementById("choose-mode"), w = state.quizWords[state.quizIndex], t = state.quizWords.length, pct = (state.quizIndex / t) * 100;
  const conf = w.confusables ? shuffle(w.confusables).slice(0, 2) : [];
  const allW = Object.values(WORD_DATA).flatMap(c => c.words);
  const real = shuffle(allW.filter(x => x.en !== w.en)).slice(0, 3 - conf.length);
  const wrongs = [...conf.map(c => ({ en: c })), ...real.map(x => ({ en: x.en }))].slice(0, 3);
  const ch = shuffle([{ en: w.en }, ...wrongs]);
  a.innerHTML = `<div class="quiz-area"><div class="quiz-progress"><span>${state.quizIndex + 1} / ${t}</span><div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div><span>⭕ ${state.quizScore}</span></div>
    <span class="quiz-emoji">${w.emoji}</span><div class="quiz-japanese">${w.ja}</div><button class="quiz-speaker-btn" id="speak-btn">🔊</button>
    <div class="quiz-hint">えいごでなんて言う？</div><div class="quiz-choices">${ch.map(c => `<button class="quiz-choice" data-word="${c.en}">${c.en}</button>`).join("")}</div></div>`;
  document.getElementById("speak-btn").addEventListener("click", () => speakWord(w.en));
  a.querySelectorAll(".quiz-choice").forEach(b => b.addEventListener("click", () => {
    const chosen = b.dataset.word, ok = chosen === w.en;
    document.querySelectorAll(".quiz-choice").forEach(x => { x.style.pointerEvents = "none"; if (x.dataset.word === w.en) x.classList.add("correct"); else if (x === b && !ok) x.classList.add("wrong"); });
    if (ok) { state.quizScore++; playSound("correct"); speakWord(w.en); showFeedback(true); setTimeout(() => advQuiz(), 1200); }
    else { playSound("wrong"); setTimeout(() => showWrongPopup(w, chosen, () => advQuiz()), 400); }
  }));
}
function advQuiz() { state.quizIndex++; if (state.quizIndex < state.quizWords.length) renderQuizQ(); else showResult("choose"); }

// ===== MATCH MODE =====
function startMatchMode(ck) {
  const sel = shuffle(WORD_DATA[ck].words).slice(0, 6);
  state.matchTotal = sel.length; state.matchMatched = 0; state.matchAttempts = 0; state.matchFlipped = []; state.matchLocked = false;
  const cards = []; sel.forEach((w, i) => { cards.push({ id: `en-${i}`, pId: i, type: "en", text: w.en, emoji: w.emoji, word: w }); cards.push({ id: `ja-${i}`, pId: i, type: "ja", text: w.ja, emoji: w.emoji, word: w }); });
  state.matchCards = shuffle(cards);
  document.querySelector(".app-header h1").textContent = `${WORD_DATA[ck].name} - マッチング`;
  showScreen("match-mode"); renderMatchGrid();
}

function renderMatchGrid() {
  const a = document.getElementById("match-mode");
  a.innerHTML = `<div class="match-area"><div class="match-stats"><span>ペア: ${state.matchMatched} / ${state.matchTotal}</span><span>トライ: ${state.matchAttempts}</span></div>
    <div class="match-grid">${state.matchCards.map(c => `<div class="match-card" data-id="${c.id}" data-pair="${c.pId}" data-type="${c.type}"><span class="card-back">❓</span><div class="card-front"><span class="card-emoji">${c.emoji}</span><span>${c.text}</span></div></div>`).join("")}</div></div>`;
  a.querySelectorAll(".match-card").forEach(c => c.addEventListener("click", () => {
    if (state.matchLocked || c.classList.contains("flipped") || c.classList.contains("matched")) return;
    playSound("flip"); c.classList.add("flipped", c.dataset.type === "en" ? "en-card" : "ja-card");
    state.matchFlipped.push(c);
    if (state.matchFlipped.length === 2) {
      state.matchAttempts++; state.matchLocked = true;
      const [x, y] = state.matchFlipped;
      if (x.dataset.pair === y.dataset.pair && x.dataset.type !== y.dataset.type) {
        setTimeout(() => { x.classList.add("matched"); y.classList.add("matched"); state.matchMatched++; playSound("match");
          const w = state.matchCards.find(c => c.id === x.dataset.id); if (w) speakWord(w.word.en);
          document.querySelector(".match-stats").innerHTML = `<span>ペア: ${state.matchMatched} / ${state.matchTotal}</span><span>トライ: ${state.matchAttempts}</span>`;
          state.matchFlipped = []; state.matchLocked = false;
          if (state.matchMatched === state.matchTotal) setTimeout(() => showResult("match"), 600);
        }, 400);
      } else { setTimeout(() => { x.classList.remove("flipped", "en-card", "ja-card"); y.classList.remove("flipped", "en-card", "ja-card"); state.matchFlipped = []; state.matchLocked = false; }, 800); }
    }
  }));
}

// ===== TYPE MODE =====
function startTypeMode(ck) {
  state.typeWords = shuffle(WORD_DATA[ck].words); state.typeIndex = 0; state.typeScore = 0;
  state.typeInput = ""; state.shiftActive = false; state.hintLevel = 0;
  document.querySelector(".app-header h1").textContent = `${WORD_DATA[ck].name} - タイピング`;
  showScreen("type-mode"); renderTypeQ();
}

function getHint(w, lv) {
  const e = w.en, l = e.length;
  if (lv === 1) return `${e[0]} ${"_ ".repeat(l - 1).trim()}　（${l}文字）`;
  if (lv === 2) return l <= 2 ? e : `${e[0]} ${"_ ".repeat(l - 2).trim()} ${e[l - 1]}　（${l}文字）`;
  if (lv === 3) { let h = ""; for (let i = 0; i < l; i++) h += (i === 0 || i === l - 1 || i % 2 === 0) ? e[i] + " " : "_ "; return h.trim() + `　（${l}文字）`; }
  return "";
}

function renderTypeQ() {
  const a = document.getElementById("type-mode"), w = state.typeWords[state.typeIndex], t = state.typeWords.length, pct = (state.typeIndex / t) * 100;
  state.typeInput = ""; state.hintLevel = 0;
  a.innerHTML = `<div class="type-area"><div class="quiz-progress"><span>${state.typeIndex + 1} / ${t}</span><div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div><span>⭕ ${state.typeScore}</span></div>
    <span class="type-emoji">${w.emoji}</span><div class="type-japanese">${w.ja}</div><button class="quiz-speaker-btn" id="speak-btn-type">🔊</button>
    <div class="type-input-display" id="type-display"><span class="type-cursor"></span></div>
    <div class="type-hint-area" id="hint-area"><button class="type-hint-btn" id="hint-btn">ヒント① を見る</button></div></div><div class="keyboard" id="keyboard"></div>`;
  document.getElementById("speak-btn-type").addEventListener("click", () => speakWord(w.en));
  setupHint(); renderKB(); updDisplay();
}

function setupHint() {
  const b = document.getElementById("hint-btn"); if (!b) return;
  b.addEventListener("click", () => {
    state.hintLevel++;
    const w = state.typeWords[state.typeIndex], ha = document.getElementById("hint-area"), ht = getHint(w, state.hintLevel);
    let nx = ""; if (state.hintLevel < 3) { const l = state.hintLevel + 1; nx = `<button class="type-hint-btn" id="hint-btn" style="margin-left:10px">ヒント${l === 2 ? "②" : "③"} を見る</button>`; }
    ha.innerHTML = `<span class="type-hint-text">${ht}</span>${nx}`; setupHint();
  });
}

function renderKB() {
  const kb = document.getElementById("keyboard");
  const rows = [["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l"],["SHIFT","z","x","c","v","b","n","m","⌫"],["ENTER"]];
  kb.innerHTML = rows.map(r => `<div class="kb-row">${r.map(k => {
    if (k === "SHIFT") return `<div class="kb-key shift wide${state.shiftActive ? " active" : ""}" data-key="shift">⇧</div>`;
    if (k === "⌫") return `<div class="kb-key backspace wide" data-key="backspace">⌫</div>`;
    if (k === "ENTER") return `<div class="kb-key enter extra-wide" data-key="enter">けってい ✓</div>`;
    return `<div class="kb-key" data-key="${k}">${state.shiftActive ? k.toUpperCase() : k}</div>`;
  }).join("")}</div>`).join("");
  kb.querySelectorAll(".kb-key").forEach(k => k.addEventListener("click", () => kbPress(k.dataset.key)));
}

function kbPress(k) {
  if (k === "shift") { state.shiftActive = !state.shiftActive; renderKB(); playSound("click"); return; }
  if (k === "backspace") { if (state.typeInput.length > 0) { state.typeInput = state.typeInput.slice(0, -1); playSound("click"); updDisplay(); } return; }
  if (k === "enter") { chkType(); return; }
  state.typeInput += state.shiftActive ? k.toUpperCase() : k;
  if (state.shiftActive) { state.shiftActive = false; renderKB(); }
  playSound("click"); updDisplay();
}

function updDisplay() {
  const d = document.getElementById("type-display"); if (!d) return;
  const w = state.typeWords[state.typeIndex]; let h = "";
  for (let i = 0; i < state.typeInput.length; i++) { const ok = state.typeInput[i].toLowerCase() === (w.en[i] || "").toLowerCase(); h += `<span class="char ${ok ? "correct" : "wrong"}">${state.typeInput[i]}</span>`; }
  d.innerHTML = h + '<span class="type-cursor"></span>';
}

function chkType() {
  const w = state.typeWords[state.typeIndex];
  if (state.typeInput.toLowerCase() === w.en.toLowerCase()) { state.typeScore++; playSound("correct"); speakWord(w.en); showFeedback(true); setTimeout(() => advType(), 1200); }
  else { playSound("wrong"); setTimeout(() => showWrongPopup(w, state.typeInput || "(なにもうってない)", () => advType()), 300); }
}
function advType() { state.typeIndex++; if (state.typeIndex < state.typeWords.length) renderTypeQ(); else showResult("type"); }

document.addEventListener("keydown", e => {
  if (state.currentScreen !== "type-mode" || document.querySelector(".popup-overlay")) return;
  if (e.key === "Backspace") { e.preventDefault(); kbPress("backspace"); }
  else if (e.key === "Enter") { e.preventDefault(); kbPress("enter"); }
  else if (e.key === "Shift") { state.shiftActive = !state.shiftActive; renderKB(); }
  else if (/^[a-zA-Z]$/.test(e.key)) { state.typeInput += e.shiftKey ? e.key.toUpperCase() : e.key.toLowerCase(); playSound("click"); updDisplay(); }
});

// ===== REORDER MODE =====
function startReorderMode(ck) {
  const d = SENTENCE_DATA[ck]; if (!d) return;
  state.reorderSentences = shuffle(d.reorder); state.reorderIndex = 0; state.reorderScore = 0;
  document.querySelector(".app-header h1").textContent = `${WORD_DATA[ck].name} - ならべかえ`;
  showScreen("reorder-mode"); renderReorderQ();
}

function renderReorderQ() {
  const a = document.getElementById("reorder-mode"), item = state.reorderSentences[state.reorderIndex], t = state.reorderSentences.length, pct = (state.reorderIndex / t) * 100;
  state.reorderPlaced = []; state.reorderBank = shuffle([...item.parts]);
  a.innerHTML = `<div class="reorder-area"><div class="quiz-progress"><span>${state.reorderIndex + 1} / ${t}</span><div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div><span>⭕ ${state.reorderScore}</span></div>
    <div class="reorder-instruction">ことばを正しい順番にタップしてならべよう！</div>
    <div class="reorder-answer-zone" id="answer-zone"><span class="placeholder-text">ここに文ができるよ</span></div>
    <div class="reorder-word-bank" id="word-bank"></div>
    <button class="reorder-check-btn" id="reorder-check" disabled>チェック ✓</button></div>`;
  renderBank();
  document.getElementById("reorder-check").addEventListener("click", chkReorder);
}

function renderBank() {
  const bk = document.getElementById("word-bank"), az = document.getElementById("answer-zone"), cb = document.getElementById("reorder-check");
  bk.innerHTML = state.reorderBank.map((w, i) => `<div class="reorder-word${state.reorderPlaced.includes(i) ? " placed" : ""}" data-idx="${i}">${w}</div>`).join("");
  if (state.reorderPlaced.length === 0) { az.innerHTML = '<span class="placeholder-text">ここに文ができるよ</span>'; az.classList.remove("has-words"); }
  else { az.innerHTML = state.reorderPlaced.map(i => `<div class="reorder-word in-answer" data-idx="${i}">${state.reorderBank[i]}</div>`).join(""); az.classList.add("has-words"); }
  cb.disabled = state.reorderPlaced.length !== state.reorderBank.length;
  bk.querySelectorAll(".reorder-word:not(.placed)").forEach(el => el.addEventListener("click", () => { playSound("place"); state.reorderPlaced.push(parseInt(el.dataset.idx)); renderBank(); }));
  az.querySelectorAll(".reorder-word.in-answer").forEach(el => el.addEventListener("click", () => { playSound("click"); state.reorderPlaced = state.reorderPlaced.filter(i => i !== parseInt(el.dataset.idx)); renderBank(); }));
}

function chkReorder() {
  const item = state.reorderSentences[state.reorderIndex], ans = state.reorderPlaced.map(i => state.reorderBank[i]).join(" "), ok = ans === item.answer;
  if (ok) { state.reorderScore++; playSound("correct"); speakSentence(item.answer); showFeedback(true); setTimeout(() => advReorder(), 1200); }
  else { playSound("wrong"); setTimeout(() => showWrongPopupSentence(item.answer, ans, () => advReorder()), 400); }
}
function advReorder() { state.reorderIndex++; if (state.reorderIndex < state.reorderSentences.length) renderReorderQ(); else showResult("reorder"); }

// ===== CHOOSE SENTENCE MODE =====
function startChooseSentenceMode(ck) {
  const d = SENTENCE_DATA[ck]; if (!d) return;
  state.csSentences = shuffle(d.choose); state.csIndex = 0; state.csScore = 0;
  document.querySelector(".app-header h1").textContent = `${WORD_DATA[ck].name} - 絵から文`;
  showScreen("choose-sentence-mode"); renderCSQ();
}

function renderCSQ() {
  const a = document.getElementById("choose-sentence-mode"), item = state.csSentences[state.csIndex], t = state.csSentences.length, pct = (state.csIndex / t) * 100;
  const ch = shuffle([item.correct, ...item.wrongs]);
  a.innerHTML = `<div class="choose-sentence-area"><div class="quiz-progress"><span>${state.csIndex + 1} / ${t}</span><div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div><span>⭕ ${state.csScore}</span></div>
    <span class="cs-emoji">${item.emoji}</span><div class="cs-japanese">${item.ja}</div>
    <div class="cs-choices">${ch.map(c => `<button class="cs-choice" data-text="${c}">${c}</button>`).join("")}</div></div>`;
  a.querySelectorAll(".cs-choice").forEach(b => b.addEventListener("click", () => {
    const chosen = b.dataset.text, ok = chosen === item.correct;
    a.querySelectorAll(".cs-choice").forEach(x => { x.style.pointerEvents = "none"; if (x.dataset.text === item.correct) x.classList.add("correct"); else if (x === b && !ok) x.classList.add("wrong"); });
    if (ok) { state.csScore++; playSound("correct"); speakSentence(item.correct); showFeedback(true); setTimeout(() => advCS(), 1200); }
    else { playSound("wrong"); setTimeout(() => showWrongPopupSentence(item.correct, chosen, () => advCS()), 400); }
  }));
}
function advCS() { state.csIndex++; if (state.csIndex < state.csSentences.length) renderCSQ(); else showResult("choose-sentence"); }

// ===== FILL BLANK MODE =====
function startFillBlankMode(ck) {
  const d = SENTENCE_DATA[ck]; if (!d) return;
  state.fbSentences = shuffle(d.fillblank); state.fbIndex = 0; state.fbScore = 0;
  document.querySelector(".app-header h1").textContent = `${WORD_DATA[ck].name} - 穴うめ`;
  showScreen("fillblank-mode"); renderFBQ();
}

function renderFBQ() {
  const a = document.getElementById("fillblank-mode"), item = state.fbSentences[state.fbIndex], t = state.fbSentences.length, pct = (state.fbIndex / t) * 100;
  const ch = shuffle([...item.choices]), sh = item.sentence.replace("___", '<span class="fb-blank" id="fb-blank">___</span>');
  a.innerHTML = `<div class="fillblank-area"><div class="quiz-progress"><span>${state.fbIndex + 1} / ${t}</span><div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div><span>⭕ ${state.fbScore}</span></div>
    <div class="fb-sentence">${sh}</div><div class="fb-choices">${ch.map(c => `<button class="fb-choice" data-word="${c}">${c}</button>`).join("")}</div></div>`;
  a.querySelectorAll(".fb-choice").forEach(b => b.addEventListener("click", () => {
    const chosen = b.dataset.word, ok = chosen === item.answer, bl = document.getElementById("fb-blank");
    bl.textContent = chosen; bl.classList.add("filled");
    a.querySelectorAll(".fb-choice").forEach(x => { x.style.pointerEvents = "none"; if (x.dataset.word === item.answer) x.classList.add("correct"); else if (x === b && !ok) x.classList.add("wrong"); });
    if (ok) { bl.classList.add("correct-fill"); state.fbScore++; playSound("correct"); speakSentence(item.sentence.replace("___", item.answer)); showFeedback(true); setTimeout(() => advFB(), 1200); }
    else { bl.classList.add("wrong-fill"); playSound("wrong"); setTimeout(() => showWrongPopupSentence(item.sentence.replace("___", item.answer), item.sentence.replace("___", chosen), () => advFB()), 400); }
  }));
}
function advFB() { state.fbIndex++; if (state.fbIndex < state.fbSentences.length) renderFBQ(); else showResult("fillblank"); }

// ===== RESULT =====
function showResult(mode) {
  let score, total; const ck = state.currentCategory;
  if (mode === "choose") { score = state.quizScore; total = state.quizWords.length; }
  else if (mode === "match") { const p = state.matchTotal; score = Math.max(0, Math.round((p / Math.max(state.matchAttempts, p)) * p)); total = p; }
  else if (mode === "type") { score = state.typeScore; total = state.typeWords.length; }
  else if (mode === "reorder") { score = state.reorderScore; total = state.reorderSentences.length; }
  else if (mode === "choose-sentence") { score = state.csScore; total = state.csSentences.length; }
  else if (mode === "fillblank") { score = state.fbScore; total = state.fbSentences.length; }
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  saveProgress(ck, mode, score, total);
  let emoji, title;
  if (pct >= 90) { emoji = "🎉"; title = "すごい！かんぺき！"; }
  else if (pct >= 70) { emoji = "😄"; title = "よくできたね！"; }
  else if (pct >= 50) { emoji = "😊"; title = "がんばったね！"; }
  else { emoji = "💪"; title = "もういちどチャレンジ！"; }
  const stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0;
  playSound("complete"); if (pct >= 70) showConfetti();
  const a = document.getElementById("result");
  a.innerHTML = `<div class="result-area"><span class="result-emoji">${emoji}</span><div class="result-title">${title}</div>
    <div class="result-score">${pct}%</div><div class="result-detail">${score} / ${total} もん正解</div><div class="result-stars">${renderStars(stars)}</div>
    <div class="result-buttons"><button class="result-btn primary" id="retry-btn">もういちど ↻</button><button class="result-btn secondary" id="mode-btn">モードをえらぶ</button><button class="result-btn secondary" id="home-btn">ホームにもどる</button></div></div>`;
  showScreen("result");
  document.getElementById("retry-btn").addEventListener("click", () => { playSound("click");
    if (mode === "choose") startChooseMode(ck); else if (mode === "match") startMatchMode(ck); else if (mode === "type") startTypeMode(ck);
    else if (mode === "reorder") startReorderMode(ck); else if (mode === "choose-sentence") startChooseSentenceMode(ck); else if (mode === "fillblank") startFillBlankMode(ck);
  });
  document.getElementById("mode-btn").addEventListener("click", () => { playSound("click"); renderModeSelect(ck); showScreen("mode-select"); });
  document.getElementById("home-btn").addEventListener("click", () => { playSound("click"); renderHome(); showScreen("home"); });
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  renderHome(); showScreen("home");
  document.querySelector(".back-btn").addEventListener("click", () => { playSound("click"); goBack(); if (state.currentScreen === "home") renderHome(); });
  document.querySelector(".sound-toggle").addEventListener("click", () => { state.soundEnabled = !state.soundEnabled; document.querySelector(".sound-toggle").textContent = state.soundEnabled ? "🔊" : "🔇"; });
});
