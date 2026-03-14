const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI
const score1Display = document.getElementById('score1');
const score2Display = document.getElementById('score2');
const timerDisplay = document.getElementById('timer');
const countdownDisplay = document.getElementById('countdown');
const pauseIndicatorDisplay = document.getElementById('pauseIndicator');
const gameOverDisplay = document.getElementById('gameOver');
const finalScoreDisplay = document.getElementById('finalScore');
const winnerDisplay = document.getElementById('winner');

// Audio
const catchSound = document.getElementById('catchSound');
const powerupSound = document.getElementById('powerupSound');
const bonkSound = document.getElementById('bonkSound');
const music = document.getElementById('music');

// Game constants
const GAME_DURATION = 60;
const PLAYER_WIDTH = 60;
const PLAYER_HEIGHT = 40;
const PLAYER_BASE_SPEED = 4;
const PLAYER_BOOST_SPEED = 6;
const CANDY_SIZE = 18;
const INITIAL_SPAWN_INTERVAL = 900;
const MIN_SPAWN_INTERVAL = 450;

const CANDY_TYPES = {
  SWEET: 'SWEET',
  MEGA: 'MEGA',
  SOUR: 'SOUR',
  ROCKET: 'ROCKET',
  BOSS: 'BOSS',
};

const CANDY_PROPS = {
  [CANDY_TYPES.SWEET]: { color: '#ff79c6', score: 1, sound: catchSound },
  [CANDY_TYPES.MEGA]: { color: '#ffd166', score: 3, sound: powerupSound },
  [CANDY_TYPES.SOUR]: { color: '#7a3b3b', score: -2, sound: bonkSound },
  [CANDY_TYPES.ROCKET]: { color: '#6dd3ff', score: 0, sound: powerupSound, effect: 'boost', duration: 5000 },
  [CANDY_TYPES.BOSS]: { color: '#ff5252', score: 20, sound: powerupSound },
};

let keysPressed = {};
let candies = [];
let clouds = [];
let confetti = [];
let popups = [];
let timerValue = GAME_DURATION;
let timerInterval = null;
let gameLoopId = null;
let lastSpawnTime = 0;
let currentSpawnInterval = INITIAL_SPAWN_INTERVAL;
let isPaused = false;
let isGameOver = true;
let isCountingDown = false;
let bossSpawned = false;

// --- High Scores ---
let hsCoasterColletas = parseInt(localStorage.getItem('candyCoaster_hsColletas') || '0');
let hsCoasterWilly = parseInt(localStorage.getItem('candyCoaster_hsWilly') || '0');

// --- Parallax Backdrop ---
const parallaxLayers = [
    { speed: 0.015, color: '#e1bee7', height: 180 }, // Distant candy hills
    { speed: 0.045, color: '#ce93d8', height: 120 }  // Mid candy trees
];

const players = [
  createPlayer(canvas.width * 0.28, 'Collets', '#8b5a2b', { left: 'a', right: 'd' }),
  createPlayer(canvas.width * 0.72, 'Willy', '#6f4e37', { left: 'ArrowLeft', right: 'ArrowRight' }),
];

function createPlayer(x, name, color, controls) {
  return {
    x,
    y: canvas.height - 120,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    name,
    color,
    controls,
    score: 0,
    speed: PLAYER_BASE_SPEED,
    boostTimer: null,
    bobPhase: Math.random() * Math.PI * 2,
    sprite: name === 'Collets' ? 'ribbon' : 'cap',
    stats: { sweets: 0, mega: 0, sour: 0, rocket: 0, boss: 0 },
    wheelRotation: 0
  };
}

function spawnPopup(x, y, text, color) {
  popups.push({ x, y, text, color, life: 1 });
}

function trackHeight(x) {
  return 320 + Math.sin(x * 0.012) * 60 + Math.sin(x * 0.035) * 30;
}

function trackSlope(x) {
  const dx = 0.1;
  return (trackHeight(x + dx) - trackHeight(x - dx)) / (2 * dx);
}

function resetGame() {
  players.forEach((p, idx) => {
    p.x = canvas.width * (idx === 0 ? 0.28 : 0.72);
    p.y = trackHeight(p.x) - p.height;
    p.score = 0;
    p.speed = PLAYER_BASE_SPEED;
    if (p.boostTimer) clearTimeout(p.boostTimer);
    p.boostTimer = null;
    p.stats = { sweets: 0, mega: 0, sour: 0, rocket: 0, boss: 0 };
    p.wheelRotation = 0;
  });
  candies = [];
  confetti = [];
  popups = [];
  bossSpawned = false;
  timerValue = GAME_DURATION;
  currentSpawnInterval = INITIAL_SPAWN_INTERVAL;
  lastSpawnTime = 0;
  updateScores();
  timerDisplay.textContent = `Time: ${timerValue}`;
  hideOverlay(gameOverDisplay);
  hideOverlay(pauseIndicatorDisplay);
  isGameOver = false;
  isPaused = false;
}

function startCountdown() {
  isCountingDown = true;
  let count = 3;
  showOverlay(countdownDisplay, count);
  const interval = setInterval(() => {
    count -= 1;
    if (count === 0) {
      hideOverlay(countdownDisplay);
      clearInterval(interval);
      isCountingDown = false;
      startTimer();
      gameLoopId = requestAnimationFrame(gameLoop);
      tryPlayMusic();
    } else {
      showOverlay(countdownDisplay, count);
    }
  }, 800);
}

function startTimer() {
  timerInterval = setInterval(() => {
    if (!isPaused) {
      timerValue -= 1;
      timerDisplay.textContent = `Time: ${timerValue}`;
      
      // Spawn Rate Progression
      let spawnReduction = 5;
      const progress = (GAME_DURATION - timerValue) / GAME_DURATION;
      if (progress > 0.75) spawnReduction = 15; // Sugar Rush spawn rate boost
      
      currentSpawnInterval = Math.max(MIN_SPAWN_INTERVAL, currentSpawnInterval - spawnReduction);
      
      if (timerValue <= 0) {
        endGame();
      }
    }
  }, 1000);
}

function gameLoop(timestamp) {
  if (isPaused || isCountingDown || isGameOver) {
    drawScene();
    gameLoopId = requestAnimationFrame(gameLoop);
    return;
  }

  if (timestamp - lastSpawnTime > currentSpawnInterval) {
    spawnCandy();
    lastSpawnTime = timestamp;
  }

  updatePlayers();
  updateCandies();
  updateConfetti();
  updatePopups();
  
  // Boss Spawn at 10s
  if (timerValue <= 10 && !bossSpawned) {
    bossSpawned = true;
    candies.push({
      x: canvas.width / 2,
      y: -50,
      size: 60,
      speed: 1.5,
      type: CANDY_TYPES.BOSS,
      wiggle: 0
    });
  }

  drawScene();

  gameLoopId = requestAnimationFrame(gameLoop);
}

function updatePlayers() {
  players.forEach((p) => {
    if (keysPressed[p.controls.left]) p.x -= p.speed;
    if (keysPressed[p.controls.right]) p.x += p.speed;
    const margin = 40 + p.width / 2;
    p.x = Math.max(margin, Math.min(canvas.width - margin, p.x));

    // Bobbing while moving
    const moving = keysPressed[p.controls.left] || keysPressed[p.controls.right];
    p.bobPhase += moving ? 0.25 : 0.08;
    const bob = Math.sin(p.bobPhase) * (moving ? 3 : 1.2);
    p.y = trackHeight(p.x) - p.height + bob;
    
    // Wheel Rotation
    const dir = keysPressed[p.controls.left] ? -1 : (keysPressed[p.controls.right] ? 1 : 0);
    p.wheelRotation += dir * p.speed * 0.1;
  });
}

function spawnCandy() {
  const rand = Math.random();
  let type = CANDY_TYPES.SWEET;
  if (rand > 0.78 && rand <= 0.92) type = CANDY_TYPES.MEGA;
  else if (rand > 0.92) type = CANDY_TYPES.ROCKET;
  else if (rand > 0.6) type = CANDY_TYPES.SOUR;

  candies.push({
    x: 40 + Math.random() * (canvas.width - 80),
    y: -20,
    speed: 1.3 + Math.random() * 1.2,
    type,
    wiggle: Math.random() * Math.PI * 2,
  });
}

function updateCandies() {
  const progress = (GAME_DURATION - timerValue) / GAME_DURATION;
  const speedMult = progress > 0.75 ? 1.5 : 1.0;

  for (let i = candies.length - 1; i >= 0; i -= 1) {
    const c = candies[i];
    c.y += c.speed * speedMult;
    c.wiggle += 0.08;
    c.x += Math.sin(c.wiggle) * 0.6;

    if (c.y > canvas.height + 20) {
      candies.splice(i, 1);
      continue;
    }

    const props = CANDY_PROPS[c.type];
    players.forEach((p) => {
      const left = p.x - p.width / 2;
      const right = p.x + p.width / 2;
      const top = p.y - p.height * 0.3;
      const bottom = p.y + p.height + 12;
      
      const cSize = c.type === CANDY_TYPES.BOSS ? 30 : CANDY_SIZE;
      const hit = c.x > left - cSize && c.x < right + cSize && c.y > top && c.y < bottom;
      
      if (hit) {
        props.sound.currentTime = 0;
        props.sound.play();
        p.score += props.score;
        
        // Track stats
        if (c.type === CANDY_TYPES.SWEET) p.stats.sweets++;
        else if (c.type === CANDY_TYPES.MEGA) p.stats.mega++;
        else if (c.type === CANDY_TYPES.SOUR) p.stats.sour++;
        else if (c.type === CANDY_TYPES.ROCKET) p.stats.rocket++;
        else if (c.type === CANDY_TYPES.BOSS) p.stats.boss++;

        // Popups
        const popText = props.score > 0 ? `+${props.score}` : `${props.score}`;
        spawnPopup(p.x, p.y - 40, c.type === CANDY_TYPES.BOSS ? 'SUPER SWEET! +20' : popText, props.color);
        if (props.effect === 'boost') spawnPopup(p.x, p.y - 60, 'SUGAR BOOST!', '#6dd3ff');

        if (props.effect === 'boost') applyBoost(p, props.duration);
        spawnConfetti(c.x, c.y, props.color, c.type === CANDY_TYPES.BOSS ? 20 : 6);
        candies.splice(i, 1);
        updateScores(props.score >= 0 ? p : null, props.score < 0 ? p : null);
      }
    });
  }
}

function updatePopups() {
  for (let i = popups.length - 1; i >= 0; i--) {
    popups[i].y -= 1.2;
    popups[i].life -= 0.016;
    if (popups[i].life <= 0) popups.splice(i, 1);
  }
}

function applyBoost(player, duration) {
  player.speed = PLAYER_BOOST_SPEED;
  if (player.boostTimer) clearTimeout(player.boostTimer);
  player.boostTimer = setTimeout(() => {
    player.speed = PLAYER_BASE_SPEED;
    player.boostTimer = null;
  }, duration);
}

function updateConfetti() {
  for (let i = confetti.length - 1; i >= 0; i -= 1) {
    const p = confetti[i];
    p.life -= 1;
    p.y += p.vy;
    p.x += p.vx;
    p.vy += 0.05;
    if (p.life <= 0) confetti.splice(i, 1);
  }
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSky();
  drawClouds();
  drawParallax();
  drawTrack();
  drawCandies();
  drawPlayers();
  drawConfetti();
  drawPopups();
}

function drawParallax() {
    parallaxLayers.forEach(layer => {
        ctx.fillStyle = layer.color;
        const itemWidth = 200;
        const offset = (Date.now() * layer.speed) % itemWidth;
        for (let x = -offset; x < canvas.width; x += itemWidth) {
            ctx.beginPath();
            ctx.arc(x + itemWidth/2, canvas.height, layer.height, Math.PI, 0);
            ctx.fill();
            // Candy topping on hill
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.arc(x + itemWidth/2, canvas.height - layer.height * 0.2, itemWidth/4, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = layer.color;
        }
    });
}

function drawPopups() {
    popups.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.font = 'bold 20px "Fredoka One", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1.0;
}

function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  const progress = (GAME_DURATION - timerValue) / GAME_DURATION;
  
  if (progress > 0.75) { // Sugar Rush (Sunset/Pink/Yellow)
      grad.addColorStop(0, '#f48fb1'); // Pink
      grad.addColorStop(1, '#fff59d'); // Yellowish
  } else {
      grad.addColorStop(0, '#dff6ff');
      grad.addColorStop(1, '#b9e3ff');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawClouds() {
  if (!clouds.length) {
    for (let i = 0; i < 6; i += 1) {
      clouds.push({
        x: Math.random() * canvas.width,
        y: 40 + Math.random() * 160,
        scale: 0.8 + Math.random() * 0.6,
        drift: 0.2 + Math.random() * 0.3,
      });
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  clouds.forEach((c) => {
    c.x += c.drift;
    if (c.x > canvas.width + 80) c.x = -80;
    drawCloudShape(c.x, c.y, c.scale);
  });
}

function drawCloudShape(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(0, 0, 24, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(26, -18, 26, Math.PI * 1, Math.PI * 1.85);
  ctx.arc(60, -6, 32, Math.PI * 1.2, Math.PI * 1.9);
  ctx.arc(84, 14, 22, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTrack() {
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#8b5a2b';
  ctx.beginPath();
  ctx.moveTo(0, trackHeight(0));
  for (let x = 0; x <= canvas.width; x += 8) {
    ctx.lineTo(x, trackHeight(x));
  }
  ctx.stroke();

  // Rail ties
  ctx.strokeStyle = '#b37a42';
  ctx.lineWidth = 3;
  for (let x = 0; x <= canvas.width; x += 28) {
    const y = trackHeight(x);
    const slope = trackSlope(x);
    const angle = Math.atan(slope);
    const tieLength = 26;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-tieLength / 2, 0);
    ctx.lineTo(tieLength / 2, 0);
    ctx.stroke();
    ctx.restore();
  }
}

function drawCandies() {
  candies.forEach((c) => {
    const prop = CANDY_PROPS[c.type];
    ctx.fillStyle = prop.color;
    
    if (c.type === CANDY_TYPES.BOSS) {
        // Giant Lollipop or complex candy
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
        ctx.shadowColor = prop.color;
        ctx.shadowBlur = 15 + pulse * 10;
        
        ctx.beginPath();
        ctx.arc(c.x, c.y, 30, 0, Math.PI * 2);
        ctx.fill();
        
        // Swirl
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const r = i * 3;
            const a = i * 0.8 + Date.now() * 0.01;
            ctx.lineTo(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    } else {
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, CANDY_SIZE * 0.7, CANDY_SIZE, Math.sin(c.wiggle) * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(c.x + 5, c.y - 6, 4, 0, Math.PI * 2);
        ctx.fill();
    }
  });
}

function drawPlayers() {
  players.forEach((p) => {
    const slope = trackSlope(p.x);
    const angle = Math.atan(slope);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle * 0.6); // soften tilt

    // Cart
    ctx.fillStyle = '#4e3525';
    ctx.fillRect(-p.width / 2, 4, p.width, p.height);
    ctx.fillStyle = '#c69c6d';
    ctx.fillRect(-p.width / 2 + 6, 10, p.width - 12, p.height - 12);
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(-p.width / 2 + 6, -10, p.width - 12, 16);

    // Wheels
    ctx.fillStyle = '#2f2f2f';
    [-p.width/3, p.width/3].forEach(off => {
        ctx.save();
        ctx.translate(off, p.height + 6);
        ctx.rotate(p.wheelRotation);
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b0bec5';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        // Hubcap detail
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
        ctx.moveTo(0, -6); ctx.lineTo(0, 6);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#2f2f2f';
    });

    // Character
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.width / 2 + 8, -p.height * 0.2, p.width - 16, p.height * 0.8);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-8, -p.height * 0.05, 6, 0, Math.PI * 2);
    ctx.arc(8, -p.height * 0.05, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-8, -p.height * 0.02, 3, 0, Math.PI * 2);
    ctx.arc(8, -p.height * 0.02, 3, 0, Math.PI * 2);
    ctx.fill();

    if (p.sprite === 'ribbon') {
      // Pigtails with sway
      const sway = Math.sin(Date.now() / 150) * 4;
      ctx.fillStyle = p.color;
      // Ties
      ctx.fillStyle = '#ff8fb1';
      ctx.fillRect(-p.width / 2 + 2, -p.height * 0.25, 10, 8);
      ctx.fillRect(p.width / 2 - 12, -p.height * 0.25, 10, 8);
      // Actual hair
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.width / 2 - 4, -p.height * 0.1 + sway, 8, 16);
      ctx.fillRect(p.width / 2 - 4, -p.height * 0.1 - sway, 8, 16);
    } else {
      ctx.fillStyle = '#2d9bf0';
      ctx.fillRect(-6, -p.height * 0.3, 12, 8);
    }

    ctx.restore();
  });
}

function spawnConfetti(x, y, color, count = 6) {
  for (let i = 0; i < count; i += 1) {
    confetti.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: -2 + Math.random() * -1,
      life: 40 + Math.random() * 20,
      color,
    });
  }
}

function drawConfetti() {
  confetti.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 6);
  });
}

function updateScores(goodPlayer, badPlayer) {
  score1Display.textContent = `Collets: ${players[0].score}`;
  score2Display.textContent = `Willy: ${players[1].score}`;

  const updateClass = (el, cls) => {
    if (!el) return;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 160);
  };
  if (goodPlayer === players[0]) updateClass(score1Display, 'score-pop');
  if (goodPlayer === players[1]) updateClass(score2Display, 'score-pop');
  if (badPlayer === players[0]) updateClass(score1Display, 'score-bad-pop');
  if (badPlayer === players[1]) updateClass(score2Display, 'score-bad-pop');
}

function endGame() {
  isGameOver = true;
  hideOverlay(countdownDisplay);
  
  // Awards Logic
  const getAwards = (p) => {
    let awards = [];
    if (p.stats.sweets > 20) awards.push("👑 Sweet King");
    if (p.stats.mega > 5) awards.push("✨ Candy Collector");
    if (p.stats.boss > 0) awards.push("🍭 Super Sweet");
    if (p.stats.rocket > 3) awards.push("🎢 Rocket Rider");
    return awards.length > 0 ? awards.join(" | ") : "🌟 Good Effort!";
  };

  // Save High Scores
  if (players[0].score > hsCoasterColletas) {
      hsCoasterColletas = players[0].score;
      localStorage.setItem('candyCoaster_hsColletas', hsCoasterColletas);
  }
  if (players[1].score > hsCoasterWilly) {
      hsCoasterWilly = players[1].score;
      localStorage.setItem('candyCoaster_hsWilly', hsCoasterWilly);
  }

  const awardsP1 = getAwards(players[0]);
  const awardsP2 = getAwards(players[1]);

  finalScoreDisplay.innerHTML = `
      <div style="margin-bottom:10px;">
         <b>Collets:</b> ${players[0].score} (Best: ${hsCoasterColletas})<br/>
         <small style="color:#FFD700">${awardsP1}</small>
      </div>
      <div style="margin-bottom:10px;">
         <b>Willy:</b> ${players[1].score} (Best: ${hsCoasterWilly})<br/>
         <small style="color:#FFD700">${awardsP2}</small>
      </div>
  `;
  
  if (players[0].score === players[1].score) {
    winnerDisplay.textContent = 'It is a tie!';
  } else {
    const champ = players[0].score > players[1].score ? 'Collets' : 'Willy';
    winnerDisplay.textContent = `${champ} rules the rails!`;
  }

  showOverlay(gameOverDisplay);
  clearInterval(timerInterval);
  if (music) music.pause();
}

function restartGame() {
  resetGame();
  startCountdown();
}

function togglePause() {
  if (isGameOver || isCountingDown) return;
  isPaused = !isPaused;
  if (isPaused) {
    showOverlay(pauseIndicatorDisplay);
    if (music) music.pause();
    // Silence any active one-shots
    [catchSound, powerupSound, bonkSound].forEach(s => {
        if (s) { s.pause(); s.currentTime = 0; }
    });
  } else {
    hideOverlay(pauseIndicatorDisplay);
    tryPlayMusic();
  }
}

function showOverlay(node, text) {
  if (text !== undefined) node.textContent = text;
  node.style.display = 'block';
}

function hideOverlay(node) {
  node.style.display = 'none';
}

function tryPlayMusic() {
  const wasPaused = music.paused;
  if (wasPaused) {
    music.volume = 0.25;
    music.play().catch(() => {}); // browsers may block auto-play
  }
}

// Input
document.addEventListener('keydown', (e) => {
  keysPressed[e.key] = true;
  if (e.key.toLowerCase() === 'p') togglePause();
  if (isGameOver && e.key === ' ') {
    restartGame();
  }
});
document.addEventListener('keyup', (e) => {
  keysPressed[e.key] = false;
});

// --- Touch / Mouse Controls ---
function setupTouchControls() {
    const bindButton = (btnId, keyStr) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        const press = (e) => {
            e.preventDefault();
            keysPressed[keyStr] = true;
        };

        const release = (e) => {
            e.preventDefault();
            keysPressed[keyStr] = false;
        };

        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release, { passive: false });
        btn.addEventListener('touchcancel', release, { passive: false });

        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
    };

    // P1 (Collets)
    bindButton('btn-p1-left', 'a');
    bindButton('btn-p1-right', 'd');

    // P2 (Willy)
    bindButton('btn-p2-left', 'ArrowLeft');
    bindButton('btn-p2-right', 'ArrowRight');

    // Pause Button
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) {
        const handlePause = (e) => {
            e.preventDefault();
            togglePause();
        };
        pauseBtn.addEventListener('touchstart', handlePause, { passive: false });
        pauseBtn.addEventListener('mousedown', handlePause);
    }
}

// Boot
setupTouchControls();
resetGame();
startCountdown();
