/**
 * Space Dodge
 * A Willi and Coletas Game!
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');
const finalScoreEl = document.getElementById('final-score');
const winScoreEl = document.getElementById('win-score');

// Touch Buttons
const btnP1Left = document.getElementById('btn-p1-left');
const btnP1Right = document.getElementById('btn-p1-right');
const btnP2Left = document.getElementById('btn-p2-left');
const btnP2Right = document.getElementById('btn-p2-right');
const btnPause = document.getElementById('btn-pause');

// Game State
let gameState = 'START'; // START, PLAYING, PAUSED, GAMEOVER, VICTORY
let timeLeft = 60;
let scoreP1 = 0;
let scoreP2 = 0;
let speed = 2.0; // Starts very slow for kids
let animationId;
let lastTimeUpdate = 0;
let invulnP1 = 0;
let invulnP2 = 0;
let shieldP1 = 0;
let shieldP2 = 0;
let popups = []; // Floating score text
let hsColletas = parseInt(localStorage.getItem('spaceDodge_hsColletas') || '0');
let hsWilly = parseInt(localStorage.getItem('spaceDodge_hsWilly') || '0');
let shakeTimer = 0;
let planets = []; // Background planet fly-bys
let bossSpawned = false;
let particles = []; // For collection effects

// Per-player stats for end-of-game awards
let statsP1 = { stars: 0, ufos: 0, shields: 0, hits: 0 };
let statsP2 = { stars: 0, ufos: 0, shields: 0, hits: 0 };

// Audio System (MP3 for BGM, Web Audio API for SFX)
const bgMusic = new Audio('music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.6;
const crashMp3 = new Audio('crash.wav');

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let bgmOscillator = null;

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    if (type === 'crash') {
        crashMp3.currentTime = 0;
        crashMp3.play().catch(e => console.log(e));
        return;
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'start') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 1.5);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
        osc.start(now);
        osc.stop(now + 1.5);
    } else if (type === 'collect') {
        // Short coin-like ding for collectibles
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1320, now + 0.08);
        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
    } else if (type === 'shield') {
        // Power-up chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.1);
        osc.frequency.setValueAtTime(784, now + 0.2);
        osc.frequency.setValueAtTime(1047, now + 0.3);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'win') {
        osc.type = 'sine';
        const freqs = [440, 554.37, 659.25, 880];
        freqs.forEach((freq, i) => {
            osc.frequency.setValueAtTime(freq, now + (i * 0.15));
        });
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
    }
}

function spawnPopup(x, y, text, color) {
    popups.push({ x, y, text, color, life: 1.0 });
}

function spawnCollectionParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            size: Math.random() * 3 + 1,
            color: color,
            life: 1.0
        });
    }
}

function startBGM() {
    // We use the MP3 instead of synthesized oscillator
    bgMusic.play().catch(e => console.log('BGM restricted by browser', e));
}

function stopBGM() {
    bgMusic.pause();
}

// Entities
const players = {
    colletas: { x: 250, y: 450, width: 50, height: 80, speed: 6, color: '#ff3399', hatColor: '#ffff00', headColor: '#e67300', isLeft: false, isRight: false },
    willy: { x: 500, y: 450, width: 50, height: 80, speed: 6, color: '#00ccff', hatColor: '#0055ff', headColor: '#8b4513', isLeft: false, isRight: false }
};

let obstacles = [];
let stars = [];

// Initialize Background Stars
for(let i=0; i<100; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 1 + 0.5,
        twinkle: Math.random() > 0.8,
        twinkleSpeed: 0.05 + Math.random() * 0.1,
        opacity: Math.random()
    });
}

const moon = { y: 550 }; // Starts visible, scrolls down
const earth = { y: -200, size: 80 }; // Appears at the very end

// Input Handling
document.addEventListener('keydown', (e) => {
    if (e.key === 'a' || e.key === 'A') players.colletas.isLeft = true;
    if (e.key === 'd' || e.key === 'D') players.colletas.isRight = true;
    if (e.key === 'ArrowLeft') players.willy.isLeft = true;
    if (e.key === 'ArrowRight') players.willy.isRight = true;
    if (e.key === 'p' || e.key === 'P') togglePause();
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'a' || e.key === 'A') players.colletas.isLeft = false;
    if (e.key === 'd' || e.key === 'D') players.colletas.isRight = false;
    if (e.key === 'ArrowLeft') players.willy.isLeft = false;
    if (e.key === 'ArrowRight') players.willy.isRight = false;
});

// Touch Controls
function setupButton(btn, player, dir) {
    const press = (e) => { e.preventDefault(); player[dir] = true; };
    const release = (e) => { e.preventDefault(); player[dir] = false; };
    btn.addEventListener('touchstart', press, {passive: false});
    btn.addEventListener('mousedown', press);
    btn.addEventListener('touchend', release, {passive: false});
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
}

setupButton(btnP1Left, players.colletas, 'isLeft');
setupButton(btnP1Right, players.colletas, 'isRight');
setupButton(btnP2Left, players.willy, 'isLeft');
setupButton(btnP2Right, players.willy, 'isRight');

btnPause.addEventListener('click', () => { togglePause(); });
btnPause.addEventListener('touchstart', (e) => { e.preventDefault(); togglePause(); }, {passive: false});

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', startGame);

function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        stopBGM();
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        startBGM();
        gameLoop();
    }
}

function startGame() {
    // Reset State
    timeLeft = 60;
    scoreP1 = 50;
    scoreP2 = 50;
    speed = 2.0; // Starts very slow for kids
    obstacles = [];
    popups = [];
    moon.y = 550;
    earth.y = -200;
    invulnP1 = 0;
    invulnP2 = 0;
    shieldP1 = 0;
    shieldP2 = 0;
    shakeTimer = 0;
    planets = [];
    bossSpawned = false;
    particles = [];
    statsP1 = { stars: 0, ufos: 0, shields: 0, hits: 0 };
    statsP2 = { stars: 0, ufos: 0, shields: 0, hits: 0 };
    lastTimeUpdate = Date.now();
    
    players.colletas.x = 250;
    players.willy.x = 500;
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    victoryScreen.classList.add('hidden');
    
    gameState = 'PLAYING';
    
    // Audio Context might need user gesture
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    bgMusic.currentTime = 0;
    
    playSound('start');
    startBGM();
    gameLoop();
}

function spawnObstacle() {
    // Quadratic curve: gentle at start, steep ramp in last 20s
    const difficultyProgress = (60 - timeLeft) / 60;
    const curve = difficultyProgress * difficultyProgress; // quadratic: 0→0.25→1
    const spawnChance = 0.005 + (curve * 0.04);
    
    if (Math.random() < spawnChance) { 
        const size = Math.random() * 30 + 20;
        let rng = Math.random();
        let obsType = 'meteorite';
        if (rng > 0.94) obsType = 'shield';   // ~6% chance
        else if (rng > 0.87) obsType = 'ufo'; // ~7% chance
        else if (rng > 0.62) obsType = 'star'; // ~25% chance
        
        // Add horizontal drift for meteorites in the last 20 seconds
        let vx = 0;
        if (obsType === 'meteorite' && timeLeft < 20) {
            vx = (Math.random() - 0.5) * (3 + (20 - timeLeft) * 0.3);
        }
        
        obstacles.push({
            x: Math.random() * (canvas.width - size),
            y: -50,
            radius: size,
            type: obsType,
            vx: vx
        });
    }
}

// Drawing Functions
function drawColletas(x, y, w, h) {
    // Ship Body (Pink)
    ctx.fillStyle = players.colletas.color;
    ctx.beginPath();
    ctx.moveTo(x + w/2, y); // nose
    ctx.lineTo(x + w, y + h); // right tail
    ctx.lineTo(x, y + h); // left tail
    ctx.fill();

    // Wings/Fins (Aesthetic Polish)
    ctx.fillStyle = players.colletas.color;
    ctx.beginPath();
    ctx.moveTo(x, y + h - 20); // Left wing
    ctx.lineTo(x - 15, y + h);
    ctx.lineTo(x + 5, y + h);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w, y + h - 20); // Right wing
    ctx.lineTo(x + w + 15, y + h);
    ctx.lineTo(x + w - 5, y + h);
    ctx.fill();
    
    // Flame — scales with speed
    const flameLen = 20 + (speed * 3) + Math.random() * 10;
    ctx.fillStyle = '#ff9900';
    ctx.beginPath();
    ctx.moveTo(x + w/4, y + h);
    ctx.lineTo(x + w/2, y + h + flameLen);
    ctx.lineTo(x + w*3/4, y + h);
    ctx.fill();
    // Inner flame
    if (speed > 4) {
        ctx.fillStyle = '#ffff66';
        ctx.beginPath();
        ctx.moveTo(x + w/3, y + h);
        ctx.lineTo(x + w/2, y + h + flameLen * 0.6);
        ctx.lineTo(x + w*2/3, y + h);
        ctx.fill();
    }

    // Hair (Brown Pigtails)
    const hairSway = Math.sin(Date.now() / 150) * 5;
    ctx.fillStyle = '#663300';
    // Back of hair
    ctx.fillRect(x + 8, y - 22, 34, 15);
    // Pigtail Left
    ctx.beginPath();
    ctx.arc(x + 5, y - 10 + hairSway, 8, 0, Math.PI * 2);
    ctx.fill();
    // Pigtail Right
    ctx.beginPath();
    ctx.arc(x + 45, y - 10 - hairSway, 8, 0, Math.PI * 2);
    ctx.fill();

    // Colletas Head (Orange Square)
    ctx.fillStyle = players.colletas.headColor;
    ctx.fillRect(x + 10, y - 20, 30, 30);
    
    // Smile and eyes
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(x + 20, y - 10, 2, 0, Math.PI*2); // L eye
    ctx.arc(x + 30, y - 10, 2, 0, Math.PI*2); // R eye
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 25, y - 5, 5, 0, Math.PI); // smile
    ctx.stroke();

    // Hat (Yellow Triangle)
    ctx.fillStyle = players.colletas.hatColor;
    ctx.beginPath();
    ctx.moveTo(x + 25, y - 40);
    ctx.lineTo(x + 40, y - 20);
    ctx.lineTo(x + 10, y - 20);
    ctx.fill();
}

function drawWilly(x, y, w, h) {
    // Ship Body (Blue)
    ctx.fillStyle = players.willy.color;
    ctx.beginPath();
    ctx.moveTo(x + w/2, y); // nose
    ctx.lineTo(x + w, y + h); // right tail
    ctx.lineTo(x, y + h); // left tail
    ctx.fill();

    // Wings/Fins (Aesthetic Polish)
    ctx.fillStyle = players.willy.color;
    ctx.beginPath();
    ctx.moveTo(x, y + h - 20); // Left wing
    ctx.lineTo(x - 15, y + h);
    ctx.lineTo(x + 5, y + h);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w, y + h - 20); // Right wing
    ctx.lineTo(x + w + 15, y + h);
    ctx.lineTo(x + w - 5, y + h);
    ctx.fill();
    
    // Flame — scales with speed
    const flameLen = 20 + (speed * 3) + Math.random() * 10;
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(x + w/4, y + h);
    ctx.lineTo(x + w/2, y + h + flameLen);
    ctx.lineTo(x + w*3/4, y + h);
    ctx.fill();
    // Inner flame
    if (speed > 4) {
        ctx.fillStyle = '#ffff66';
        ctx.beginPath();
        ctx.moveTo(x + w/3, y + h);
        ctx.lineTo(x + w/2, y + h + flameLen * 0.6);
        ctx.lineTo(x + w*2/3, y + h);
        ctx.fill();
    }

    // Willy Head (Brown Square)
    ctx.fillStyle = players.willy.headColor;
    ctx.fillRect(x + 10, y - 20, 30, 30);
    
    // Glasses
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 18, y - 10, 6, 0, Math.PI*2); // L glass
    ctx.arc(x + 32, y - 10, 6, 0, Math.PI*2); // R glass
    ctx.stroke();
    // Eyes
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(x + 18, y - 10, 2, 0, Math.PI*2); // L pupil
    ctx.arc(x + 32, y - 10, 2, 0, Math.PI*2); // R pupil
    ctx.fill();

    // Straight mouth
    ctx.beginPath();
    ctx.moveTo(x+20, y-2);
    ctx.lineTo(x+30, y-2);
    ctx.stroke();

    // Hat (Blue Triangle)
    ctx.fillStyle = players.willy.hatColor;
    ctx.beginPath();
    ctx.moveTo(x + 25, y - 35);
    ctx.lineTo(x + 40, y - 20);
    ctx.lineTo(x + 10, y - 20);
    ctx.fill();
}

function drawObstacle(obs) {
    if (obs.type === 'star') {
        // Star Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffff00';
        // Draw 5-pointed Star
        ctx.fillStyle = '#ffff00';
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const spikes = 5;
        const outerR = obs.radius;
        const innerR = obs.radius * 0.45;
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (Math.PI * i / spikes) - Math.PI / 2;
            const px = obs.x + Math.cos(angle) * r;
            const py = obs.y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        return;
    }
    if (obs.type === 'ufo') {
        // UFO Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#33cc33';
        // Draw UFO
        ctx.fillStyle = '#33cc33'; // green dome
        ctx.beginPath();
        ctx.arc(obs.x, obs.y - obs.radius/4, obs.radius/1.5, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#cccccc'; // silver saucer
        ctx.beginPath();
        ctx.ellipse(obs.x, obs.y + obs.radius/4, obs.radius, obs.radius/4, 0, 0, Math.PI*2);
        ctx.fill();
        return;
    }
    if (obs.type === 'shield') {
        // Draw Shield Power-Up (blue bubble)
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI*2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 204, 255, 0.2)';
        ctx.fill();
        // Shield icon text
        ctx.fillStyle = '#ffffff';
        ctx.font = `${obs.radius}px "Fredoka One"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', obs.x, obs.y);
        ctx.textBaseline = 'alphabetic';
        ctx.shadowBlur = 0;
        return;
    }
    if (obs.type === 'boss') {
        // Giant Boss Meteorite with red pulsing glow
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20 + pulse * 15;
        
        ctx.fillStyle = '#444444';
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#cc0000';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        
        // Big craters
        ctx.fillStyle = '#333333';
        ctx.beginPath();
        ctx.arc(obs.x - obs.radius/3, obs.y - obs.radius/3, obs.radius/3, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(obs.x + obs.radius/4, obs.y + obs.radius/4, obs.radius/4, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(obs.x + obs.radius/3, obs.y - obs.radius/5, obs.radius/5, 0, Math.PI*2);
        ctx.fill();
        
        // Danger label
        ctx.fillStyle = `rgba(255, 0, 0, ${0.7 + pulse * 0.3})`;
        ctx.font = '16px "Fredoka One"';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ DANGER', obs.x, obs.y - obs.radius - 10);
        
        // Boss Fire Trail (Integrated)
        drawMeteoriteTrail(obs.x, obs.y, obs.radius, true);
        
        return;
    }

    // Regular Meteorite Fire Trail
    drawMeteoriteTrail(obs.x, obs.y, obs.radius, false);

    // Grey Meteorite
    ctx.fillStyle = '#666666';
    ctx.beginPath();
    ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Craters
    ctx.fillStyle = '#444444';
    ctx.beginPath();
    ctx.arc(obs.x - obs.radius/3, obs.y - obs.radius/3, obs.radius/4, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(obs.x + obs.radius/4, obs.y + obs.radius/4, obs.radius/5, 0, Math.PI*2);
    ctx.fill();
}

function drawMoon() {
    if (moon.y > canvas.height) return; // Opt out if it scrolled passed

    // Moon surface
    ctx.fillStyle = '#dddddd';
    ctx.beginPath();
    ctx.arc(canvas.width/2, moon.y + 1000, 1000, Math.PI, 0); // huge circle acting as flat curve
    ctx.fill();
    
    // Moon craters
    ctx.strokeStyle = '#aaaaaa';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(200, moon.y + 50, 40, 15, 0, 0, Math.PI*2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.ellipse(600, moon.y + 80, 60, 20, 0, 0, Math.PI*2);
    ctx.stroke();
    
    // USA Flag
    ctx.fillStyle = '#666666';
    ctx.fillRect(400, moon.y - 60, 4, 60); // pole
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(404, moon.y - 60, 40, 25); // red stripes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(404, moon.y - 55, 40, 5); // white stripe 1
    ctx.fillRect(404, moon.y - 45, 40, 5); // white stripe 2
    ctx.fillStyle = '#000099';
    ctx.fillRect(404, moon.y - 60, 15, 15); // blue canton
}

function drawEarth() {
    if (timeLeft > 5) return; // Don't draw till final 5 seconds

    // Earth Base
    ctx.fillStyle = '#0066ff';
    ctx.beginPath();
    ctx.arc(canvas.width/2, earth.y, earth.size, 0, Math.PI*2);
    ctx.fill();

    // Green landmasses
    ctx.fillStyle = '#33cc33';
    ctx.beginPath();
    ctx.arc(canvas.width/2 - 20, earth.y - 10, 30, 0, Math.PI*2);
    ctx.arc(canvas.width/2 + 30, earth.y + 20, 25, 0, Math.PI*2);
    ctx.fill();
    
    // Text "NYC" at top
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px "Fredoka One"';
    ctx.fillText("NYC!", canvas.width/2 - 15, earth.y - earth.size - 10);
}

// Planet Fly-By Drawing
function drawPlanet(planet) {
    ctx.globalAlpha = planet.alpha;
    
    if (planet.name === 'Mars') {
        ctx.fillStyle = '#cc4422';
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, planet.size, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#993311';
        ctx.beginPath();
        ctx.arc(planet.x - planet.size/3, planet.y + planet.size/4, planet.size/4, 0, Math.PI*2);
        ctx.fill();
    } else if (planet.name === 'Saturn') {
        ctx.fillStyle = '#ddaa44';
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, planet.size, 0, Math.PI*2);
        ctx.fill();
        // Ring
        ctx.strokeStyle = '#ccbb88';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(planet.x, planet.y, planet.size * 1.6, planet.size * 0.3, -0.3, 0, Math.PI*2);
        ctx.stroke();
    } else if (planet.name === 'Jupiter') {
        ctx.fillStyle = '#cc9966';
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, planet.size, 0, Math.PI*2);
        ctx.fill();
        // Bands
        ctx.strokeStyle = '#aa7744';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(planet.x - planet.size, planet.y - planet.size/3);
        ctx.lineTo(planet.x + planet.size, planet.y - planet.size/3);
        ctx.moveTo(planet.x - planet.size, planet.y + planet.size/4);
        ctx.lineTo(planet.x + planet.size, planet.y + planet.size/4);
        ctx.stroke();
    }
    
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px "Fredoka One"';
    ctx.textAlign = 'center';
    ctx.fillText(planet.name, planet.x, planet.y - planet.size - 8);
    
    ctx.globalAlpha = 1.0;
}

function drawMeteoriteTrail(x, y, radius, isBoss) {
    const time = Date.now() / 150;
    const trailLen = radius * (isBoss ? 2.8 : 2.2);
    const flicker = Math.sin(time * 1.5) * (radius * 0.2);
    const flicker2 = Math.cos(time * 1.2) * (radius * 0.15);
    
    // Outer flame (Glow/Smoke)
    const grad = ctx.createLinearGradient(x, y, x, y - trailLen);
    grad.addColorStop(0, isBoss ? 'rgba(255, 0, 0, 0.7)' : 'rgba(255, 100, 0, 0.6)');
    grad.addColorStop(0.4, isBoss ? 'rgba(255, 50, 0, 0.4)' : 'rgba(200, 50, 0, 0.3)');
    grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.8, y);
    // Wavy trail back pointing up
    ctx.quadraticCurveTo(x - radius + flicker, y - trailLen/2, x, y - trailLen);
    ctx.quadraticCurveTo(x + radius + flicker2, y - trailLen/2, x + radius * 0.8, y);
    ctx.fill();

    // Inner hot core (Hot lava/flame)
    const innerGrad = ctx.createLinearGradient(x, y, x, y - trailLen * 0.6);
    innerGrad.addColorStop(0, '#ffffdd'); // white hot
    innerGrad.addColorStop(0.3, '#ffcc00'); // yellow
    innerGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
    
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.4, y);
    ctx.quadraticCurveTo(x + flicker, y - trailLen * 0.7, x + radius * 0.4, y);
    ctx.fill();
}

function spawnPlanets() {
    // Check if we should spawn a planet fly-by
    if (timeLeft <= 40 && timeLeft > 39.9 && !planets.find(p => p.name === 'Mars')) {
        planets.push({ name: 'Mars', x: 120, y: -80, size: 40, alpha: 0, targetAlpha: 0.4 });
    }
    if (timeLeft <= 20 && timeLeft > 19.9 && !planets.find(p => p.name === 'Saturn')) {
        planets.push({ name: 'Saturn', x: canvas.width - 150, y: -80, size: 35, alpha: 0, targetAlpha: 0.4 });
    }
    if (timeLeft <= 10 && timeLeft > 9.9 && !planets.find(p => p.name === 'Jupiter')) {
        planets.push({ name: 'Jupiter', x: 200, y: -80, size: 50, alpha: 0, targetAlpha: 0.35 });
    }
}

function update() {
    let now = Date.now();
    let dt = (now - lastTimeUpdate) / 1000;
    lastTimeUpdate = now;

    if (timeLeft > 0) {
        timeLeft -= dt;
        if (timeLeft <= 0) {
            timeLeft = 0;
        }
    }
    
    // Quadratic speed ramp: 2.0 at start → 9.0 at end, steeper in final seconds
    const difficultyProgress = (60 - timeLeft) / 60;
    const curve = difficultyProgress * difficultyProgress;
    speed = 2.0 + (curve * 7.0); 

    // Scroll moon down
    if (moon.y < canvas.height + 200) {
        moon.y += speed * 0.5;
    }

    // Scroll earth down and win when timer reaches 0
    if (timeLeft <= 0 && earth.y < 150) {
        earth.y += speed * 0.3;
        speed *= 0.98; // slow down
        
        if (earth.y >= 149 && gameState === 'PLAYING') {
            triggerVictory();
        }
    }

    // Player 1 Movement
    if (players.colletas.isLeft && players.colletas.x > 0) players.colletas.x -= players.colletas.speed;
    if (players.colletas.isRight && players.colletas.x < canvas.width - players.colletas.width) players.colletas.x += players.colletas.speed;

    // Player 2 Movement
    if (players.willy.isLeft && players.willy.x > 0) players.willy.x -= players.willy.speed;
    if (players.willy.isRight && players.willy.x < canvas.width - players.willy.width) players.willy.x += players.willy.speed;

    // Decrease invulnerability and shield timers
    if (invulnP1 > 0) invulnP1 -= dt;
    if (invulnP2 > 0) invulnP2 -= dt;
    if (shieldP1 > 0) shieldP1 -= dt;
    if (shieldP2 > 0) shieldP2 -= dt;
    if (shakeTimer > 0) shakeTimer -= dt;
    
    // Update popups
    for (let i = popups.length - 1; i >= 0; i--) {
        popups[i].y -= 1.5;
        popups[i].life -= dt;
        if (popups[i].life <= 0) popups.splice(i, 1);
    }
    
    // Update planet fly-bys
    spawnPlanets();
    for (let i = 0; i < planets.length; i++) {
        planets[i].y += speed * 0.15;
        if (planets[i].alpha < planets[i].targetAlpha) planets[i].alpha += dt * 0.3;
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        particles[i].life -= dt * 1.5;
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // Obstacles Update
    if (timeLeft > 0) {
        spawnObstacle();
        // Boss meteorite at 10 seconds
        if (timeLeft <= 10 && !bossSpawned) {
            bossSpawned = true;
            obstacles.push({
                x: canvas.width / 2,
                y: -120,
                radius: 80,
                type: 'boss',
                vx: 1.5
            });
        }
    }

    for (let i = 0; i < obstacles.length; i++) {
        // Boss moves much slower
        obstacles[i].y += obstacles[i].type === 'boss' ? speed * 0.3 : speed;
        // Horizontal drift (zigzag meteorites)
        if (obstacles[i].vx) {
            obstacles[i].x += obstacles[i].vx;
            // Bounce off edges
            if (obstacles[i].x < 0 || obstacles[i].x > canvas.width) obstacles[i].vx *= -1;
        }

        // Collision Check (Simple Circle to Rect)
        let cx = obstacles[i].x;
        let cy = obstacles[i].y;
        let r = obstacles[i].radius * 0.7; // very forgiving hitbox for kids
        
        let hitProcessed = false;
        
        // P1 Hit — skip if invuln from meteorite AND this is a meteorite (shield still allows collectibles)
        let p1CanHit = (obstacles[i].type !== 'meteorite' || invulnP1 <= 0) && (obstacles[i].type !== 'meteorite' || shieldP1 <= 0);
        if (obstacles[i].type !== 'meteorite') p1CanHit = shieldP1 > 0 || invulnP1 <= 0; // collectibles: always if shield, skip if blinking
        // Simplify: blinking blocks ALL. Shield blocks meteorites only.
        if (invulnP1 > 0) p1CanHit = false; // blink = ghost
        else if (obstacles[i].type === 'meteorite' && shieldP1 > 0) p1CanHit = false; // shield blocks rocks only
        else p1CanHit = true;
        
        if (p1CanHit && cx > players.colletas.x - r && cx < players.colletas.x + players.colletas.width + r &&
            cy > players.colletas.y - r && cy < players.colletas.y + players.colletas.height + r) {
            handleCollision(1, obstacles[i]);
            hitProcessed = true;
        }
        
        let p2CanHit = true;
        if (invulnP2 > 0) p2CanHit = false;
        else if (obstacles[i].type === 'meteorite' && shieldP2 > 0) p2CanHit = false;
        
        if (!hitProcessed && p2CanHit && cx > players.willy.x - r && cx < players.willy.x + players.willy.width + r &&
            cy > players.willy.y - r && cy < players.willy.y + players.willy.height + r) {
            handleCollision(2, obstacles[i]);
            hitProcessed = true;
        }

        // Remove if hit or offscreen
        if (hitProcessed || obstacles[i].y > canvas.height + 100) {
            obstacles.splice(i, 1);
            i--;
        }
    }
    
    // Stars Parallax — speed-based streak effect
    for(let i=0; i<stars.length; i++){
        stars[i].y += stars[i].speed + (speed > 5 ? (speed - 5) * 0.5 : 0);
        if(stars[i].y > canvas.height) stars[i].y = 0;
    }
}

function handleCollision(playerNum, obs) {
    if (gameState !== 'PLAYING') return;
    
    const px = playerNum === 1 ? players.colletas.x + 25 : players.willy.x + 25;
    const py = playerNum === 1 ? players.colletas.y - 30 : players.willy.y - 30;

    if (obs.type === 'shield') {
        playSound('shield');
        if (playerNum === 1) { shieldP1 = 3.0; statsP1.shields++; }
        if (playerNum === 2) { shieldP2 = 3.0; statsP2.shields++; }
        spawnPopup(px, py, '🛡️', '#00ccff');
        spawnCollectionParticles(px, py, '#00ccff');
    } else if (obs.type === 'ufo') {
        playSound('collect');
        if (playerNum === 1) { scoreP1 += 20; statsP1.ufos++; }
        if (playerNum === 2) { scoreP2 += 20; statsP2.ufos++; }
        spawnPopup(px, py, '+20', '#ffd700');
        spawnCollectionParticles(px, py, '#ffd700');
    } else if (obs.type === 'star') {
        playSound('collect');
        if (playerNum === 1) { scoreP1 += 10; statsP1.stars++; }
        if (playerNum === 2) { scoreP2 += 10; statsP2.stars++; }
        spawnPopup(px, py, '+10', '#33ff66');
        spawnCollectionParticles(px, py, '#33ff66');
    } else if (obs.type === 'boss') {
        // Boss meteor hit — big penalty!
        playSound('crash');
        if (playerNum === 1) { scoreP1 = Math.max(0, scoreP1 - 15); invulnP1 = 2.5; shakeTimer = 0.3; statsP1.hits++; }
        if (playerNum === 2) { scoreP2 = Math.max(0, scoreP2 - 15); invulnP2 = 2.5; shakeTimer = 0.3; statsP2.hits++; }
        spawnPopup(px, py, '-15!', '#ff0000');
    } else { // meteorite
        playSound('crash');
        if (playerNum === 1) { scoreP1 = Math.max(0, scoreP1 - 5); invulnP1 = 2.0; shakeTimer = 0.15; statsP1.hits++; }
        if (playerNum === 2) { scoreP2 = Math.max(0, scoreP2 - 5); invulnP2 = 2.0; shakeTimer = 0.15; statsP2.hits++; }
        spawnPopup(px, py, '-5', '#ff4466');
    }
}

function draw() {
    // Screen Shake
    ctx.save();
    if (shakeTimer > 0) {
        const shakeX = (Math.random() - 0.5) * 12;
        const shakeY = (Math.random() - 0.5) * 12;
        ctx.translate(shakeX, shakeY);
    }
    
    // Dynamic Background Gradient (Navy -> Purple -> BlueBlack)
    let bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    const progress = (60 - timeLeft) / 60;
    if (progress < 0.3) {
        bgGradient.addColorStop(0, '#000033'); // Navy
        bgGradient.addColorStop(1, '#000011');
    } else if (progress < 0.7) {
        bgGradient.addColorStop(0, '#1a0033'); // Purple shift
        bgGradient.addColorStop(1, '#000011');
    } else {
        bgGradient.addColorStop(0, '#000011'); // Dark Space
        bgGradient.addColorStop(1, '#000000');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

    // Draw Stars (with speed streaks and twinkling)
    for(let i=0; i<stars.length; i++){
        let s = stars[i];
        if (s.twinkle) {
            s.opacity += s.twinkleSpeed;
            if (s.opacity > 1 || s.opacity < 0.2) s.twinkleSpeed *= -1;
        }
        ctx.globalAlpha = s.opacity;
        ctx.fillStyle = '#ffffff';
        const streakLen = speed > 5 ? (speed - 5) * 1.5 : 0;
        ctx.fillRect(s.x, s.y, s.size, s.size + streakLen);
    }
    ctx.globalAlpha = 1.0;
    
    // Draw particles
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    
    // Draw planet fly-bys (behind everything)
    for (let i = 0; i < planets.length; i++) {
        drawPlanet(planets[i]);
    }

    drawEarth();
    drawMoon();
    
    // Blinking effect if invincible
    if (invulnP1 <= 0 || Math.floor(Date.now() / 150) % 2 === 0) {
        drawColletas(players.colletas.x, players.colletas.y, players.colletas.width, players.colletas.height);
    }
    if (invulnP2 <= 0 || Math.floor(Date.now() / 150) % 2 === 0) {
        drawWilly(players.willy.x, players.willy.y, players.willy.width, players.willy.height);
    }
    
    // Shield glow around players
    if (shieldP1 > 0) {
        ctx.strokeStyle = `rgba(0, 204, 255, ${0.5 + 0.5 * Math.sin(Date.now() / 100)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(players.colletas.x + 25, players.colletas.y + 20, 50, 0, Math.PI*2);
        ctx.stroke();
    }
    if (shieldP2 > 0) {
        ctx.strokeStyle = `rgba(0, 204, 255, ${0.5 + 0.5 * Math.sin(Date.now() / 100)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(players.willy.x + 25, players.willy.y + 20, 50, 0, Math.PI*2);
        ctx.stroke();
    }

    for (let i = 0; i < obstacles.length; i++) {
        drawObstacle(obstacles[i]);
    }
    
    // Draw floating score popups
    for (let i = 0; i < popups.length; i++) {
        const p = popups[i];
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.font = '20px "Fredoka One"';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1.0;
    
    // Draw UI overlay text
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px "Fredoka One"';
    ctx.textAlign = 'left';
    ctx.fillText(`Time: ${Math.ceil(timeLeft)}s`, 20, 30);
    
    // Draw Scores
    ctx.textAlign = 'right';
    ctx.fillStyle = players.colletas.color;
    ctx.fillText(`Colletas Pts: ${scoreP1}`, canvas.width - 20, 30);
    
    ctx.fillStyle = players.willy.color;
    ctx.fillText(`Willy Pts: ${scoreP2}`, canvas.width - 20, 60);
    
    if (gameState === 'PAUSED') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width/2, canvas.height/2);
    }
    
    ctx.restore(); // End screen shake transform
}

function triggerGameOver() {
    // GameOver no longer used because of the 60s rule
    gameState = 'GAMEOVER';
    stopBGM();
    finalScoreEl.innerText = `Time Survived: ${60 - Math.ceil(timeLeft)}s`;
    gameOverScreen.classList.remove('hidden');
}

function triggerVictory() {
    gameState = 'VICTORY';
    stopBGM();
    playSound('win');
    
    let winnerText = "It's a Tie!";
    if (scoreP1 > scoreP2) winnerText = "Colletas Wins! 🎉";
    else if (scoreP2 > scoreP1) winnerText = "Willy Wins! 🎉";
    
    // Per-player high score tracking
    let hsText = '';
    let newRecordP1 = false;
    let newRecordP2 = false;
    
    if (scoreP1 > hsColletas) {
        hsColletas = scoreP1;
        localStorage.setItem('spaceDodge_hsColletas', hsColletas.toString());
        newRecordP1 = true;
    }
    if (scoreP2 > hsWilly) {
        hsWilly = scoreP2;
        localStorage.setItem('spaceDodge_hsWilly', hsWilly.toString());
        newRecordP2 = true;
    }
    
    hsText = '<br>';
    if (newRecordP1) hsText += `🎉 Colletas NEW RECORD: ${hsColletas}!`;
    else hsText += `🏆 Colletas Best: ${hsColletas}`;
    hsText += '<br>';
    if (newRecordP2) hsText += `🎉 Willy NEW RECORD: ${hsWilly}!`;
    else hsText += `🏆 Willy Best: ${hsWilly}`;
    
    // Fun Awards!
    let awards = '<br><br>';
    // Star Collector
    if (statsP1.stars > statsP2.stars) awards += '⭐ Star Collector: Colletas<br>';
    else if (statsP2.stars > statsP1.stars) awards += '⭐ Star Collector: Willy<br>';
    else if (statsP1.stars > 0) awards += '⭐ Star Collectors: Both!<br>';
    // UFO Hunter
    if (statsP1.ufos > statsP2.ufos) awards += '🛸 UFO Hunter: Colletas<br>';
    else if (statsP2.ufos > statsP1.ufos) awards += '🛸 UFO Hunter: Willy<br>';
    else if (statsP1.ufos > 0) awards += '🛸 UFO Hunters: Both!<br>';
    // Meteorite Magnet
    if (statsP1.hits > statsP2.hits) awards += '🪨 Meteorite Magnet: Colletas<br>';
    else if (statsP2.hits > statsP1.hits) awards += '🪨 Meteorite Magnet: Willy<br>';
    else if (statsP1.hits > 0) awards += '🪨 Meteorite Magnets: Both!<br>';
    // Shield Master
    if (statsP1.shields > statsP2.shields) awards += '🛡️ Shield Master: Colletas<br>';
    else if (statsP2.shields > statsP1.shields) awards += '🛡️ Shield Master: Willy<br>';
    else if (statsP1.shields > 0) awards += '🛡️ Shield Masters: Both!<br>';
    // Dodge Master (fewest hits)
    if (statsP1.hits < statsP2.hits) awards += '💨 Dodge Master: Colletas';
    else if (statsP2.hits < statsP1.hits) awards += '💨 Dodge Master: Willy';
    else awards += '💨 Dodge Masters: Both!';
    
    winScoreEl.innerHTML = `Landed safely in NYC!<br><br>${winnerText}<br>Colletas: ${scoreP1} | Willy: ${scoreP2}${hsText}${awards}`;
    victoryScreen.classList.remove('hidden');
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;
    
    update();
    draw();
    
    animationId = requestAnimationFrame(gameLoop);
}

// Initial draw to show the moon before taking off
draw();
