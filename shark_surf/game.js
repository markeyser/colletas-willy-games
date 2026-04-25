const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const W = 960;
const H = 620;
const SEA_TOP = 152;
const SAND_TOP = 456;
const GAME_TIME = 75;
const MAX_ACTIVE_SHARKS = 1;
const EASY_TIME = 16;
const PLAYER_SCALE = 0.72;
const PLAYER_MIN_DEPTH = -70;
const PLAYER_MAX_DEPTH = 108;
const PLAYER_VERTICAL_SPEED = 210;
const JUMP_POWER = 710;
const JUMP_GRAVITY = 1500;

const scoreColletas = document.getElementById('score-colletas');
const scoreWilly = document.getElementById('score-willy');
const timerEl = document.getElementById('timer');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const pauseBtn = document.getElementById('pause-btn');
const bannerEl = document.getElementById('surf-banner');
const winnerTitle = document.getElementById('winner-title');
const finalScores = document.getElementById('final-scores');

const keys = {
    p1Left: false,
    p1Right: false,
    p1Jump: false,
    p1Down: false,
    p2Left: false,
    p2Right: false,
    p2Jump: false,
    p2Down: false
};

const colors = {
    ink: '#10131f',
    sky: '#8de9f4',
    water: '#08aeea',
    deepWater: '#0576bb',
    foam: '#fffdf5',
    sand: '#f6df9a',
    palm: '#12b35d',
    trunk: '#9a571e'
};

const players = [
    {
        id: 'colletas',
        name: 'Colletas',
        x: 555,
        startX: 555,
        score: 0,
        body: '#ff3f86',
        board: '#24bd32',
        trunks: '#231c7b',
        head: '#a85d25',
        controls: { left: 'p1Left', right: 'p1Right', jump: 'p1Jump', down: 'p1Down' },
        depthY: 6,
        startDepthY: 6,
        rideTime: 0,
        jumpY: 0,
        jumpV: 0,
        fallTimer: 0,
        invincible: 0,
        wobble: 0,
        catchCount: 0,
        biteCount: 0
    },
    {
        id: 'willy',
        name: 'Willy',
        x: 405,
        startX: 405,
        score: 0,
        body: '#0949ff',
        board: '#f62722',
        trunks: '#1cc760',
        head: '#a85d25',
        controls: { left: 'p2Left', right: 'p2Right', jump: 'p2Jump', down: 'p2Down' },
        depthY: 6,
        startDepthY: 6,
        rideTime: 0,
        jumpY: 0,
        jumpV: 0,
        fallTimer: 0,
        invincible: 0,
        wobble: 0,
        catchCount: 0,
        biteCount: 0
    }
];

const game = {
    state: 'start',
    timeLeft: GAME_TIME,
    elapsed: 0,
    last: performance.now(),
    nextFish: 1,
    nextShark: 8,
    nextCoconut: 2.4,
    nextBreaker: 5,
    nextTsunami: 18,
    tsunamiWarning: 0,
    shake: 0,
    pausedTextTimer: 0
};

let fish = [];
let sharks = [];
let coconuts = [];
let breakers = [];
let popups = [];
let splashes = [];
let tsunami = null;
let audioCtx = null;
let melodyGain = null;
let melodyTimer = null;
let melodyStep = 0;

const MELODY_STEP_MS = 340;
const hawaiianLeadNotes = [
    659, null, 784, 880, null, 784, 659, null,
    587, null, 659, 784, null, 659, 587, null,
    523, null, 587, 659, null, 587, 523, null,
    494, null, 523, 587, null, 523, 494, null
];
const ukuleleChords = [
    [523, 659, 784],
    [523, 698, 880],
    [440, 523, 659],
    [494, 587, 784],
    [523, 659, 784],
    [523, 698, 880],
    [494, 587, 784],
    [523, 659, 784]
];

function rand(min, max) {
    return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(min, max, t) {
    return min + (max - min) * t;
}

function difficultyLevel() {
    const playableTime = Math.max(1, GAME_TIME - EASY_TIME);
    return clamp((game.elapsed - EASY_TIME) / playableTime, 0, 1);
}

function activeHazardCount() {
    const fallingCoconuts = coconuts.filter(coconut => coconut.y < SAND_TOP + 40).length;
    return sharks.length + breakers.length + fallingCoconuts + (tsunami || game.tsunamiWarning > 0 ? 1 : 0);
}

function maxActiveHazards() {
    const d = difficultyLevel();
    if (d < 0.35) return 1;
    if (d < 0.75) return 2;
    return 3;
}

function canAddHazard() {
    return activeHazardCount() < maxActiveHazards();
}

function waveY(x, t = game.elapsed) {
    return 322 +
        Math.sin((x * 0.014) + t * 2.0) * 33 +
        Math.sin((x * 0.031) - t * 1.2) * 11;
}

function waveSlope(x, t = game.elapsed) {
    const a = waveY(x - 4, t);
    const b = waveY(x + 4, t);
    return Math.atan2(b - a, 8);
}

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (!melodyGain) {
        melodyGain = audioCtx.createGain();
        melodyGain.gain.setValueAtTime(0.18, audioCtx.currentTime);
        melodyGain.connect(audioCtx.destination);
    }
}

function startMelody() {
    ensureAudio();
    if (melodyTimer) return;

    melodyStep = 0;
    if (melodyGain) {
        melodyGain.gain.cancelScheduledValues(audioCtx.currentTime);
        melodyGain.gain.setTargetAtTime(0.18, audioCtx.currentTime, 0.04);
    }
    scheduleMelodyNote();
}

function stopMelody() {
    if (melodyTimer) {
        clearTimeout(melodyTimer);
        melodyTimer = null;
    }
    if (melodyGain && audioCtx) {
        melodyGain.gain.cancelScheduledValues(audioCtx.currentTime);
        melodyGain.gain.setTargetAtTime(0.001, audioCtx.currentTime, 0.05);
    }
}

function playPluck(frequency, startOffset, duration, volume, type = 'triangle') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const start = audioCtx.currentTime + startOffset;
    const end = start + duration;

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain);
    gain.connect(melodyGain);
    osc.start(start);
    osc.stop(end + 0.05);
}

function playUkuleleStrum(chord) {
    const root = chord[0] / 2;
    playPluck(root, 0, 0.56, 0.18, 'sine');
    chord.forEach((note, index) => {
        playPluck(note, index * 0.035, 0.38, 0.28, 'triangle');
    });
}

function scheduleMelodyNote() {
    if (!audioCtx || game.state !== 'playing') {
        melodyTimer = null;
        return;
    }

    if (melodyStep % 4 === 0) {
        const chord = ukuleleChords[Math.floor(melodyStep / 4) % ukuleleChords.length];
        playUkuleleStrum(chord);
    }

    const note = hawaiianLeadNotes[melodyStep % hawaiianLeadNotes.length];
    if (note) {
        playPluck(note, 0.13, 0.3, 0.33, melodyStep % 8 === 2 ? 'sine' : 'triangle');
    }

    melodyStep += 1;
    melodyTimer = setTimeout(scheduleMelodyNote, MELODY_STEP_MS);
}

function playTone(kind) {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.001, now);

    if (kind === 'fish') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(720, now);
        osc.frequency.setValueAtTime(1040, now + 0.07);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.start(now);
        osc.stop(now + 0.26);
    } else if (kind === 'wipeout') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(262, now);
        osc.frequency.exponentialRampToValueAtTime(174, now + 0.36);
        gain.gain.exponentialRampToValueAtTime(0.085, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.48);
    } else if (kind === 'jump') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(760, now + 0.13);
        gain.gain.exponentialRampToValueAtTime(0.11, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.2);
    } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(247, now + 0.22);
        gain.gain.exponentialRampToValueAtTime(0.07, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.33);
    }
}

function resetGame() {
    game.state = 'playing';
    game.timeLeft = GAME_TIME;
    game.elapsed = 0;
    game.nextFish = 0.8;
    game.nextShark = 14;
    game.nextCoconut = 6;
    game.nextBreaker = 12;
    game.nextTsunami = 32;
    game.tsunamiWarning = 0;
    game.shake = 0;
    fish = [];
    sharks = [];
    coconuts = [];
    breakers = [];
    popups = [];
    splashes = [];
    tsunami = null;

    for (const player of players) {
        player.x = player.startX;
        player.depthY = player.startDepthY;
        player.score = 0;
        player.rideTime = 0;
        player.jumpY = 0;
        player.jumpV = 0;
        player.fallTimer = 0;
        player.invincible = 0;
        player.wobble = 0;
        player.catchCount = 0;
        player.biteCount = 0;
    }

    updateHud();
    bannerEl.textContent = '';
    startScreen.classList.add('is-hidden');
    gameOverScreen.classList.add('is-hidden');
    startMelody();
}

function updateHud() {
    scoreColletas.textContent = Math.floor(players[0].score).toString();
    scoreWilly.textContent = Math.floor(players[1].score).toString();
    timerEl.textContent = Math.max(0, Math.ceil(game.timeLeft)).toString();
}

function addPopup(x, y, text, color) {
    popups.push({ x, y, text, color, life: 1, vy: -34 });
}

function addSplash(x, y, color = colors.foam) {
    for (let i = 0; i < 12; i += 1) {
        splashes.push({
            x,
            y,
            vx: rand(-110, 110),
            vy: rand(-150, -30),
            r: rand(3, 8),
            color,
            life: rand(0.45, 0.9)
        });
    }
}

function addScore(player, amount, text, color) {
    player.score = Math.max(0, player.score + amount);
    if (text) addPopup(player.x, playerDrawY(player) - 105, text, color);
}

function knockPoints(player, amount, label, fall = false) {
    if (player.invincible > 0 || player.fallTimer > 0) return;

    player.score = Math.max(0, player.score - amount);
    player.rideTime = 0;
    player.invincible = fall ? 2.25 : 0.9;
    player.wobble = fall ? 0 : 0.65;
    game.shake = Math.max(game.shake, fall ? 0.42 : 0.2);
    addPopup(player.x, playerDrawY(player) - 108, `-${amount} ${label}`, '#ff174f');
    addSplash(player.x, waveY(player.x) + 8);
    playTone(fall ? 'wipeout' : 'bonk');

    if (fall) {
        player.fallTimer = 1.65;
        player.biteCount += label === 'bite' ? 1 : 0;
    }
}

function playerBaseY(player) {
    return waveY(player.x) + player.depthY;
}

function playerDrawY(player) {
    const bob = Math.sin(game.elapsed * 8 + player.x * 0.03) * 3;
    return playerBaseY(player) - 14 - player.jumpY + bob;
}

function playerHitbox(player) {
    const y = playerDrawY(player);
    return {
        x: player.x - 22,
        y: y - 92,
        w: 44,
        h: 88
    };
}

function headHitbox(player) {
    const y = playerDrawY(player);
    return {
        x: player.x - 17,
        y: y - 94,
        w: 34,
        h: 31
    };
}

function rectsOverlap(a, b) {
    return a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y;
}

function circleRectOverlap(cx, cy, r, rect) {
    const nearX = clamp(cx, rect.x, rect.x + rect.w);
    const nearY = clamp(cy, rect.y, rect.y + rect.h);
    const dx = cx - nearX;
    const dy = cy - nearY;
    return dx * dx + dy * dy <= r * r;
}

function spawnFish() {
    const x = rand(175, W - 95);
    const base = waveY(x) + rand(-36, 58);
    const palette = ['#ffb000', '#ff6f3c', '#ffee4a', '#57dcff', '#8bea49'];
    fish.push({
        x,
        y: base,
        base,
        age: 0,
        life: rand(1.55, 2.25),
        arc: rand(74, 132),
        vx: rand(-55, 55),
        color: palette[Math.floor(rand(0, palette.length))],
        caught: false,
        flip: Math.random() > 0.5 ? 1 : -1
    });
}

function spawnShark() {
    const d = difficultyLevel();
    const fromRight = Math.random() > 0.2;
    const x = fromRight ? W + 120 : -120;
    const slow = lerp(60, 92, d);
    const fast = lerp(80, 118, d);
    sharks.push({
        x,
        y: rand(308, 404),
        vx: fromRight ? rand(-fast, -slow) : rand(slow, fast),
        size: rand(0.46, lerp(0.62, 0.74, d)),
        bob: rand(0, Math.PI * 2),
        hit: {}
    });
}

function spawnCoconut() {
    const d = difficultyLevel();
    const target = players[Math.floor(rand(0, players.length))];
    const fromPalm = Math.random() > lerp(0.12, 0.28, d);
    coconuts.push({
        x: fromPalm ? rand(105, 235) : clamp(target.x + rand(-120, 120), 120, W - 80),
        y: fromPalm ? rand(84, 132) : rand(70, 120),
        vx: fromPalm ? rand(48, lerp(82, 118, d)) : rand(-18, 18),
        vy: rand(-28, 18),
        r: rand(9, lerp(12, 15, d)),
        gravity: lerp(210, 292, d),
        spin: rand(0, 6),
        hit: false
    });
}

function spawnBreaker() {
    const d = difficultyLevel();
    breakers.push({
        x: W + 70,
        w: rand(36, lerp(48, 64, d)),
        vx: rand(-lerp(76, 108, d), -lerp(58, 86, d)),
        hit: {}
    });
}

function spawnTsunami() {
    const d = difficultyLevel();
    tsunami = {
        x: -210,
        w: lerp(90, 124, d),
        vx: lerp(96, 134, d),
        hit: {},
        surfed: {}
    };
    addPopup(250, 150, 'TSUNAMI!', '#ffffff');
}

function update(dt) {
    if (game.state !== 'playing') {
        updateParticles(dt);
        updateBanner();
        return;
    }

    game.elapsed += dt;
    game.timeLeft -= dt;
    game.shake = Math.max(0, game.shake - dt);

    updatePlayers(dt);
    updateSpawns(dt);
    updateEntities(dt);
    updateCollisions();
    updateParticles(dt);
    updateBanner();
    updateHud();

    if (game.timeLeft <= 0) {
        finishGame();
    }
}

function updatePlayers(dt) {
    for (const player of players) {
        const left = keys[player.controls.left];
        const right = keys[player.controls.right];
        const jump = keys[player.controls.jump];
        const down = keys[player.controls.down];

        if (player.invincible > 0) player.invincible -= dt;
        if (player.wobble > 0) player.wobble -= dt;

        if (player.fallTimer > 0) {
            player.fallTimer -= dt;
            player.x = clamp(player.x + Math.sin(game.elapsed * 9 + player.startX) * 0.8, 72, W - 62);
            player.jumpY = 0;
            player.jumpV = 0;
            continue;
        }

        const movement = (right ? 1 : 0) - (left ? 1 : 0);
        const vertical = (down ? 1 : 0) - (jump ? 1 : 0);
        const slopeAssist = Math.sin(waveSlope(player.x)) * 30;
        player.x = clamp(player.x + (movement * 285 + slopeAssist) * dt, 72, W - 62);
        player.depthY = clamp(player.depthY + vertical * PLAYER_VERTICAL_SPEED * dt, PLAYER_MIN_DEPTH, PLAYER_MAX_DEPTH);

        if (jump && player.jumpY <= 0.1) {
            player.jumpV = JUMP_POWER;
            player.jumpY = 1;
            playTone('jump');
        }

        if (player.jumpY > 0 || player.jumpV > 0) {
            player.jumpV -= JUMP_GRAVITY * dt;
            player.jumpY += player.jumpV * dt;
            if (player.jumpY <= 0) {
                player.jumpY = 0;
                player.jumpV = 0;
                addSplash(player.x, waveY(player.x) + 7, '#cfffff');
            }
        }

        player.rideTime += dt;
        const streakBoost = 1 + Math.min(2.25, player.rideTime / 24);
        const waveBoost = 0.8 + Math.abs(Math.sin(waveSlope(player.x))) * 1.25;
        player.score += dt * 5.8 * streakBoost * waveBoost;

        const steep = Math.abs(waveSlope(player.x));
        if (steep > 0.78 && player.jumpY <= 2 && Math.random() < dt * 0.28) {
            addPopup(player.x, playerDrawY(player) - 108, 'wobble!', '#ffffff');
            player.wobble = Math.max(player.wobble, 0.38);
        }
    }
}

function updateSpawns(dt) {
    const d = difficultyLevel();
    game.nextFish -= dt;
    game.nextShark -= dt;
    game.nextCoconut -= dt;
    game.nextBreaker -= dt;

    if (game.nextFish <= 0) {
        spawnFish();
        game.nextFish = rand(0.85, 1.45);
    }

    if (game.nextShark <= 0 && canAddHazard() && sharks.length < MAX_ACTIVE_SHARKS && !tsunami && game.tsunamiWarning <= 0) {
        spawnShark();
        game.nextShark = rand(lerp(17, 10.5, d), lerp(23, 14.5, d));
    } else if (game.nextShark <= 0) {
        game.nextShark = rand(3, 4.5);
    }

    if (game.nextCoconut <= 0 && canAddHazard()) {
        spawnCoconut();
        game.nextCoconut = rand(lerp(7.5, 4.2, d), lerp(10, 6.2, d));
    } else if (game.nextCoconut <= 0) {
        game.nextCoconut = rand(2, 3);
    }

    if (game.nextBreaker <= 0 && canAddHazard()) {
        spawnBreaker();
        game.nextBreaker = rand(lerp(13, 8, d), lerp(17, 11, d));
    } else if (game.nextBreaker <= 0) {
        game.nextBreaker = rand(3, 4.5);
    }

    if (!tsunami && game.tsunamiWarning <= 0) {
        game.nextTsunami -= dt;
        if (game.nextTsunami <= 0 && canAddHazard()) {
            game.tsunamiWarning = lerp(4.4, 3.25, d);
        } else if (game.nextTsunami <= 0) {
            game.nextTsunami = rand(5, 7);
        }
    } else if (game.tsunamiWarning > 0) {
        game.tsunamiWarning -= dt;
        if (game.tsunamiWarning <= 0) {
            spawnTsunami();
            game.nextTsunami = rand(lerp(34, 25, d), lerp(42, 31, d));
        }
    }
}

function updateEntities(dt) {
    for (const item of fish) {
        item.age += dt;
        item.x += item.vx * dt;
        const p = clamp(item.age / item.life, 0, 1);
        item.y = item.base - Math.sin(p * Math.PI) * item.arc;
    }
    fish = fish.filter(item => item.age < item.life && !item.caught && item.x > 30 && item.x < W - 30);

    for (const shark of sharks) {
        shark.x += shark.vx * dt;
        shark.bob += dt * 4;
        shark.y += Math.sin(shark.bob) * 0.45;
    }
    sharks = sharks.filter(shark => shark.x > -190 && shark.x < W + 190);

    for (const coconut of coconuts) {
        coconut.spin += dt * 5;
        coconut.vy += coconut.gravity * dt;
        coconut.x += coconut.vx * dt;
        coconut.y += coconut.vy * dt;
    }
    coconuts = coconuts.filter(coconut => coconut.y < H + 80 && coconut.x > -80 && coconut.x < W + 90 && !coconut.hit);

    for (const breaker of breakers) {
        breaker.x += breaker.vx * dt;
    }
    breakers = breakers.filter(breaker => breaker.x + breaker.w > -40);

    if (tsunami) {
        tsunami.x += tsunami.vx * dt;
        if (tsunami.x > W + 240) {
            tsunami = null;
        }
    }
}

function updateCollisions() {
    for (const item of fish) {
        for (const player of players) {
            if (player.fallTimer > 0) continue;

            const box = playerHitbox(player);
            if (circleRectOverlap(item.x, item.y, 19, box)) {
                item.caught = true;
                player.catchCount += 1;
                addScore(player, 25, '+25 fish', '#058d3e');
                addSplash(item.x, item.y, item.color);
                playTone('fish');
                break;
            }
        }
    }

    for (const coconut of coconuts) {
        for (const player of players) {
            if (player.fallTimer > 0 || coconut.hit) continue;

            if (circleRectOverlap(coconut.x, coconut.y, coconut.r * 0.72, headHitbox(player))) {
                coconut.hit = true;
                knockPoints(player, 10, 'coconut');
                break;
            }
        }
    }

    for (const shark of sharks) {
        for (const player of players) {
            if (player.fallTimer > 0 || shark.hit[player.id]) continue;

            const sharkBox = {
                x: shark.x - 52 * shark.size,
                y: shark.y - 14 * shark.size,
                w: 104 * shark.size,
                h: 30 * shark.size
            };
            const boardBox = {
                x: player.x - 28,
                y: playerDrawY(player) - 12,
                w: 56,
                h: 24
            };

            if (rectsOverlap(sharkBox, boardBox) && player.jumpY < 22) {
                shark.hit[player.id] = true;
                knockPoints(player, 25, 'bite', true);
            }
        }
    }

    for (const breaker of breakers) {
        for (const player of players) {
            if (player.fallTimer > 0 || breaker.hit[player.id]) continue;

            const bx = breaker.x + breaker.w * 0.5;
            const by = waveY(breaker.x);
            const playerY = playerDrawY(player);
            if (Math.abs(player.x - bx) < breaker.w * 0.3 && Math.abs(playerY - by) < 34 && player.jumpY < 20) {
                breaker.hit[player.id] = true;
                knockPoints(player, 18, 'wave', true);
            }
        }
    }

    if (tsunami) {
        for (const player of players) {
            const insideWall = player.x > tsunami.x + 12 && player.x < tsunami.x + tsunami.w - 12;
            if (!insideWall) continue;

            if ((player.jumpY >= 54 || player.depthY < -42) && !tsunami.surfed[player.id]) {
                tsunami.surfed[player.id] = true;
                addScore(player, 20, '+20 big wave', '#ffffff');
                addSplash(player.x, waveY(player.x), '#e7ffff');
            } else if (player.jumpY < 54 && player.depthY >= -42 && !tsunami.hit[player.id]) {
                tsunami.hit[player.id] = true;
                knockPoints(player, 45, 'tsunami', true);
            }
        }
    }
}

function updateParticles(dt) {
    for (const popup of popups) {
        popup.life -= dt * 0.82;
        popup.y += popup.vy * dt;
    }
    popups = popups.filter(popup => popup.life > 0);

    for (const splash of splashes) {
        splash.life -= dt;
        splash.vy += 290 * dt;
        splash.x += splash.vx * dt;
        splash.y += splash.vy * dt;
    }
    splashes = splashes.filter(splash => splash.life > 0);
}

function updateBanner() {
    if (game.state === 'paused') {
        bannerEl.textContent = 'Paused';
        return;
    }

    if (game.tsunamiWarning > 0) {
        bannerEl.textContent = 'TSUNAMI!';
        return;
    }

    const bestRide = Math.max(players[0].rideTime, players[1].rideTime);
    if (game.state === 'playing' && bestRide > 12 && Math.floor(bestRide) % 9 < 2) {
        bannerEl.textContent = 'Long ride!';
        return;
    }

    bannerEl.textContent = '';
}

function finishGame() {
    game.state = 'gameover';
    stopMelody();
    const colletasScore = Math.floor(players[0].score);
    const willyScore = Math.floor(players[1].score);
    const winner = colletasScore === willyScore
        ? 'Tie wave!'
        : colletasScore > willyScore
            ? 'Colletas wins!'
            : 'Willy wins!';

    winnerTitle.textContent = winner;
    finalScores.textContent = `Colletas ${colletasScore} · Willy ${willyScore}`;
    gameOverScreen.classList.remove('is-hidden');
}

function togglePause() {
    if (game.state === 'playing') {
        game.state = 'paused';
        stopMelody();
    } else if (game.state === 'paused') {
        game.state = 'playing';
        game.last = performance.now();
        startMelody();
    }
}

function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();

    if (game.shake > 0) {
        ctx.translate(rand(-7, 7) * game.shake, rand(-7, 7) * game.shake);
    }

    drawBackground();
    drawCoconuts();
    drawFish();
    drawSharks();
    drawBreakers();
    drawTsunami();
    drawSplashes();

    const orderedPlayers = [...players].sort((a, b) => playerDrawY(a) - playerDrawY(b));
    for (const player of orderedPlayers) drawPlayer(player);

    drawPopups();
    ctx.restore();
}

function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, SEA_TOP);
    sky.addColorStop(0, '#aaf5ff');
    sky.addColorStop(1, '#70e2f1');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, SEA_TOP + 22);

    ctx.save();
    ctx.fillStyle = 'rgba(6, 22, 34, 0.9)';
    ctx.font = 'bold 92px "Comic Sans MS", "Arial Rounded MT Bold", sans-serif';
    ctx.fillText('Shark surf', 172, 92);
    ctx.restore();

    drawCloud(755, 126, 0.75);
    drawCloud(835, 122, 0.55);

    ctx.fillStyle = colors.deepWater;
    ctx.fillRect(0, SEA_TOP, W, 22);

    const water = ctx.createLinearGradient(0, SEA_TOP, 0, SAND_TOP + 55);
    water.addColorStop(0, '#049fda');
    water.addColorStop(0.52, '#0ab8ee');
    water.addColorStop(1, '#14c4df');
    ctx.fillStyle = water;
    ctx.fillRect(0, SEA_TOP + 18, W, SAND_TOP + 35);

    drawRollingWaterLines();
    drawBeach();
    drawPalm();
    drawBeachBoard();
}

function drawRollingWaterLines() {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let row = 0; row < 4; row += 1) {
        ctx.beginPath();
        const yBase = 230 + row * 52;
        for (let x = -20; x <= W + 20; x += 18) {
            const y = yBase + Math.sin(x * 0.018 + game.elapsed * (1.2 + row * 0.22)) * (12 + row * 2);
            if (x === -20) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = row === 3 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)';
        ctx.lineWidth = row === 3 ? 5 : 3;
        ctx.stroke();
    }

    for (let x = 90; x < W; x += 180) {
        ctx.strokeStyle = 'rgba(7, 66, 130, 0.32)';
        ctx.lineWidth = 3;
        sketchLine(x, 210 + Math.sin(game.elapsed + x) * 14, x + 18, 210 + Math.sin(game.elapsed + x) * 14);
    }

    ctx.restore();
}

function drawBeach() {
    ctx.save();
    ctx.fillStyle = colors.sand;
    ctx.beginPath();
    ctx.moveTo(0, SAND_TOP);
    for (let x = 0; x <= W; x += 28) {
        const y = SAND_TOP + Math.sin(x * 0.015 + 1.7) * 18 + Math.sin(x * 0.006) * 9;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = colors.foam;
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 28) {
        const y = SAND_TOP + Math.sin(x * 0.015 + 1.7) * 18 + Math.sin(x * 0.006) * 9;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(151, 113, 51, 0.17)';
    for (let i = 0; i < 20; i += 1) {
        const x = (i * 77 + 35) % W;
        const y = 505 + ((i * 31) % 95);
        ctx.beginPath();
        ctx.ellipse(x, y, 7, 4, 0.2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawPalm() {
    ctx.save();
    ctx.translate(36, 92);
    ctx.scale(0.72, 0.72);

    ctx.save();
    ctx.translate(120, 322);
    ctx.rotate(-0.32);
    ctx.fillStyle = colors.trunk;
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-28, 166);
    ctx.bezierCurveTo(-10, 80, 7, 25, 31, -12);
    ctx.lineTo(62, -8);
    ctx.bezierCurveTo(28, 50, 11, 94, -3, 172);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(150, 206);
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 5;

    const leaves = [
        [-88, -35, 82, 40, -0.35],
        [-35, -70, 98, 45, -1.05],
        [48, -62, 94, 42, -2.45],
        [88, -5, 91, 43, -2.95],
        [30, 46, 92, 42, 2.6],
        [-70, 30, 86, 39, 0.25]
    ];
    for (const leaf of leaves) {
        ctx.save();
        ctx.translate(leaf[0], leaf[1]);
        ctx.rotate(leaf[4]);
        ctx.fillStyle = colors.palm;
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf[2], leaf[3], 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    ctx.fillStyle = '#f6e2b5';
    ctx.beginPath();
    ctx.arc(-26, 2, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 7;
    sketchLine(-42, -12, -11, 17);
    sketchLine(-11, -12, -42, 17);

    ctx.fillStyle = colors.foam;
    for (const spot of [[-82, -38], [-94, 20], [-10, -68], [55, -37], [84, 2], [18, 48]]) {
        ctx.save();
        ctx.translate(spot[0], spot[1]);
        ctx.rotate(0.4);
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
    ctx.restore();
}

function drawBeachBoard() {
    ctx.save();
    ctx.translate(898, 440);
    ctx.strokeStyle = '#b46e00';
    ctx.lineWidth = 5;
    ctx.fillStyle = '#f5a31c';
    ctx.beginPath();
    ctx.moveTo(0, -108);
    ctx.bezierCurveTo(37, -62, 35, 52, 0, 112);
    ctx.bezierCurveTo(-35, 52, -37, -62, 0, -108);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#b46e00';
    ctx.lineWidth = 3;
    sketchLine(0, -84, 0, 86);
    sketchLine(-18, -40, -12, 74);
    sketchLine(18, -40, 12, 74);
    ctx.restore();
}

function drawCloud(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = colors.foam;
    for (const part of [[0, 0, 36, 16], [33, -7, 31, 21], [67, 0, 37, 17], [96, 5, 24, 12]]) {
        ctx.beginPath();
        ctx.ellipse(part[0], part[1], part[2], part[3], 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawFish() {
    for (const item of fish) {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.scale(item.flip, 1);
        ctx.rotate(Math.cos(item.age * 5) * 0.18);
        ctx.fillStyle = item.color;
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-20, 0);
        ctx.lineTo(-38, -15);
        ctx.lineTo(-36, 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = colors.ink;
        ctx.beginPath();
        ctx.arc(8, -4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawSharks() {
    for (const shark of sharks) {
        ctx.save();
        ctx.translate(shark.x, shark.y);
        const facing = shark.vx < 0 ? 1 : -1;
        ctx.scale(facing * shark.size, shark.size);
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = 5;
        ctx.fillStyle = '#4dbde2';
        ctx.beginPath();
        ctx.moveTo(-80, 0);
        ctx.bezierCurveTo(-45, -40, 40, -42, 82, -1);
        ctx.bezierCurveTo(40, 36, -46, 35, -80, 0);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#d9f6ff';
        ctx.beginPath();
        ctx.moveTo(-50, 13);
        ctx.bezierCurveTo(-8, 35, 46, 24, 78, 0);
        ctx.bezierCurveTo(40, 16, -5, 17, -50, 13);
        ctx.fill();

        ctx.fillStyle = '#4dbde2';
        ctx.beginPath();
        ctx.moveTo(-82, 0);
        ctx.lineTo(-126, -32);
        ctx.lineTo(-112, 0);
        ctx.lineTo(-126, 35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-4, -30);
        ctx.lineTo(18, -76);
        ctx.lineTo(33, -25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = colors.ink;
        ctx.beginPath();
        ctx.arc(48, -14, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 7; i += 1) {
            ctx.beginPath();
            ctx.moveTo(42 + i * 5, 9);
            ctx.lineTo(47 + i * 5, 23);
            ctx.lineTo(52 + i * 5, 9);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
}

function drawCoconuts() {
    for (const coconut of coconuts) {
        ctx.save();
        ctx.translate(coconut.x, coconut.y);
        ctx.rotate(coconut.spin);
        drawCoconutShape(0, 0, coconut.r);
        ctx.restore();
    }
}

function drawCoconutShape(x, y, r) {
    ctx.fillStyle = '#a55c22';
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = Math.max(3, r * 0.22);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(78, 37, 12, 0.35)';
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.18, r * 0.13, 0, Math.PI * 2);
    ctx.arc(x + r * 0.12, y - r * 0.2, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
}

function drawBreakers() {
    for (const breaker of breakers) {
        const y = waveY(breaker.x);
        ctx.save();
        ctx.translate(breaker.x, y);
        ctx.strokeStyle = colors.foam;
        ctx.fillStyle = colors.foam;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-breaker.w * 0.52, 18);
        ctx.bezierCurveTo(-breaker.w * 0.18, -38, breaker.w * 0.33, -48, breaker.w * 0.48, 13);
        ctx.lineTo(breaker.w * 0.25, 21);
        ctx.bezierCurveTo(breaker.w * 0.1, -13, -breaker.w * 0.2, -12, -breaker.w * 0.38, 24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#bff9ff';
        ctx.lineWidth = 4;
        sketchLine(-breaker.w * 0.3, 10, breaker.w * 0.3, 12);
        ctx.restore();
    }
}

function drawTsunami() {
    if (!tsunami) return;

    ctx.save();
    ctx.translate(tsunami.x, 0);
    ctx.fillStyle = '#35c9ee';
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, SAND_TOP + 28);
    ctx.lineTo(0, 286);
    ctx.bezierCurveTo(30, 244, 92, 236, tsunami.w, 292);
    ctx.lineTo(tsunami.w, SAND_TOP + 32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.foam;
    ctx.beginPath();
    ctx.moveTo(0, 286);
    ctx.bezierCurveTo(30, 244, 92, 236, tsunami.w, 292);
    ctx.bezierCurveTo(tsunami.w * 0.78, 285, tsunami.w * 0.6, 300, tsunami.w * 0.48, 326);
    ctx.bezierCurveTo(tsunami.w * 0.3, 303, tsunami.w * 0.15, 300, 0, 314);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#e4ffff';
    ctx.lineWidth = 5;
    for (let i = 0; i < 4; i += 1) {
        sketchLine(16 + i * 22, 338 + i * 18, 52 + i * 18, 348 + i * 20);
    }
    ctx.restore();
}

function drawSplashes() {
    for (const splash of splashes) {
        ctx.save();
        ctx.globalAlpha = clamp(splash.life, 0, 1);
        ctx.fillStyle = splash.color;
        ctx.beginPath();
        ctx.ellipse(splash.x, splash.y, splash.r, splash.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawPlayer(player) {
    const y = playerDrawY(player);
    const fall = player.fallTimer > 0;
    const invBlink = player.invincible > 0 && Math.floor(game.elapsed * 12) % 2 === 0;

    ctx.save();
    ctx.translate(player.x, y);
    ctx.rotate(fall ? Math.sin(game.elapsed * 11) * 0.8 + 0.9 : waveSlope(player.x) + Math.sin(game.elapsed * 12) * player.wobble * 0.18);
    ctx.scale(PLAYER_SCALE, PLAYER_SCALE);

    if (!invBlink) {
        drawSurfBoard(player.board, fall);
        drawStickKid(player, fall);
    }

    if (fall) {
        ctx.save();
        ctx.rotate(-0.9);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        for (let i = 0; i < 5; i += 1) {
            ctx.beginPath();
            ctx.ellipse(-35 + i * 18, 18 + Math.sin(i) * 8, 16, 7, 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    ctx.restore();
}

function drawSurfBoard(color, fall) {
    ctx.save();
    ctx.rotate(fall ? 0.7 : -0.1);
    ctx.fillStyle = color;
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 6, 62, 14, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = color === '#f62722' ? '#ffd236' : '#ccff55';
    ctx.lineWidth = 3;
    sketchLine(-33, 5, 28, -1);
    sketchLine(-16, 11, 32, 4);
    ctx.restore();
}

function drawStickKid(player, fall) {
    ctx.save();
    ctx.translate(0, fall ? 7 : 0);
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    sketchLine(-11, -5, -16, -39);
    sketchLine(11, -4, 17, -38);

    ctx.fillStyle = player.body;
    ctx.beginPath();
    roundRect(ctx, -18, -91, 36, 58, 5);
    ctx.fill();
    ctx.stroke();

    sketchLine(-19, -75, -50, -45);
    sketchLine(19, -75, 49, -47);

    ctx.fillStyle = player.head;
    ctx.beginPath();
    ctx.arc(0, -122, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-19, -147, 10, 0, Math.PI * 2);
    ctx.arc(19, -147, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.ink;
    ctx.beginPath();
    ctx.arc(-10, -127, 4.5, 0, Math.PI * 2);
    ctx.arc(10, -127, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-1, -118, 14, 0.2, Math.PI - 0.2);
    ctx.stroke();

    if (player.id === 'colletas') {
        ctx.fillStyle = '#ff7ba7';
        ctx.beginPath();
        ctx.ellipse(12, -113, 5, 9, 0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function drawPopups() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px "Comic Sans MS", "Arial Rounded MT Bold", sans-serif';
    for (const popup of popups) {
        ctx.globalAlpha = clamp(popup.life, 0, 1);
        ctx.lineWidth = 5;
        ctx.strokeStyle = colors.ink;
        ctx.strokeText(popup.text, popup.x, popup.y);
        ctx.fillStyle = popup.color;
        ctx.fillText(popup.text, popup.x, popup.y);
    }
    ctx.restore();
}

function sketchLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function roundRect(context, x, y, width, height, radius) {
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
}

function handleKey(event, isDown) {
    const key = event.key.toLowerCase();
    const controlKeys = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', 'p', ' '];
    if (controlKeys.includes(key)) event.preventDefault();

    if (key === 'a') keys.p1Left = isDown;
    if (key === 'd') keys.p1Right = isDown;
    if (key === 'w') keys.p1Jump = isDown;
    if (key === 's') keys.p1Down = isDown;
    if (event.key === 'ArrowLeft') keys.p2Left = isDown;
    if (event.key === 'ArrowRight') keys.p2Right = isDown;
    if (event.key === 'ArrowUp') keys.p2Jump = isDown;
    if (event.key === 'ArrowDown') keys.p2Down = isDown;

    if (isDown && (key === 'p' || key === ' ')) togglePause();
}

function bindTouchButton(id, keyName) {
    const button = document.getElementById(id);
    const down = (event) => {
        event.preventDefault();
        ensureAudio();
        keys[keyName] = true;
        button.setPointerCapture?.(event.pointerId);
    };
    const up = (event) => {
        event.preventDefault();
        keys[keyName] = false;
    };

    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('pointerleave', up);
}

window.addEventListener('keydown', (event) => handleKey(event, true), { passive: false });
window.addEventListener('keyup', (event) => handleKey(event, false), { passive: false });

bindTouchButton('p1-left', 'p1Left');
bindTouchButton('p1-right', 'p1Right');
bindTouchButton('p1-jump', 'p1Jump');
bindTouchButton('p1-down', 'p1Down');
bindTouchButton('p2-left', 'p2Left');
bindTouchButton('p2-right', 'p2Right');
bindTouchButton('p2-jump', 'p2Jump');
bindTouchButton('p2-down', 'p2Down');

startBtn.addEventListener('click', () => {
    ensureAudio();
    resetGame();
});

restartBtn.addEventListener('click', () => {
    ensureAudio();
    resetGame();
});

pauseBtn.addEventListener('click', () => {
    ensureAudio();
    togglePause();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') {
        game.state = 'paused';
        stopMelody();
    }
});

function frame(now) {
    const dt = Math.min(0.033, Math.max(0, (now - game.last) / 1000));
    game.last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
}

draw();
requestAnimationFrame(frame);
