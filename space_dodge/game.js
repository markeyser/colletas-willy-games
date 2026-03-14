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
let speed = 2.5; // Starts slower for kids
let animationId;
let lastTimeUpdate = 0;
let invulnP1 = 0;
let invulnP2 = 0;

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
        // Thruster take off sound
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 1.5);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
        osc.start(now);
        osc.stop(now + 1.5);
    } else if (type === 'win') {
        // Happy arpeggio
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
        speed: Math.random() * 1 + 0.5
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
    scoreP1 = 0;
    scoreP2 = 0;
    speed = 2.5; // Easier for kids
    obstacles = [];
    moon.y = 550;
    earth.y = -200;
    invulnP1 = 0;
    invulnP2 = 0;
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
    // Base difficulty 1% chance per frame. At 30s left, 1.5%. At 0s, 2%. Very gentle curve for kids.
    const difficultyProgress = (60 - timeLeft) / 60; 
    const spawnChance = 0.01 + (difficultyProgress * 0.015);
    
    if (Math.random() < spawnChance) { 
        const size = Math.random() * 30 + 20;
        let rng = Math.random();
        let obsType = 'meteorite';
        if (rng > 0.9) obsType = 'ufo';
        else if (rng > 0.8) obsType = 'star';
        
        obstacles.push({
            x: Math.random() * (canvas.width - size),
            y: -50,
            radius: size,
            type: obsType
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
    
    // Flame
    ctx.fillStyle = '#ff9900';
    ctx.beginPath();
    ctx.moveTo(x + w/4, y + h);
    ctx.lineTo(x + w/2, y + h + 20 + Math.random()*10); // flickers
    ctx.lineTo(x + w*3/4, y + h);
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
    
    // Flame
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(x + w/4, y + h);
    ctx.lineTo(x + w/2, y + h + 20 + Math.random()*10); // flickers
    ctx.lineTo(x + w*3/4, y + h);
    ctx.fill();

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

function drawMeteorite(obs) {
    if (obs.type === 'star') {
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
        return;
    }
    if (obs.type === 'ufo') {
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
    
    // Gentle progressive speed increase over the 60 seconds
    const difficultyProgress = (60 - timeLeft) / 60;
    speed = 2.5 + (difficultyProgress * 4); 

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

    // Decrease invulnerability frames
    if (invulnP1 > 0) invulnP1 -= dt;
    if (invulnP2 > 0) invulnP2 -= dt;

    // Obstacles Update
    if (timeLeft > 0) {
        spawnObstacle();
    }

    for (let i = 0; i < obstacles.length; i++) {
        obstacles[i].y += speed;

        // Collision Check (Simple Circle to Rect)
        let cx = obstacles[i].x;
        let cy = obstacles[i].y;
        let r = obstacles[i].radius * 0.7; // very forgiving hitbox for kids
        
        let hitProcessed = false;
        
        // P1 Hit
        if (invulnP1 <= 0 && cx > players.colletas.x - r && cx < players.colletas.x + players.colletas.width + r &&
            cy > players.colletas.y - r && cy < players.colletas.y + players.colletas.height + r) {
            handleCollision(1, obstacles[i]);
            hitProcessed = true;
        }
        // P2 Hit (if not already hit by P1)
        if (!hitProcessed && invulnP2 <= 0 && cx > players.willy.x - r && cx < players.willy.x + players.willy.width + r &&
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
    
    // Stars Parallax
    for(let i=0; i<stars.length; i++){
        stars[i].y += stars[i].speed;
        if(stars[i].y > canvas.height) stars[i].y = 0;
    }
}

function handleCollision(playerNum, obs) {
    if (gameState !== 'PLAYING') return;

    if (obs.type === 'ufo') {
        playSound('win'); // Collect sound
        if (playerNum === 1) scoreP1 += 20;
        if (playerNum === 2) scoreP2 += 20;
    } else if (obs.type === 'star') {
        playSound('win'); // Collect sound
        if (playerNum === 1) scoreP1 += 10;
        if (playerNum === 2) scoreP2 += 10;
    } else { // meteorite
        playSound('crash');
        if (playerNum === 1) { scoreP1 = Math.max(0, scoreP1 - 5); invulnP1 = 2.0; }
        if (playerNum === 2) { scoreP2 = Math.max(0, scoreP2 - 5); invulnP2 = 2.0; }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Stars
    ctx.fillStyle = '#ffffff';
    for(let i=0; i<stars.length; i++){
        ctx.fillRect(stars[i].x, stars[i].y, stars[i].size, stars[i].size);
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

    for (let i = 0; i < obstacles.length; i++) {
        drawMeteorite(obstacles[i]);
    }
    
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
    if (scoreP1 > scoreP2) winnerText = "Colletas Wins!";
    else if (scoreP2 > scoreP1) winnerText = "Willy Wins!";
    
    winScoreEl.innerHTML = `Landed safely in NYC!<br><br>${winnerText}<br>Colletas: ${scoreP1} | Willy: ${scoreP2}`;
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
