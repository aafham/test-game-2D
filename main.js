(() => {
  "use strict";

  const STORAGE_KEY = "dodge_run_high_score";
  const WORLD_WIDTH = 360;
  const WORLD_HEIGHT = 640;

  const MAX_DT = 1 / 30;
  const BASE_SCROLL_SPEED = 110;
  const BASE_PLAYER_ACCEL = 2800;
  const BASE_PLAYER_MAX_SPEED = 360;
  const FRICTION = 8.5;

  const LEVEL_INTERVAL = 12;
  const MAX_LEVEL = 20;

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const canvasWrap = document.getElementById("canvasWrap");
  const hud = document.getElementById("hud");

  const startScreen = document.getElementById("startScreen");
  const pauseScreen = document.getElementById("pauseScreen");
  const gameOverScreen = document.getElementById("gameOverScreen");

  const scoreValue = document.getElementById("scoreValue");
  const highScoreValue = document.getElementById("highScoreValue");
  const levelValue = document.getElementById("levelValue");
  const speedValue = document.getElementById("speedValue");
  const finalScore = document.getElementById("finalScore");
  const finalHighScore = document.getElementById("finalHighScore");

  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resumeBtn = document.getElementById("resumeBtn");
  const restartBtn = document.getElementById("restartBtn");

  const state = {
    mode: "start", // start | playing | paused | gameover
    score: 0,
    highScore: Number(localStorage.getItem(STORAGE_KEY) || 0),
    surviveTime: 0,

    level: 1,
    speedMul: 1,

    player: {
      x: WORLD_WIDTH * 0.5 - 22,
      y: WORLD_HEIGHT - 72,
      width: 44,
      height: 24,
      vx: 0,
      ax: 0
    },

    obstacles: [],
    particles: [],

    spawnTimer: 0,
    nextSpawnDelay: randRange(0.75, 1.2),
    lastSpawnX: null,
    lastSpawnAt: -999,

    shakeTime: 0,
    shakeMag: 0,

    input: {
      left: false,
      right: false,
      touchAxis: 0,
      swipeStartX: null,
      pointerDown: false
    },

    frameHandle: null,
    lastTs: 0
  };

  const audio = makeAudio();

  function resetHighScore() {
    state.highScore = 0;
    localStorage.removeItem(STORAGE_KEY);
    updateHud();
  }

  // Make reset function globally callable for quick testing/debug.
  window.resetHighScore = resetHighScore;

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

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function aabb(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function showOverlay(el) {
    [startScreen, pauseScreen, gameOverScreen].forEach((node) => {
      node.classList.toggle("active", node === el);
    });
  }

  function setMode(mode) {
    state.mode = mode;

    if (mode === "start") showOverlay(startScreen);
    if (mode === "paused") showOverlay(pauseScreen);
    if (mode === "gameover") showOverlay(gameOverScreen);
    if (mode === "playing") showOverlay(null);
  }

  function updateHud() {
    scoreValue.textContent = Math.floor(state.score).toString();
    highScoreValue.textContent = state.highScore.toString();
    levelValue.textContent = state.level.toString();
    speedValue.textContent = `${state.speedMul.toFixed(2)}x`;
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(WORLD_WIDTH * dpr);
    canvas.height = Math.floor(WORLD_HEIGHT * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const maxW = window.innerWidth - 24;
    const maxH = window.innerHeight - hud.offsetHeight - 40;

    const scale = Math.max(0.45, Math.min(maxW / WORLD_WIDTH, maxH / WORLD_HEIGHT));

    canvas.style.width = `${Math.floor(WORLD_WIDTH * scale)}px`;
    canvas.style.height = `${Math.floor(WORLD_HEIGHT * scale)}px`;

    canvasWrap.style.width = canvas.style.width;
  }

  function resetRunState() {
    state.score = 0;
    state.surviveTime = 0;
    state.level = 1;
    state.speedMul = 1;

    state.player.x = WORLD_WIDTH * 0.5 - state.player.width * 0.5;
    state.player.y = WORLD_HEIGHT - 72;
    state.player.vx = 0;
    state.player.ax = 0;

    state.obstacles = [];
    state.particles = [];

    state.spawnTimer = 0;
    state.nextSpawnDelay = randRange(0.75, 1.2);
    state.lastSpawnX = null;
    state.lastSpawnAt = -999;

    state.shakeTime = 0;
    state.shakeMag = 0;

    state.input.left = false;
    state.input.right = false;
    state.input.touchAxis = 0;

    updateHud();
  }

  function startGame() {
    audio.init();
    audio.beep(500, 0.06, "triangle", 0.02);

    resetRunState();
    setMode("playing");
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

    state.shakeTime = 0.35;
    state.shakeMag = 7;

    const roundedScore = Math.floor(state.score);
    if (roundedScore > state.highScore) {
      state.highScore = roundedScore;
      localStorage.setItem(STORAGE_KEY, String(state.highScore));
    }

    finalScore.textContent = String(roundedScore);
    finalHighScore.textContent = String(state.highScore);
    updateHud();

    audio.beep(180, 0.15, "sawtooth", 0.04);
    setTimeout(() => audio.beep(120, 0.22, "sawtooth", 0.04), 60);
  }

  function spawnObstacle(now) {
    const isSmall = Math.random() < 0.55;
    const width = isSmall ? randRange(26, 36) : randRange(40, 56);
    const height = isSmall ? randRange(24, 34) : randRange(32, 46);

    const margin = 8;
    const maxX = WORLD_WIDTH - width - margin;
    let x = randRange(margin, maxX);

    // Reduce impossible streaks by pushing x away from very recent spawn.
    if (now - state.lastSpawnAt < 0.4 && state.lastSpawnX !== null) {
      const minXGap = 44;
      if (Math.abs(x - state.lastSpawnX) < minXGap) {
        if (x < WORLD_WIDTH * 0.5) x = Math.min(maxX, state.lastSpawnX + minXGap);
        else x = Math.max(margin, state.lastSpawnX - minXGap);
      }
    }

    const speed = (BASE_SCROLL_SPEED + state.level * 22 + randRange(-12, 18)) * state.speedMul;

    state.obstacles.push({
      x,
      y: -height - 2,
      width,
      height,
      speed,
      scored: false
    });

    state.lastSpawnX = x;
    state.lastSpawnAt = now;

    const minDelay = clamp(0.62 - state.level * 0.02, 0.3, 0.62);
    const maxDelay = clamp(1.15 - state.level * 0.03, 0.46, 1.15);
    state.nextSpawnDelay = randRange(minDelay, maxDelay);
  }

  function emitPassParticles(x, y) {
    const count = 5;
    for (let i = 0; i < count; i += 1) {
      state.particles.push({
        x,
        y,
        vx: randRange(-50, 50),
        vy: randRange(-20, -90),
        life: randRange(0.2, 0.4),
        maxLife: randRange(0.2, 0.4),
        radius: randRange(1.4, 3.3)
      });
    }
  }

  function updatePlayer(dt) {
    const inputAxis =
      (state.input.left ? -1 : 0) +
      (state.input.right ? 1 : 0) +
      state.input.touchAxis;

    state.player.ax = clamp(inputAxis, -1, 1) * BASE_PLAYER_ACCEL;

    state.player.vx += state.player.ax * dt;

    // Smooth deceleration when no direct input.
    if (Math.abs(inputAxis) < 0.001) {
      const drag = Math.exp(-FRICTION * dt);
      state.player.vx *= drag;
      if (Math.abs(state.player.vx) < 4) state.player.vx = 0;
    }

    state.player.vx = clamp(state.player.vx, -BASE_PLAYER_MAX_SPEED, BASE_PLAYER_MAX_SPEED);
    state.player.x += state.player.vx * dt;

    const minX = 8;
    const maxX = WORLD_WIDTH - state.player.width - 8;
    if (state.player.x < minX) {
      state.player.x = minX;
      state.player.vx = 0;
    }
    if (state.player.x > maxX) {
      state.player.x = maxX;
      state.player.vx = 0;
    }

    // Tap input should be a short impulse, not continuous hold.
    state.input.touchAxis *= Math.exp(-12 * dt);
    if (Math.abs(state.input.touchAxis) < 0.01) state.input.touchAxis = 0;
  }

  function updateObstacles(dt, now) {
    state.spawnTimer += dt;
    if (state.spawnTimer >= state.nextSpawnDelay) {
      state.spawnTimer = 0;
      spawnObstacle(now);
    }

    for (let i = state.obstacles.length - 1; i >= 0; i -= 1) {
      const o = state.obstacles[i];
      o.y += o.speed * dt;

      if (!o.scored && o.y > WORLD_HEIGHT) {
        o.scored = true;
        state.score += 10;
        emitPassParticles(o.x + o.width * 0.5, WORLD_HEIGHT - 8);
        audio.beep(740, 0.04, "square", 0.02);
      }

      if (o.y > WORLD_HEIGHT + 120) {
        state.obstacles.splice(i, 1);
        continue;
      }

      if (aabb(state.player, o)) {
        endGame();
        return;
      }
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;

      if (p.life <= 0) {
        state.particles.splice(i, 1);
      }
    }
  }

  function update(dt, now) {
    if (state.mode !== "playing") return;

    state.surviveTime += dt;
    state.score += dt * 8; // Survive-time score.

    const targetLevel = Math.min(MAX_LEVEL, 1 + Math.floor(state.surviveTime / LEVEL_INTERVAL));
    state.level = targetLevel;
    state.speedMul = 1 + (state.level - 1) * 0.09;

    updatePlayer(dt);
    updateObstacles(dt, now);
    updateParticles(dt);

    const roundedScore = Math.floor(state.score);
    if (roundedScore > state.highScore) {
      state.highScore = roundedScore;
      localStorage.setItem(STORAGE_KEY, String(state.highScore));
    }

    updateHud();
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    grad.addColorStop(0, "#081120");
    grad.addColorStop(0.55, "#0d1c33");
    grad.addColorStop(1, "#13294e");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.globalAlpha = 0.09;
    for (let i = 0; i < 6; i += 1) {
      const y = ((i * 110) + (performance.now() * 0.03)) % (WORLD_HEIGHT + 140) - 140;
      ctx.fillStyle = i % 2 === 0 ? "#9ed2ff" : "#80f2cf";
      ctx.fillRect(0, y, WORLD_WIDTH, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    const p = state.player;
    const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
    grad.addColorStop(0, "#7fffd4");
    grad.addColorStop(1, "#2bc48a");

    ctx.fillStyle = grad;
    roundRect(ctx, p.x, p.y, p.width, p.height, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    roundRect(ctx, p.x + 5, p.y + 4, p.width - 10, 4, 2);
    ctx.fill();
  }

  function drawObstacles() {
    for (const o of state.obstacles) {
      const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.height);
      grad.addColorStop(0, "#ff8ca0");
      grad.addColorStop(1, "#ff476e");
      ctx.fillStyle = grad;

      roundRect(ctx, o.x, o.y, o.width, o.height, 6);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(o.x + 4, o.y + 4, Math.max(8, o.width * 0.5), 3);
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#77ffd6";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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

  function render(dt) {
    ctx.save();

    if (state.shakeTime > 0) {
      state.shakeTime = Math.max(0, state.shakeTime - dt);
      const intensity = state.shakeMag * (state.shakeTime / 0.35);
      const dx = randRange(-intensity, intensity);
      const dy = randRange(-intensity, intensity);
      ctx.translate(dx, dy);
    }

    drawBackground();
    drawParticles();
    drawObstacles();
    drawPlayer();

    ctx.restore();
  }

  function tick(ts) {
    if (!state.lastTs) state.lastTs = ts;
    let dt = (ts - state.lastTs) / 1000;
    state.lastTs = ts;
    dt = Math.min(MAX_DT, dt);

    update(dt, ts / 1000);
    render(dt);

    state.frameHandle = requestAnimationFrame(tick);
  }

  function setTouchFromEvent(clientX) {
    const rect = canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const isLeft = localX < rect.width * 0.5;

    // A quick impulse gives responsive touch control.
    state.input.touchAxis = isLeft ? -1 : 1;

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

      if (key === "r" && state.mode === "start") {
        resetHighScore();
      }
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
      if (Math.abs(dx) > 18) {
        state.input.touchAxis = dx > 0 ? 1 : -1;
      }
    });

    window.addEventListener("pointerup", () => {
      state.input.pointerDown = false;
      state.input.swipeStartX = null;
    });

    startBtn.addEventListener("click", startGame);
    restartBtn.addEventListener("click", startGame);
    pauseBtn.addEventListener("click", () => {
      if (state.mode === "playing") pauseGame();
      else if (state.mode === "paused") resumeGame();
    });
    resumeBtn.addEventListener("click", resumeGame);

    window.addEventListener("resize", resizeCanvas);
  }

  function bootstrap() {
    registerInput();
    resizeCanvas();
    updateHud();
    setMode("start");

    state.lastTs = performance.now();
    state.frameHandle = requestAnimationFrame(tick);
  }

  bootstrap();
})();
