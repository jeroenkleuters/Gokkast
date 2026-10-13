(function () {
  "use strict";

  // ======== Configuratie ========
  const SYMBOLS = ["../public/images/shot.png", "../public/images/kakkerlak.png", "../public/images/vraagteken.png"];
  const MAX_TRIES = 3;
  const DEFAULT_ODDS = 10;          // winkans 1 op 30
  const CELL = 104;                 // hoogte van een plaatje op de rol (incl. rand)
  const REEL_H = 296;               // binnenhoogte van een rol
  const CENTER_OFFSET = (REEL_H - CELL) / 2;

  // ======== Winkans (instelbaar) ========
  function loadOdds() {
    const param = new URLSearchParams(location.search).get("kans");
    if (param && +param >= 1) return Math.round(+param);
    try {
      const saved = localStorage.getItem("gokkast-kans");
      if (saved && +saved >= 1) return Math.round(+saved);
    } catch (e) {}
    return DEFAULT_ODDS;
  }
  let odds = loadOdds();

  // ======== Schalen naar venster ========
  const game = document.getElementById("game");
  function fit() {
    const s = Math.min(window.innerWidth / 1024, window.innerHeight / 768);
    game.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener("resize", fit);
  fit();

  // ======== Geluid (Web Audio, geen bestanden nodig) ========
  let audioCtx = null;
  let soundOn = true;
  try { soundOn = localStorage.getItem("gokkast-geluid") !== "uit"; } catch (e) {}
  function ctx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }
  function beep(freq, dur, type = "square", vol = 0.08, when = 0) {
    if (!soundOn) return;
    try {
      const c = ctx();
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      const t = c.currentTime + when;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  }
  const sfx = {
    click: () => beep(600, 0.06, "square", 0.05),
    tick: () => beep(1200, 0.025, "square", 0.025),
    stop: () => beep(180, 0.12, "triangle", 0.15),
    lose: () => { beep(330, 0.25, "sawtooth", 0.06); beep(247, 0.4, "sawtooth", 0.06, 0.25); },
    win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => beep(f, 0.18, "square", 0.07, i * 0.12)),
  };
  const soundBtn = document.getElementById("sound");
  function renderSound() { soundBtn.textContent = soundOn ? "🔊" : "🔇"; }
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    try { localStorage.setItem("gokkast-geluid", soundOn ? "aan" : "uit"); } catch (e) {}
    renderSound();
  });
  renderSound();

  // ======== Elementen ========
  const reels = [0, 1, 2].map(i => document.getElementById("reel" + i));
  const strips = reels.map(r => r.querySelector(".strip"));
  const holdBtns = [...document.querySelectorAll(".holdbtn")];
  const playBtn = document.getElementById("playbtn");
  const lever = document.getElementById("lever");
  const display = document.getElementById("display");
  const lamps = [...document.querySelectorAll(".lamp")];
  const stPlayed = document.getElementById("st-played");
  const stWon = document.getElementById("st-won");
  const stOdds = document.getElementById("st-odds");
  const stNow = document.getElementById("st-now");

  // ======== Spelstatus ========
  const rnd = n => Math.floor(Math.random() * n);
  let current = [0, 1, 2];          // symbool op de winlijn per rol
  let held = [false, false, false];
  let triesLeft = MAX_TRIES;
  let spinsThisGame = 0;
  let spinning = false;
  let gameOver = false;
  let played = 0, won = 0;

  function cellHTML(sym) {
    return `<div class="cell"><img src="${SYMBOLS[sym]}" alt="" draggable="false"></div>`;
  }
  function setStrip(i, list, y) {
    strips[i].innerHTML = list.map(cellHTML).join("");
    strips[i].style.transform = `translateY(${y}px)`;
  }
  // Toon rol i in rust: plaatje erboven, het winlijn-plaatje, plaatje eronder
  function restReel(i) {
    const s = current[i];
    setStrip(i, [(s + 2) % 3, s, (s + 1) % 3], CENTER_OFFSET - CELL);
  }

  function setMessage(text, cls = "") {
    display.textContent = text;
    display.className = cls;
  }

  function render() {
    lamps.forEach((l, i) => l.classList.toggle("on", i < triesLeft));
    const canHold = !spinning && !gameOver && spinsThisGame > 0;
    const heldCount = held.filter(Boolean).length;
    holdBtns.forEach((b, i) => {
      b.classList.toggle("on", held[i]);
      // maximaal twee rollen vast, anders draait er niets
      b.disabled = !canHold || (!held[i] && heldCount >= 2);
    });
    reels.forEach((r, i) => r.classList.toggle("held", held[i]));
    playBtn.disabled = spinning;
    playBtn.textContent = gameOver ? "NIEUW SPEL" : "SPEEL";
    playBtn.classList.toggle("new", gameOver);
    lever.classList.toggle("disabled", spinning);
    stPlayed.textContent = played;
    stWon.textContent = won;
    stOdds.textContent = "1 op " + odds;
    const c = winChance();
    stNow.textContent = gameOver ? "–" : c === 0 ? "geen" : "1 op " + (1 / c).toFixed(1).replace(/\.0$/, "").replace(".", ",");
  }

  // ======== Uitkomst bepalen ========
  // Winkans voor de volgende draai. Elke draaiende rol valt met kans
  // (1/odds)^(1/3) goed, dus 3 vrije rollen = 1 op odds. Wie rollen met
  // hetzelfde plaatje vastzet, hoeft er minder goed te laten vallen.
  function winChance() {
    const heldSyms = new Set(current.filter((_, i) => held[i]));
    if (heldSyms.size > 1) return 0; // vastgezette rollen moeten gelijk zijn
    const free = held.filter(h => !h).length;
    return Math.pow(1 / odds, free / 3);
  }

  function decideOutcome() {
    const heldSyms = [...new Set(current.filter((_, i) => held[i]))];
    const isWin = Math.random() < winChance();

    if (isWin) {
      const target = heldSyms.length ? heldSyms[0] : rnd(SYMBOLS.length);
      return [target, target, target];
    }
    // Verlies: willekeurige plaatjes, maar nooit drie dezelfde
    let res;
    do {
      res = current.map((s, i) => held[i] ? s : rnd(SYMBOLS.length));
    } while (res[0] === res[1] && res[1] === res[2]);
    return res;
  }

  // ======== Draaien ========
  const easeOutBack = t => {
    const c1 = 0.9, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  function spinReel(i, target, duration) {
    return new Promise(resolve => {
      // Strook: [boven, huidig, ...willekeurig..., doel, onder]
      const loops = Math.round(duration / 55);
      const list = [(current[i] + 2) % 3, current[i]];
      for (let k = 0; k < loops; k++) list.push(rnd(SYMBOLS.length));
      list.push(target, (target + 1) % 3);
      const startY = CENTER_OFFSET - CELL;
      const endY = CENTER_OFFSET - (list.length - 2) * CELL;
      setStrip(i, list, startY);
      strips[i].classList.add("blur");

      const t0 = performance.now();
      let lastCell = 0;
      function frame(now) {
        const t = Math.min(1, (now - t0) / duration);
        const y = startY + (endY - startY) * easeOutBack(t);
        strips[i].style.transform = `translateY(${y}px)`;
        const cellIdx = Math.floor((startY - y) / CELL);
        if (cellIdx !== lastCell) { lastCell = cellIdx; if (i === 0 || t > 0.6) sfx.tick(); }
        if (t > 0.85) strips[i].classList.remove("blur");
        if (t < 1) requestAnimationFrame(frame);
        else {
          current[i] = target;
          restReel(i);
          sfx.stop();
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  function newGame() {
    triesLeft = MAX_TRIES;
    spinsThisGame = 0;
    held = [false, false, false];
    gameOver = false;
    reels.forEach(r => r.classList.remove("win"));
    setMessage("DRUK OP SPEEL!");
    render();
  }

  async function play() {
    if (spinning) return;
    try { ctx().resume(); } catch (e) {}
    if (gameOver) { sfx.click(); newGame(); return; }

    sfx.click();
    lever.classList.add("pulled");
    setTimeout(() => lever.classList.remove("pulled"), 260);

    spinning = true;
    triesLeft--;
    spinsThisGame++;
    setMessage("ROLLEN DRAAIEN...");
    render();

    const result = decideOutcome();
    const jobs = [];
    let order = 0;
    for (let i = 0; i < 3; i++) {
      if (held[i]) continue;
      jobs.push(spinReel(i, result[i], 1100 + order * 450));
      order++;
    }
    await Promise.all(jobs);
    spinning = false;

    const isWin = current[0] === current[1] && current[1] === current[2];
    if (isWin) {
      gameOver = true;
      played++; won++;
      held = [false, false, false];
      reels.forEach(r => r.classList.add("win"));
      setMessage("★ JACKPOT! JE HEBT GEWONNEN! ★", "win");
      sfx.win();
      coinShower();
    } else if (triesLeft === 0) {
      gameOver = true;
      played++;
      held = [false, false, false];
      setMessage("HELAAS... PROBEER HET NOG EENS", "lose");
      sfx.lose();
    } else {
      setMessage(triesLeft === 1
        ? "NOG 1 POGING — ZET ROLLEN VAST!"
        : `NOG ${triesLeft} POGINGEN — ZET ROLLEN VAST!`);
    }
    render();
  }

  function toggleHold(i) {
    const btn = holdBtns[i];
    if (btn.disabled) return;
    sfx.click();
    held[i] = !held[i];
    render();
  }

  // ======== Muntenregen ========
  function coinShower() {
    for (let n = 0; n < 60; n++) {
      const c = document.createElement("div");
      c.className = "coin";
      const x = 220 + Math.random() * 580;
      c.style.left = x + "px";
      c.style.top = "-30px";
      game.appendChild(c);
      const dx = (Math.random() - 0.5) * 200;
      const dur = 1400 + Math.random() * 1400;
      c.animate([
        { transform: "translate(0,0) rotateY(0deg)" },
        { transform: `translate(${dx}px, 820px) rotateY(${720 + Math.random() * 720}deg)` }
      ], { duration: dur, delay: Math.random() * 900, easing: "cubic-bezier(.4,0,.9,.6)", fill: "both" })
        .onfinish = () => c.remove();
    }
  }

  // ======== Instellingen ========
  const settings = document.getElementById("settings");
  const oddsInput = document.getElementById("odds-input");
  document.getElementById("gear").addEventListener("click", () => {
    oddsInput.value = odds;
    settings.classList.add("open");
    oddsInput.focus(); oddsInput.select();
  });
  function closeSettings() { settings.classList.remove("open"); }
  function saveSettings() {
    const v = Math.round(+oddsInput.value);
    if (v >= 1) {
      odds = v;
      try { localStorage.setItem("gokkast-kans", String(v)); } catch (e) {}
    }
    closeSettings();
    render();
  }
  document.getElementById("set-cancel").addEventListener("click", closeSettings);
  document.getElementById("set-ok").addEventListener("click", saveSettings);
  oddsInput.addEventListener("keydown", e => {
    if (e.key === "Enter") saveSettings();
    if (e.key === "Escape") closeSettings();
    e.stopPropagation();
  });

  // ======== Invoer ========
  playBtn.addEventListener("click", play);
  lever.addEventListener("click", play);
  holdBtns.forEach((b, i) => b.addEventListener("click", () => toggleHold(i)));
  document.addEventListener("keydown", e => {
    if (settings.classList.contains("open")) return;
    if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); play(); }
    if (["1", "2", "3"].includes(e.key)) toggleHold(+e.key - 1);
  });

  // ======== Start ========
  // Begin met drie verschillende plaatjes
  current = [0, 1, 2].sort(() => Math.random() - 0.5);
  [0, 1, 2].forEach(restReel);
  render();
})();
