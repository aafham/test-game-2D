
(() => {
  "use strict";

  const STORAGE = {
    highScore: "dodge_run_high_score",
    skin: "dodge_run_skin_index",
    leaderboard: "dodge_run_local_leaderboard",
    challengeDoneDate: "dodge_run_challenge_done_date",
    reducedMotion: "dodge_run_reduced_motion",
    highContrast: "dodge_run_high_contrast",
    mute: "dodge_run_mute"
  };

  const WORLD = { width: 360, height: 640 };
  const TUNE = {
    maxDt: 1 / 30,
    baseScrollSpeed: 115,
    basePlayerAccel: 2900,
    basePlayerMaxSpeed: 380,
    friction: 8.5,
    levelInterval: 12,
    maxLevel: 30,
    powerupMinGap: 8,
    powerupMaxGap: 14,
    comboWindow: 2.2,
    bossEveryLevels: 5,
    abilityCooldownMax: 7.5
  };

  const SKINS = [
    { name: "Neo Mint", player: ["#7fffd4", "#2bc48a"], obstacle: ["#ff8ca0", "#ff476e"], boss: ["#ffbf69", "#ff8f3f"] },
    { name: "Cyber Blue", player: ["#8ad8ff", "#2b8df0"], obstacle: ["#ff9f80", "#f15a2b"], boss: ["#ffd166", "#ef9f1d"] },
    { name: "Sunset Pulse", player: ["#ffe29a", "#ff9f1c"], obstacle: ["#ffa8d8", "#e53888"], boss: ["#ffd7ba", "#fb5607"] }
  ];

  const DAILY_CHALLENGES = [
    { id: "survive_60", text: "Survive 60 seconds", type: "survive", target: 60, rewardScore: 80, rewardCoins: 6 },
    { id: "dodge_25", text: "Dodge 25 obstacles", type: "dodge", target: 25, rewardScore: 70, rewardCoins: 5 },
    { id: "coin_20", text: "Collect 20 coins", type: "coin", target: 20, rewardScore: 65, rewardCoins: 8 }
  ];

  const LEADERBOARD_ENDPOINT = String(window.DODGE_LEADERBOARD_ENDPOINT || "").trim();
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let prefersReducedMotion = reducedMotionQuery.matches;

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const canvasWrap = document.getElementById("canvasWrap");
  const hud = document.getElementById("hud");

  const startScreen = document.getElementById("startScreen");
  const settingsScreen = document.getElementById("settingsScreen");
  const pauseScreen = document.getElementById("pauseScreen");
  const gameOverScreen = document.getElementById("gameOverScreen");

  const scoreValue = document.getElementById("scoreValue");
  const highScoreValue = document.getElementById("highScoreValue");
  const levelValue = document.getElementById("levelValue");
  const speedValue = document.getElementById("speedValue");
  const comboValue = document.getElementById("comboValue");
  const shieldValue = document.getElementById("shieldValue");
  const coinValue = document.getElementById("coinValue");
  const bossValue = document.getElementById("bossValue");
  const abilityValue = document.getElementById("abilityValue");
  const abilityMeterFill = document.getElementById("abilityMeterFill");

  const finalScore = document.getElementById("finalScore");
  const finalHighScore = document.getElementById("finalHighScore");
  const finalCoins = document.getElementById("finalCoins");
  const rewardInfo = document.getElementById("rewardInfo");

  const challengeText = document.getElementById("challengeText");
  const challengeStatus = document.getElementById("challengeStatus");
  const challengeReset = document.getElementById("challengeReset");
  const leaderboardList = document.getElementById("leaderboardList");
  const leaderboardPanel = document.getElementById("leaderboardPanel");
  const leaderboardToggleBtn = document.getElementById("leaderboardToggleBtn");

  const startBtn = document.getElementById("startBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsBackBtn = document.getElementById("settingsBackBtn");
  const skinBtn = document.getElementById("skinBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const abilityBtn = document.getElementById("abilityBtn");
  const dashFab = document.getElementById("dashFab");
  const resumeBtn = document.getElementById("resumeBtn");
  const homeBtnGameOver = document.getElementById("homeBtnGameOver");
  const restartBtn = document.getElementById("restartBtn");
  const submitBtn = document.getElementById("submitBtn");
  const newHighBadge = document.getElementById("newHighBadge");
  const touchZoneLeft = document.getElementById("touchZoneLeft");
  const touchZoneRight = document.getElementById("touchZoneRight");
  const settingReducedMotion = document.getElementById("settingReducedMotion");
  const settingHighContrast = document.getElementById("settingHighContrast");
  const settingMute = document.getElementById("settingMute");
  const hudPulseState = {};
  const hudPrev = {
    score: 0,
    high: 0,
    level: 1,
    speed: "1.00x",
    combo: "x1",
    shield: 0,
    coins: 0,
    boss: "-"
  };
  let toastStack = null;
  const toastHistory = {};

  const state = {
    mode: "start",
    score: 0,
    highScore: Number(localStorage.getItem(STORAGE.highScore) || 0),
    surviveTime: 0,
    coins: 0,
    level: 1,
    speedMul: 1,
    dodges: 0,
    combo: 1,
    comboTimer: 0,
    shieldCharges: 0,
    magnetTime: 0,
    abilityCooldown: 0,
    abilityActiveTime: 0,
    lastMoveDir: 1,
    player: { x: WORLD.width * 0.5 - 22, y: WORLD.height - 72, width: 44, height: 24, vx: 0, ax: 0 },
    obstacles: [],
    collectibles: [],
    particles: [],
    spawnTimer: 0,
    nextSpawnDelay: randRange(0.76, 1.2),
    lastSpawnX: null,
    lastSpawnAt: -999,
    powerupTimer: 0,
    nextPowerupDelay: randRange(TUNE.powerupMinGap, TUNE.powerupMaxGap),
    boss: { active: false, level: 0, timeLeft: 0, spawnTimer: 0, phase: 0, nextLevelTrigger: TUNE.bossEveryLevels },
    challenge: buildDailyChallenge(),
    skinIndex: clamp(Number(localStorage.getItem(STORAGE.skin) || 0), 0, SKINS.length - 1),
    leaderboard: [],
    leaderboardExpanded: false,
    settings: {
      reducedMotion: localStorage.getItem(STORAGE.reducedMotion) === "1",
      highContrast: localStorage.getItem(STORAGE.highContrast) === "1",
      mute: localStorage.getItem(STORAGE.mute) === "1"
    },
    shakeTime: 0,
    shakeMag: 0,
    input: { left: false, right: false, touchAxis: 0, swipeStartX: null, pointerDown: false },
    lastRunBonusText: "",
    frameHandle: null,
    lastTs: 0,
    lastClockSecond: -1
  };

  const audio = makeAudio();
  window.resetHighScore = resetHighScore;
  window.resetLeaderboard = resetLeaderboard;

  function makeAudio() {
    let actx = null;
    let enabled = false;

    function init() {
      if (enabled) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        actx = new Ctx();
        enabled = true;
      } catch (_) {
        enabled = false;
      }
    }

    function beep(freq, duration = 0.08, type = "square", volume = 0.03) {
      if (state.settings.mute) return;
      if (!enabled || !actx) return;
      if (actx.state === "suspended") {
        actx.resume().catch(() => {});
      }

      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + duration);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start();
      osc.stop(actx.currentTime + duration);
    }

    return { init, beep };
  }

  function randRange(min, max) { return min + Math.random() * (max - min); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function aabb(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

  function dateKeyToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function buildDailyChallenge() {
    const dateKey = dateKeyToday();
    const hash = dateKey.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const base = DAILY_CHALLENGES[hash % DAILY_CHALLENGES.length];
    const doneDate = localStorage.getItem(STORAGE.challengeDoneDate);
    return { ...base, dateKey, progress: 0, completed: doneDate === dateKey, rewardGiven: doneDate === dateKey };
  }

  function showOverlay(el) {
    [startScreen, settingsScreen, pauseScreen, gameOverScreen].forEach((node) => node.classList.toggle("active", node === el));
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode === "start") showOverlay(startScreen);
    if (mode === "settings") showOverlay(settingsScreen);
    if (mode === "paused") showOverlay(pauseScreen);
    if (mode === "gameover") showOverlay(gameOverScreen);
    if (mode === "playing") showOverlay(null);
    dashFab.classList.toggle("hidden", mode !== "playing");
  }

  function resetHighScore() {
    state.highScore = 0;
    localStorage.removeItem(STORAGE.highScore);
    updateHud();
    showToast("High score reset", "info");
  }

  function resetLeaderboard() {
    state.leaderboard = [];
    localStorage.removeItem(STORAGE.leaderboard);
    renderLeaderboard();
    showToast("Leaderboard reset", "info");
  }

  function getSkin() { return SKINS[state.skinIndex] || SKINS[0]; }

  function cycleSkin() {
    state.skinIndex = (state.skinIndex + 1) % SKINS.length;
    localStorage.setItem(STORAGE.skin, String(state.skinIndex));
    skinBtn.textContent = `Skin: ${getSkin().name}`;
  }

  function updateHud() {
    const scoreNow = Math.floor(state.score);
    const highNow = state.highScore;
    const levelNow = state.level;
    const speedNow = `${state.speedMul.toFixed(2)}x`;
    const comboNow = `x${state.combo}`;
    const shieldNow = state.shieldCharges;
    const coinsNow = state.coins;
    const bossNow = state.boss.active ? `Wave ${state.boss.level}` : "-";

    scoreValue.textContent = String(scoreNow);
    highScoreValue.textContent = String(highNow);
    levelValue.textContent = String(levelNow);
    speedValue.textContent = speedNow;
    comboValue.textContent = comboNow;
    shieldValue.textContent = String(shieldNow);
    coinValue.textContent = String(coinsNow);
    bossValue.textContent = bossNow;
    abilityValue.textContent = state.abilityCooldown <= 0 ? (state.abilityActiveTime > 0 ? "Active" : "Ready") : `${state.abilityCooldown.toFixed(1)}s`;
    const meter = state.abilityCooldown <= 0 ? 100 : clamp(((TUNE.abilityCooldownMax - state.abilityCooldown) / TUNE.abilityCooldownMax) * 100, 0, 100);
    abilityMeterFill.style.width = `${meter}%`;
    dashFab.textContent = state.abilityCooldown <= 0 ? "Dash" : `${state.abilityCooldown.toFixed(1)}s`;
    dashFab.disabled = state.mode !== "playing" || state.abilityCooldown > 0;

    comboValue.classList.toggle("combo-hot", state.combo >= 3);
    shieldValue.classList.toggle("shield-hot", state.shieldCharges > 0);
    bossValue.classList.toggle("boss-hot", state.boss.active);

    // Keep score pulse readable by thresholding small per-frame changes.
    if (scoreNow >= hudPrev.score + 4) pulseHudValue(scoreValue, "score");
    if (highNow !== hudPrev.high) pulseHudValue(highScoreValue, "high");
    if (levelNow !== hudPrev.level) pulseHudValue(levelValue, "level");
    if (comboNow !== hudPrev.combo) pulseHudValue(comboValue, "combo");
    if (shieldNow !== hudPrev.shield) pulseHudValue(shieldValue, "shield");
    if (coinsNow !== hudPrev.coins) pulseHudValue(coinValue, "coins");
    if (bossNow !== hudPrev.boss) pulseHudValue(bossValue, "boss");

    hudPrev.score = scoreNow;
    hudPrev.high = highNow;
    hudPrev.level = levelNow;
    hudPrev.speed = speedNow;
    hudPrev.combo = comboNow;
    hudPrev.shield = shieldNow;
    hudPrev.coins = coinsNow;
    hudPrev.boss = bossNow;
  }

  function pulseHudValue(el, key) {
    if (prefersReducedMotion) return;
    const now = performance.now();
    if (now - (hudPulseState[key] || 0) < 120) return;
    hudPulseState[key] = now;
    el.classList.remove("hud-pop");
    void el.offsetWidth;
    el.classList.add("hud-pop");
  }

  function ensureToastStack() {
    if (toastStack) return;
    toastStack = document.createElement("div");
    toastStack.className = "toast-stack";
    toastStack.setAttribute("aria-live", "polite");
    document.body.appendChild(toastStack);
  }

  function showToast(message, tone = "info") {
    ensureToastStack();
    const key = `${tone}:${message}`;
    const now = performance.now();
    if (now - (toastHistory[key] || 0) < 550) return;
    toastHistory[key] = now;

    while (toastStack.childElementCount >= 4) {
      toastStack.firstElementChild.remove();
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${tone}`;
    toast.textContent = message;
    toastStack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    window.setTimeout(() => {
      toast.classList.remove("show");
      window.setTimeout(() => toast.remove(), prefersReducedMotion ? 0 : 220);
    }, 1700);
  }

  function haptic(ms = 16) {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
    }
  }

  function bindReducedMotionPreference() {
    const apply = () => {
      prefersReducedMotion = state.settings.reducedMotion || reducedMotionQuery.matches;
    };
    apply();
    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", apply);
    } else if (typeof reducedMotionQuery.addListener === "function") {
      reducedMotionQuery.addListener(apply);
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE.reducedMotion, state.settings.reducedMotion ? "1" : "0");
    localStorage.setItem(STORAGE.highContrast, state.settings.highContrast ? "1" : "0");
    localStorage.setItem(STORAGE.mute, state.settings.mute ? "1" : "0");
  }

  function applyVisualSettings() {
    document.body.classList.toggle("high-contrast", state.settings.highContrast);
    prefersReducedMotion = state.settings.reducedMotion || reducedMotionQuery.matches;
  }

  function syncSettingsInputs() {
    settingReducedMotion.checked = state.settings.reducedMotion;
    settingHighContrast.checked = state.settings.highContrast;
    settingMute.checked = state.settings.mute;
  }

  function openSettings() {
    syncSettingsInputs();
    setMode("settings");
  }

  function closeSettings() {
    setMode("start");
  }

  function updateChallengeUI() {
    const c = state.challenge;
    if (c.rewardGiven) {
      challengeText.textContent = `${c.text}`;
      challengeStatus.textContent = `Completed Today (+${c.rewardScore} score, +${c.rewardCoins} coins)`;
    } else {
      challengeText.textContent = `${c.text} (${Math.floor(c.progress)}/${c.target})`;
      challengeStatus.textContent = "In progress";
    }
    challengeReset.textContent = `Resets in ${timeUntilNextDayText()}`;
  }

  function timeUntilNextDayText() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const diffMs = Math.max(0, next.getTime() - now.getTime());
    const totalMin = Math.floor(diffMs / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m}m`;
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(WORLD.width * dpr);
    canvas.height = Math.floor(WORLD.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const maxW = window.innerWidth - 24;
    const maxH = window.innerHeight - hud.offsetHeight - 40;
    const scale = Math.max(0.45, Math.min(maxW / WORLD.width, maxH / WORLD.height));

    canvas.style.width = `${Math.floor(WORLD.width * scale)}px`;
    canvas.style.height = `${Math.floor(WORLD.height * scale)}px`;
    canvasWrap.style.width = canvas.style.width;
  }

  function loadLocalLeaderboard() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE.leaderboard) || "[]");
      if (Array.isArray(data)) return data.filter((item) => Number.isFinite(item.score)).slice(0, 10);
    } catch (_) {}
    return [];
  }

  function saveLocalLeaderboard() {
    localStorage.setItem(STORAGE.leaderboard, JSON.stringify(state.leaderboard.slice(0, 10)));
  }

  async function fetchRemoteLeaderboard() {
    if (!LEADERBOARD_ENDPOINT) return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800);
      const response = await fetch(`${LEADERBOARD_ENDPOINT.replace(/\/$/, "")}/top?limit=10`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) return null;
      const rows = await response.json();
      if (!Array.isArray(rows)) return null;
      return rows
        .filter((x) => x && Number.isFinite(Number(x.score)))
        .map((x) => ({ name: String(x.name || "Guest").slice(0, 12), score: Math.floor(Number(x.score)), date: String(x.date || "") }))
        .slice(0, 10);
    } catch (_) {
      return null;
    }
  }

  function renderLeaderboard() {
    leaderboardList.innerHTML = "";
    if (!state.leaderboard.length) {
      const li = document.createElement("li");
      li.textContent = "No scores yet";
      leaderboardList.appendChild(li);
      leaderboardToggleBtn.textContent = "View All";
      leaderboardToggleBtn.disabled = true;
      return;
    }

    leaderboardToggleBtn.disabled = state.leaderboard.length <= 3;
    leaderboardToggleBtn.textContent = state.leaderboardExpanded ? "Show Top 3" : "View All";

    const rows = state.leaderboardExpanded ? state.leaderboard : state.leaderboard.slice(0, 3);
    rows.forEach((row) => {
      const li = document.createElement("li");
      li.textContent = `${row.name} - ${row.score}`;
      leaderboardList.appendChild(li);
    });
  }

  async function refreshLeaderboard() {
    const remote = await fetchRemoteLeaderboard();
    state.leaderboard = remote || loadLocalLeaderboard();
    renderLeaderboard();
  }

  async function submitScore(name, score) {
    const cleanName = String(name || "Guest").trim().slice(0, 12) || "Guest";
    const row = { name: cleanName, score: Math.floor(score), date: dateKeyToday() };
    let remoteOk = false;

    if (LEADERBOARD_ENDPOINT) {
      try {
        const response = await fetch(`${LEADERBOARD_ENDPOINT.replace(/\/$/, "")}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row)
        });
        remoteOk = response.ok;
      } catch (_) {
        remoteOk = false;
      }
    }

    if (!remoteOk) {
      state.leaderboard = [...state.leaderboard, row].sort((a, b) => b.score - a.score).slice(0, 10);
      saveLocalLeaderboard();
    }

    await refreshLeaderboard();
    showToast("Score submitted", "success");
  }
  function updatePlayer(dt) {
    const inputAxis = (state.input.left ? -1 : 0) + (state.input.right ? 1 : 0) + state.input.touchAxis;
    state.player.ax = clamp(inputAxis, -1, 1) * TUNE.basePlayerAccel;
    state.player.vx += state.player.ax * dt;

    if (Math.abs(inputAxis) < 0.001) {
      const drag = Math.exp(-TUNE.friction * dt);
      state.player.vx *= drag;
      if (Math.abs(state.player.vx) < 4) state.player.vx = 0;
    } else {
      state.lastMoveDir = inputAxis < 0 ? -1 : 1;
    }

    state.player.vx = clamp(state.player.vx, -TUNE.basePlayerMaxSpeed, TUNE.basePlayerMaxSpeed);
    state.player.x += state.player.vx * dt;

    const minX = 8;
    const maxX = WORLD.width - state.player.width - 8;
    if (state.player.x < minX) {
      state.player.x = minX;
      state.player.vx = 0;
    }
    if (state.player.x > maxX) {
      state.player.x = maxX;
      state.player.vx = 0;
    }

    state.input.touchAxis *= Math.exp(-12 * dt);
    if (Math.abs(state.input.touchAxis) < 0.01) state.input.touchAxis = 0;
  }

  function updateSpawners(dt, now) {
    if (!state.boss.active) {
      state.spawnTimer += dt;
      if (state.spawnTimer >= state.nextSpawnDelay) {
        state.spawnTimer = 0;
        spawnObstacle(now, false);
      }
    }

    state.powerupTimer += dt;
    if (state.powerupTimer >= state.nextPowerupDelay) {
      state.powerupTimer = 0;
      spawnPowerup();
      state.nextPowerupDelay = randRange(TUNE.powerupMinGap, TUNE.powerupMaxGap);
    }

    if (!state.boss.active && state.level >= state.boss.nextLevelTrigger) {
      startBossWave();
      state.boss.nextLevelTrigger += TUNE.bossEveryLevels;
    }

    if (state.boss.active) {
      state.boss.timeLeft -= dt;
      state.boss.spawnTimer += dt;
      if (state.boss.spawnTimer >= 0.55) {
        state.boss.spawnTimer = 0;
        spawnBossPattern(now);
      }
      if (state.boss.timeLeft <= 0) {
        state.boss.active = false;
      }
    }
  }

  function updateObstacles(worldDt) {
    for (let i = state.obstacles.length - 1; i >= 0; i -= 1) {
      const o = state.obstacles[i];
      o.y += o.speed * worldDt;
      o.x += o.vx * worldDt;

      if (o.x < 0 || o.x + o.width > WORLD.width) {
        o.vx *= -1;
        o.x = clamp(o.x, 0, WORLD.width - o.width);
      }

      if (!o.scored && o.y > WORLD.height) {
        o.scored = true;
        state.dodges += 1;

        state.combo = state.comboTimer > 0 ? Math.min(5, state.combo + 1) : 1;
        state.comboTimer = TUNE.comboWindow;

        state.score += 10 * state.combo;
        emitParticles(o.x + o.width * 0.5, WORLD.height - 7, "#77ffd6", 5);
        audio.beep(710 + state.combo * 35, 0.04, "square", 0.02);
        if (state.combo >= 3) {
          showToast(`Combo ${state.combo}x`, "accent");
        }
      }

      if (o.y > WORLD.height + 130) {
        state.obstacles.splice(i, 1);
        continue;
      }

      if (aabb(state.player, o)) {
        if (state.shieldCharges > 0) {
          state.shieldCharges -= 1;
          emitParticles(o.x + o.width * 0.5, o.y + o.height * 0.5, "#a7f3d0", 10);
          state.obstacles.splice(i, 1);
          audio.beep(420, 0.05, "triangle", 0.03);
          showToast("Shield blocked hit", "success");
          haptic(22);
          continue;
        }

        endGame();
        return;
      }
    }
  }

  function updateCollectibles(worldDt) {
    const pCenterX = state.player.x + state.player.width * 0.5;
    const pCenterY = state.player.y + state.player.height * 0.5;

    for (let i = state.collectibles.length - 1; i >= 0; i -= 1) {
      const item = state.collectibles[i];
      item.y += item.speed * worldDt;
      item.x += item.vx * worldDt;

      if (item.x < 6 || item.x + item.width > WORLD.width - 6) {
        item.vx *= -1;
      }

      if (state.magnetTime > 0 && item.type === "coin") {
        const dx = pCenterX - (item.x + item.width * 0.5);
        const dy = pCenterY - (item.y + item.height * 0.5);
        const distSq = dx * dx + dy * dy;
        if (distSq < 180 * 180) {
          const pull = 220 / Math.max(80, Math.sqrt(distSq));
          item.x += dx * 0.02 * pull;
          item.y += dy * 0.02 * pull;
        }
      }

      if (item.y > WORLD.height + 40) {
        state.collectibles.splice(i, 1);
        continue;
      }

      if (aabb(state.player, item)) {
        if (item.type === "coin") {
          state.coins += item.value;
          state.score += 5;
          emitParticles(item.x + 7, item.y + 7, "#ffd166", 4);
          audio.beep(900, 0.03, "triangle", 0.02);
        } else if (item.type === "shield") {
          state.shieldCharges = Math.min(2, state.shieldCharges + 1);
          emitParticles(item.x + 7, item.y + 7, "#a7f3d0", 8);
          audio.beep(520, 0.06, "square", 0.03);
          showToast("Shield +1", "success");
          haptic(14);
        } else if (item.type === "magnet") {
          state.magnetTime = Math.max(state.magnetTime, 7);
          emitParticles(item.x + 7, item.y + 7, "#9fd8ff", 8);
          audio.beep(620, 0.06, "square", 0.03);
          showToast("Magnet active", "info");
          haptic(14);
        }

        state.collectibles.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 170 * dt;

      if (p.life <= 0) {
        state.particles.splice(i, 1);
      }
    }
  }

  function update(dt, now) {
    if (state.mode !== "playing") return;

    state.surviveTime += dt;
    state.score += dt * 8;

    state.level = Math.min(TUNE.maxLevel, 1 + Math.floor(state.surviveTime / TUNE.levelInterval));
    state.speedMul = 1 + (state.level - 1) * 0.085;

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 1;
      }
    }

    if (state.magnetTime > 0) state.magnetTime = Math.max(0, state.magnetTime - dt);
    if (state.abilityActiveTime > 0) state.abilityActiveTime = Math.max(0, state.abilityActiveTime - dt);
    if (state.abilityCooldown > 0) state.abilityCooldown = Math.max(0, state.abilityCooldown - dt);

    const worldDt = dt * getWorldTimeScale();

    updatePlayer(dt);
    updateSpawners(dt, now);
    updateObstacles(worldDt);
    updateCollectibles(worldDt);
    updateParticles(dt);
    checkChallengeProgress();

    const roundedScore = Math.floor(state.score);
    if (roundedScore > state.highScore) {
      state.highScore = roundedScore;
      localStorage.setItem(STORAGE.highScore, String(state.highScore));
    }

    updateHud();
  }
  function resetRunState() {
    state.score = 0;
    state.surviveTime = 0;
    state.coins = 0;
    state.level = 1;
    state.speedMul = 1;
    state.dodges = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.shieldCharges = 0;
    state.magnetTime = 0;
    state.abilityCooldown = 0;
    state.abilityActiveTime = 0;
    state.lastMoveDir = 1;

    state.player.x = WORLD.width * 0.5 - state.player.width * 0.5;
    state.player.y = WORLD.height - 72;
    state.player.vx = 0;
    state.player.ax = 0;

    state.obstacles = [];
    state.collectibles = [];
    state.particles = [];

    state.spawnTimer = 0;
    state.nextSpawnDelay = randRange(0.76, 1.2);
    state.lastSpawnX = null;
    state.lastSpawnAt = -999;

    state.powerupTimer = 0;
    state.nextPowerupDelay = randRange(TUNE.powerupMinGap, TUNE.powerupMaxGap);

    state.boss.active = false;
    state.boss.level = 0;
    state.boss.timeLeft = 0;
    state.boss.spawnTimer = 0;
    state.boss.phase = 0;
    state.boss.nextLevelTrigger = TUNE.bossEveryLevels;

    state.shakeTime = 0;
    state.shakeMag = 0;

    state.input.left = false;
    state.input.right = false;
    state.input.touchAxis = 0;

    state.lastRunBonusText = "";
    state.challenge = buildDailyChallenge();
    newHighBadge.classList.add("hidden");

    updateHud();
    updateChallengeUI();
  }

  function startGame() {
    audio.init();
    audio.beep(500, 0.06, "triangle", 0.02);
    resetRunState();
    setMode("playing");
  }

  function backToHome() {
    resetRunState();
    setMode("start");
    showToast("Back to home", "info");
  }

  function pauseGame() {
    if (state.mode !== "playing") return;
    setMode("paused");
  }

  function resumeGame() {
    if (state.mode !== "paused") return;
    setMode("playing");
    state.lastTs = performance.now();
  }

  function endGame() {
    setMode("gameover");
    state.shakeTime = 0.38;
    state.shakeMag = 8;

    const roundedScore = Math.floor(state.score);
    const wasNewHigh = roundedScore > state.highScore;
    if (roundedScore > state.highScore) {
      state.highScore = roundedScore;
      localStorage.setItem(STORAGE.highScore, String(state.highScore));
    }

    finalScore.textContent = String(roundedScore);
    finalHighScore.textContent = String(state.highScore);
    finalCoins.textContent = String(state.coins);
    newHighBadge.classList.toggle("hidden", !wasNewHigh);
    rewardInfo.textContent = state.lastRunBonusText || "";
    updateHud();
    showToast(`Run ended: ${roundedScore}`, "danger");
    haptic(50);

    audio.beep(180, 0.15, "sawtooth", 0.04);
    setTimeout(() => audio.beep(120, 0.22, "sawtooth", 0.04), 60);
  }

  function getWorldTimeScale() {
    return state.abilityActiveTime > 0 ? 0.55 : 1;
  }

  function activateAbility() {
    if (state.mode !== "playing" || state.abilityCooldown > 0) return;

    const axis = (state.input.left ? -1 : 0) + (state.input.right ? 1 : 0) + state.input.touchAxis;
    const dir = Math.abs(axis) > 0.01 ? Math.sign(axis) : state.lastMoveDir;

    state.player.vx += dir * 260;
    state.abilityActiveTime = 1.8;
    state.abilityCooldown = TUNE.abilityCooldownMax;

    audio.beep(680, 0.06, "triangle", 0.03);
    audio.beep(860, 0.05, "triangle", 0.02);
    showToast("Dash engaged", "info");
  }

  function spawnObstacle(now, bossType = false) {
    const isSmall = Math.random() < 0.56;
    const width = bossType ? randRange(58, 92) : isSmall ? randRange(26, 36) : randRange(40, 56);
    const height = bossType ? randRange(22, 34) : isSmall ? randRange(24, 34) : randRange(32, 46);

    const margin = 8;
    const maxX = WORLD.width - width - margin;
    let x = randRange(margin, maxX);

    if (!bossType && now - state.lastSpawnAt < 0.42 && state.lastSpawnX !== null) {
      const minXGap = 44;
      if (Math.abs(x - state.lastSpawnX) < minXGap) {
        x = x < WORLD.width * 0.5 ? Math.min(maxX, state.lastSpawnX + minXGap) : Math.max(margin, state.lastSpawnX - minXGap);
      }
    }

    let speed = (TUNE.baseScrollSpeed + state.level * 21 + randRange(-10, 18)) * state.speedMul;
    let vx = 0;

    if (bossType) {
      speed *= 1.18;
      vx = randRange(-85, 85);
    }

    state.obstacles.push({ x, y: -height - 2, width, height, speed, vx, scored: false, bossType });
    state.lastSpawnX = x;
    state.lastSpawnAt = now;

    if (!bossType) {
      const minDelay = clamp(0.64 - state.level * 0.02, 0.28, 0.64);
      const maxDelay = clamp(1.18 - state.level * 0.03, 0.44, 1.18);
      state.nextSpawnDelay = randRange(minDelay, maxDelay);

      if (Math.random() < 0.35) {
        spawnCoin(x + width * 0.5, -18, speed * randRange(0.88, 1.04));
      }
    }
  }

  function spawnCoin(x, y, speed) {
    state.collectibles.push({ type: "coin", x, y, width: 14, height: 14, speed, vx: 0, value: 1 });
  }

  function spawnPowerup() {
    const type = Math.random() < 0.5 ? "shield" : "magnet";
    const width = 18;
    const x = randRange(14, WORLD.width - width - 14);
    const speed = (TUNE.baseScrollSpeed + state.level * 10) * randRange(0.75, 0.95);

    state.collectibles.push({ type, x, y: -28, width, height: 18, speed, vx: randRange(-20, 20), value: 1 });
  }

  function spawnBossPattern(now) {
    const phase = state.boss.phase % 3;
    state.boss.phase += 1;

    if (phase === 0) {
      spawnObstacle(now, true);
    } else if (phase === 1) {
      spawnObstacle(now, true);
      spawnObstacle(now + 0.01, true);
    } else {
      const lanes = 5;
      const safeLane = Math.floor(randRange(0, lanes));
      for (let i = 0; i < lanes; i += 1) {
        if (i === safeLane) continue;

        const width = WORLD.width / lanes - 10;
        const x = i * (WORLD.width / lanes) + 5;
        state.obstacles.push({
          x,
          y: -30,
          width,
          height: 30,
          speed: (TUNE.baseScrollSpeed + state.level * 25) * 1.22,
          vx: 0,
          scored: false,
          bossType: true
        });
      }
    }
  }

  function startBossWave() {
    state.boss.active = true;
    state.boss.level = state.level;
    state.boss.timeLeft = 8.4;
    state.boss.spawnTimer = 0;
    state.boss.phase = 0;

    audio.beep(220, 0.08, "sawtooth", 0.04);
    audio.beep(260, 0.08, "sawtooth", 0.04);
    showToast("Boss wave incoming", "warn");
    haptic(26);
  }

  function emitParticles(x, y, color, count = 5) {
    const adjustedCount = prefersReducedMotion ? Math.max(1, Math.floor(count * 0.35)) : count;
    for (let i = 0; i < adjustedCount; i += 1) {
      state.particles.push({
        x,
        y,
        vx: randRange(-70, 70),
        vy: randRange(-30, -110),
        life: randRange(0.24, 0.46),
        maxLife: randRange(0.24, 0.46),
        radius: randRange(1.4, 3.2),
        color
      });
    }
  }

  function checkChallengeProgress() {
    const c = state.challenge;
    if (c.rewardGiven) return;

    if (c.type === "survive") c.progress = state.surviveTime;
    if (c.type === "dodge") c.progress = state.dodges;
    if (c.type === "coin") c.progress = state.coins;

    if (c.progress >= c.target) {
      c.completed = true;
      c.rewardGiven = true;
      localStorage.setItem(STORAGE.challengeDoneDate, c.dateKey);

      state.score += c.rewardScore;
      state.coins += c.rewardCoins;
      state.lastRunBonusText = `Daily reward claimed: +${c.rewardScore} score, +${c.rewardCoins} coins`;

      emitParticles(state.player.x + state.player.width * 0.5, state.player.y, "#ffd166", 12);
      audio.beep(820, 0.08, "triangle", 0.04);
      audio.beep(960, 0.08, "triangle", 0.03);
      showToast("Daily challenge complete", "success");
    }

    updateChallengeUI();
  }
  function roundRect(targetCtx, x, y, w, h, r) {
    const radius = Math.min(r, w * 0.5, h * 0.5);
    targetCtx.beginPath();
    targetCtx.moveTo(x + radius, y);
    targetCtx.arcTo(x + w, y, x + w, y + h, radius);
    targetCtx.arcTo(x + w, y + h, x, y + h, radius);
    targetCtx.arcTo(x, y + h, x, y, radius);
    targetCtx.arcTo(x, y, x + w, y, radius);
    targetCtx.closePath();
  }

  function drawBackground(timeMs) {
    const grad = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    grad.addColorStop(0, "#081120");
    grad.addColorStop(0.58, "#0d1c33");
    grad.addColorStop(1, "#13294e");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 6; i += 1) {
      const y = ((i * 112) + (timeMs * 0.032 * getWorldTimeScale())) % (WORLD.height + 140) - 140;
      ctx.fillStyle = i % 2 === 0 ? "#9ed2ff" : "#80f2cf";
      ctx.fillRect(0, y, WORLD.width, 3);
    }
    ctx.globalAlpha = 1;

    if (state.abilityActiveTime > 0) {
      ctx.fillStyle = "rgba(90, 180, 255, 0.09)";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    }
  }

  function drawPlayer() {
    const p = state.player;
    const skin = getSkin();

    const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
    grad.addColorStop(0, skin.player[0]);
    grad.addColorStop(1, skin.player[1]);

    ctx.fillStyle = grad;
    roundRect(ctx, p.x, p.y, p.width, p.height, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    roundRect(ctx, p.x + 5, p.y + 4, p.width - 10, 4, 2);
    ctx.fill();

    if (state.shieldCharges > 0) {
      ctx.strokeStyle = "rgba(164, 245, 208, 0.92)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x + p.width * 0.5, p.y + p.height * 0.5, 24, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawObstacles() {
    const skin = getSkin();

    for (const o of state.obstacles) {
      const palette = o.bossType ? skin.boss : skin.obstacle;
      const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.height);
      grad.addColorStop(0, palette[0]);
      grad.addColorStop(1, palette[1]);
      ctx.fillStyle = grad;

      roundRect(ctx, o.x, o.y, o.width, o.height, 6);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(o.x + 4, o.y + 4, Math.max(8, o.width * 0.45), 3);
    }
  }

  function drawCollectibles() {
    for (const item of state.collectibles) {
      if (item.type === "coin") {
        ctx.fillStyle = "#ffd166";
        ctx.beginPath();
        ctx.arc(item.x + 7, item.y + 7, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(item.x + 4, item.y + 3, 6, 2);
      } else if (item.type === "shield") {
        ctx.fillStyle = "#7ef9c7";
        roundRect(ctx, item.x, item.y, item.width, item.height, 4);
        ctx.fill();
        ctx.fillStyle = "#0f3526";
        ctx.fillRect(item.x + 8, item.y + 4, 2, 10);
      } else if (item.type === "magnet") {
        ctx.fillStyle = "#8fc9ff";
        roundRect(ctx, item.x, item.y, item.width, item.height, 4);
        ctx.fill();
        ctx.strokeStyle = "#0f2f48";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(item.x + 9, item.y + 9, 4, Math.PI * 0.15, Math.PI * 1.85);
        ctx.stroke();
      }
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color || "#77ffd6";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render(dt, timeMs) {
    ctx.save();

    if (!prefersReducedMotion && state.shakeTime > 0) {
      state.shakeTime = Math.max(0, state.shakeTime - dt);
      const intensity = state.shakeMag * (state.shakeTime / 0.38);
      ctx.translate(randRange(-intensity, intensity), randRange(-intensity, intensity));
    }

    drawBackground(timeMs);
    drawParticles();
    drawCollectibles();
    drawObstacles();
    drawPlayer();

    ctx.restore();
  }

  function tick(ts) {
    if (!state.lastTs) state.lastTs = ts;
    let dt = (ts - state.lastTs) / 1000;
    state.lastTs = ts;
    dt = Math.min(TUNE.maxDt, dt);

    update(dt, ts / 1000);
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec !== state.lastClockSecond) {
      state.lastClockSecond = nowSec;
      if (state.mode !== "playing") {
        updateChallengeUI();
      }
    }
    render(dt, ts);

    state.frameHandle = requestAnimationFrame(tick);
  }

  function setTouchFromEvent(clientX) {
    const rect = canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const left = localX < rect.width * 0.5;
    state.input.touchAxis = left ? -1 : 1;
    touchZoneLeft.classList.toggle("active", left);
    touchZoneRight.classList.toggle("active", !left);

    if (state.mode === "start") {
      startGame();
    }
  }

  function registerInput() {
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();

      if (key === "arrowleft" || key === "a") state.input.left = true;
      if (key === "arrowright" || key === "d") state.input.right = true;

      if (key === " ") {
        e.preventDefault();
        if (state.mode === "playing") pauseGame();
        else if (state.mode === "paused") resumeGame();
      }

      if (key === "f") activateAbility();
      if (key === "r" && state.mode === "start") resetHighScore();
      if (key === "l" && state.mode === "start") resetLeaderboard();
      if (key === "c" && state.mode === "start") cycleSkin();
      if (key === "escape" && state.mode === "settings") closeSettings();
    });

    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "a") state.input.left = false;
      if (key === "arrowright" || key === "d") state.input.right = false;
    });

    canvas.addEventListener("pointerdown", (e) => {
      state.input.pointerDown = true;
      state.input.swipeStartX = e.clientX;
      setTouchFromEvent(e.clientX);
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!state.input.pointerDown || state.input.swipeStartX === null) return;
      const dx = e.clientX - state.input.swipeStartX;
      if (Math.abs(dx) > 18) state.input.touchAxis = dx > 0 ? 1 : -1;
    });

    window.addEventListener("pointerup", () => {
      state.input.pointerDown = false;
      state.input.swipeStartX = null;
      touchZoneLeft.classList.remove("active");
      touchZoneRight.classList.remove("active");
    });
    window.addEventListener("pointercancel", () => {
      state.input.pointerDown = false;
      state.input.swipeStartX = null;
      touchZoneLeft.classList.remove("active");
      touchZoneRight.classList.remove("active");
    });

    startBtn.addEventListener("click", startGame);
    settingsBtn.addEventListener("click", openSettings);
    settingsBackBtn.addEventListener("click", closeSettings);
    skinBtn.addEventListener("click", cycleSkin);
    restartBtn.addEventListener("click", startGame);

    pauseBtn.addEventListener("click", () => {
      if (state.mode === "playing") pauseGame();
      else if (state.mode === "paused") resumeGame();
    });

    abilityBtn.addEventListener("click", activateAbility);
    dashFab.addEventListener("click", activateAbility);
    resumeBtn.addEventListener("click", resumeGame);
    homeBtnGameOver.addEventListener("click", backToHome);
    leaderboardToggleBtn.addEventListener("click", () => {
      state.leaderboardExpanded = !state.leaderboardExpanded;
      renderLeaderboard();
    });

    settingReducedMotion.addEventListener("change", () => {
      state.settings.reducedMotion = settingReducedMotion.checked;
      applyVisualSettings();
      saveSettings();
      showToast("Reduced motion updated", "info");
    });
    settingHighContrast.addEventListener("change", () => {
      state.settings.highContrast = settingHighContrast.checked;
      applyVisualSettings();
      saveSettings();
      showToast("Contrast updated", "info");
    });
    settingMute.addEventListener("change", () => {
      state.settings.mute = settingMute.checked;
      saveSettings();
      showToast(state.settings.mute ? "Audio muted" : "Audio unmuted", "info");
    });

    submitBtn.addEventListener("click", async () => {
      const name = window.prompt("Submit name (max 12 chars):", "YOU");
      if (name === null) return;
      await submitScore(name, Math.floor(state.score));
    });

    window.addEventListener("resize", resizeCanvas);
  }

  async function bootstrap() {
    skinBtn.textContent = `Skin: ${getSkin().name}`;

    bindReducedMotionPreference();
    ensureToastStack();
    applyVisualSettings();
    syncSettingsInputs();
    registerInput();
    resizeCanvas();
    updateHud();
    updateChallengeUI();
    setMode("start");

    state.leaderboard = loadLocalLeaderboard();
    renderLeaderboard();
    await refreshLeaderboard();

    state.lastTs = performance.now();
    state.frameHandle = requestAnimationFrame(tick);
  }

  bootstrap();
})();
