const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- DOM Elements ---
const score1Display = document.getElementById('score1');
const score2Display = document.getElementById('score2');
const timerDisplay = document.getElementById('timer');
const countdownDisplay = document.getElementById('countdown');
const pauseIndicatorDisplay = document.getElementById('pauseIndicator');
const gameOverDisplay = document.getElementById('gameOver');
const finalScoreDisplay = document.getElementById('finalScore');
const winnerDisplay = document.getElementById('winner');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');

// --- Audio Elements ---
const catchSound = document.getElementById('catchSound');
const powerupSound = document.getElementById('powerupSound');
const bonkSound = document.getElementById('bonkSound');
// const music = document.getElementById('music'); // Uncomment for background music

// --- Game Constants ---
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;
const GAME_DURATION = 60; // seconds
const PLAYER_WIDTH = 55;
const PLAYER_HEIGHT = 65;
const PLAYER_BASE_SPEED = 6;
const ITEM_SIZE = 20;
const INITIAL_SPAWN_INTERVAL = 1100; // ms
const MIN_SPAWN_INTERVAL = 400; // ms
const SPAWN_INTERVAL_REDUCTION = 5; // ms reduction per second
const PARTICLE_COUNT = 5;
const PARTICLE_LIFE = 30; // frames

// --- Item Types ---
const ITEM_TYPES = {
    NUT: 'NUT',
    GOLDEN_NUT: 'GOLDEN_NUT',
    ROTTEN_NUT: 'ROTTEN_NUT',
    ROCK: 'ROCK',
    POWERUP_WIDE: 'POWERUP_WIDE',
    POWERUP_SPEED: 'POWERUP_SPEED',
    MEGA_NUT: 'MEGA_NUT',
};

// --- Item Properties (Color, Score, Effect) ---
const ITEM_PROPS = {
    [ITEM_TYPES.NUT]: { color: '#8B4513', score: 1, sound: catchSound },
    [ITEM_TYPES.GOLDEN_NUT]: { color: '#FFD700', score: 5, sound: powerupSound }, // Gold
    [ITEM_TYPES.ROTTEN_NUT]: { color: '#556B2F', score: -2, sound: bonkSound }, // Dark Olive Green
    [ITEM_TYPES.ROCK]: { color: '#888888', score: 0, effect: 'stun', sound: bonkSound }, // Grey
    [ITEM_TYPES.POWERUP_WIDE]: { color: '#00BCD4', score: 0, effect: 'wide', sound: powerupSound, duration: 5000 }, // Cyan
    [ITEM_TYPES.POWERUP_SPEED]: { color: '#FF9800', score: 0, effect: 'speed', sound: powerupSound, duration: 5000 }, // Orange
    [ITEM_TYPES.MEGA_NUT]: { color: '#FF4500', score: 20, sound: powerupSound }, // Orange Red
};

// --- Game State Variables ---
let timerValue = GAME_DURATION;
let timerInterval = null;
let gameLoopId = null;
let items = [];
let particles = [];
let keysPressed = {};
let isPaused = false;
let isGameOver = true; // Stay true until start button pressed
let isCountingDown = false;
let currentSpawnInterval = INITIAL_SPAWN_INTERVAL;
let lastSpawnTime = 0;
let popups = [];
let megaNutSpawned = false;

// --- High Scores ---
let hsNutColletas = parseInt(localStorage.getItem('nutRush_hsColletas') || '0');
let hsNutWilly = parseInt(localStorage.getItem('nutRush_hsWilly') || '0');

// --- Parallax Forest ---
const parallaxLayers = [
    { y: CANVAS_HEIGHT - 120, speed: 0.02, color: '#2e7d32', height: 100 }, // Back hills (Very slow)
    { y: CANVAS_HEIGHT - 80, speed: 0.06, color: '#388e3c', height: 80 },  // Mid trees
    { y: CANVAS_HEIGHT - 40, speed: 0.12, color: '#43a047', height: 60 }   // Front grass
];

// --- Player Objects ---
function spawnPopup(x, y, text, color) {
    popups.push({ x, y, text, color, life: 1, maxLife: 1 });
}

function createPlayer(x, name, color, controls) {
    return {
        x: x,
        y: CANVAS_HEIGHT - PLAYER_HEIGHT - 10,
        baseWidth: PLAYER_WIDTH,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        name: name,
        color: color,
        controls: controls, // { left: 'a', right: 'd' } or { left: 'ArrowLeft', right: 'ArrowRight' }
        score: 0,
        speed: PLAYER_BASE_SPEED,
        isStunned: false,
        stunTimer: null,
        powerupTimers: {}, // Stores setTimeout IDs for powerups
        stats: { nuts: 0, golden: 0, rotten: 0, rocks: 0 },
        // Animation state
        bobOffset: 0,
        bobDirection: 1,
        isMoving: false,

        draw: function() {
            ctx.save(); // Save context state

            // Apply stun effect (slight grey overlay)
            if (this.isStunned) {
                ctx.globalAlpha = 0.6;
            }

             // Apply powerup visual cues
            let currentWidth = this.width; // Use the potentially wider width
            let currentX = this.x;

             // --- Main Body ---
            ctx.fillStyle = this.color;
            // Bobbing effect
            let drawY = this.y + this.bobOffset;
            ctx.fillRect(currentX, drawY, currentWidth, this.height);

             // --- Character Features ---
             // Eyes (simple ovals)
             ctx.fillStyle = 'white';
             ctx.beginPath();
             ctx.ellipse(currentX + currentWidth * 0.3, drawY + this.height * 0.4, 6, 8, 0, 0, Math.PI * 2);
             ctx.ellipse(currentX + currentWidth * 0.7, drawY + this.height * 0.4, 6, 8, 0, 0, Math.PI * 2);
             ctx.fill();
             ctx.fillStyle = 'black'; // Pupils
             ctx.beginPath();
             ctx.arc(currentX + currentWidth * 0.3, drawY + this.height * 0.45, 3, 0, Math.PI * 2);
             ctx.arc(currentX + currentWidth * 0.7, drawY + this.height * 0.45, 3, 0, Math.PI * 2);
             ctx.fill();

             // Distinguishing features
             if (this.name === "Collets") { 
                 // Pigtails with sway
                 const sway = Math.sin(Date.now() / 150) * 4;
                 ctx.fillStyle = '#A0522D'; // Lighter brown for pigtails
                 // Left pigtail
                 ctx.fillRect(currentX - 8, drawY + 10 + sway, 8, 20);
                 // Right pigtail
                 ctx.fillRect(currentX + currentWidth, drawY + 10 - sway, 8, 20);
                 
                 ctx.beginPath();
                 ctx.arc(currentX - 4, drawY + 10 + sway, 6, 0, Math.PI * 2); // Left tie
                 ctx.arc(currentX + currentWidth + 4, drawY + 10 - sway, 6, 0, Math.PI * 2); // Right tie
                 ctx.fill();
                 
                 // Mouth
                 ctx.strokeStyle = 'black';
                 ctx.lineWidth = 2;
                 ctx.beginPath();
                 ctx.arc(currentX + currentWidth / 2, drawY + this.height * 0.7, 10, 0.2 * Math.PI, 0.8 * Math.PI);
                 ctx.stroke();
             } else { // Willy - Glasses
                 ctx.strokeStyle = 'black';
                 ctx.lineWidth = 3;
                 const lensY = drawY + this.height * 0.4;
                 const lensRadius = 12;
                 // Left lens
                 ctx.beginPath();
                 ctx.arc(currentX + currentWidth * 0.3, lensY, lensRadius, 0, Math.PI * 2);
                 ctx.stroke();
                 // Right lens
                 ctx.beginPath();
                 ctx.arc(currentX + currentWidth * 0.7, lensY, lensRadius, 0, Math.PI * 2);
                 ctx.stroke();
                 // Bridge
                 ctx.beginPath();
                 ctx.moveTo(currentX + currentWidth * 0.3 + lensRadius, lensY);
                 ctx.lineTo(currentX + currentWidth * 0.7 - lensRadius, lensY);
                 ctx.stroke();
                  // Mouth
                 ctx.lineWidth = 2;
                 ctx.beginPath();
                 ctx.moveTo(currentX + currentWidth * 0.3, drawY + this.height * 0.75);
                 ctx.lineTo(currentX + currentWidth * 0.7, drawY + this.height * 0.75);
                 ctx.stroke();
             }

             // --- Powerup Indicators (Above head) ---
             const indicatorY = drawY - 15;
             if (this.powerupTimers[ITEM_TYPES.POWERUP_WIDE]) {
                 ctx.fillStyle = ITEM_PROPS[ITEM_TYPES.POWERUP_WIDE].color;
                 ctx.fillRect(currentX + currentWidth/2 - 15, indicatorY, 10, 10); // Wide icon
             }
              if (this.powerupTimers[ITEM_TYPES.POWERUP_SPEED]) {
                 ctx.fillStyle = ITEM_PROPS[ITEM_TYPES.POWERUP_SPEED].color;
                 ctx.fillRect(currentX + currentWidth/2 + 5, indicatorY, 10, 10); // Speed icon
             }


            ctx.restore(); // Restore context state (removes alpha if stunned)
        },

        update: function(keys) {
            if (this.isStunned) {
                this.isMoving = false;
                return; // Can't move if stunned
            }

            let moved = false;
            if (keys[this.controls.left]) {
                this.x -= this.speed;
                moved = true;
            }
            if (keys[this.controls.right]) {
                this.x += this.speed;
                moved = true;
            }
            this.isMoving = moved;

            // Keep player within bounds
            this.x = Math.max(0, Math.min(CANVAS_WIDTH - this.width, this.x));

            // Update bobbing animation if moving
            if (this.isMoving) {
                this.bobOffset += this.bobDirection * 0.5;
                if (Math.abs(this.bobOffset) > 3) {
                    this.bobDirection *= -1;
                }
            } else {
                // Gently return to neutral position
                if (Math.abs(this.bobOffset) > 0.1) {
                    this.bobOffset *= 0.8;
                } else {
                    this.bobOffset = 0;
                }
            }
        },

        activatePowerup: function(type) {
            const props = ITEM_PROPS[type];
            if (!props || !props.effect) return;

            // Clear existing timer for this powerup type
            if (this.powerupTimers[type]) {
                clearTimeout(this.powerupTimers[type]);
            }

            // Apply effect
            switch (props.effect) {
                case 'wide':
                    this.width = this.baseWidth * 1.5; // Make player wider
                    break;
                case 'speed':
                    this.speed = PLAYER_BASE_SPEED * 1.5; // Make player faster
                    break;
                // Add other powerup effects here
            }
             playSound(props.sound);


            // Set timer to deactivate
            this.powerupTimers[type] = setTimeout(() => {
                this.deactivatePowerup(type);
            }, props.duration);
        },

        deactivatePowerup: function(type) {
             const props = ITEM_PROPS[type];
             if (!props || !props.effect) return;

             switch (props.effect) {
                case 'wide':
                    this.width = this.baseWidth; // Reset width
                    break;
                case 'speed':
                    this.speed = PLAYER_BASE_SPEED; // Reset speed
                    break;
                // Add other powerup deactivations
            }
            delete this.powerupTimers[type]; // Remove the timer reference
        },

        stun: function(duration = 1000) { // Stun for 1 second default
             if (this.stunTimer) clearTimeout(this.stunTimer); // Clear existing stun

             this.isStunned = true;
             this.isMoving = false; // Stop movement animation
             this.stunTimer = setTimeout(() => {
                 this.isStunned = false;
                 this.stunTimer = null;
             }, duration);
        },

        reset: function(startX) {
            this.x = startX;
            this.y = CANVAS_HEIGHT - PLAYER_HEIGHT - 10;
            this.score = 0;
            this.stats = { nuts: 0, golden: 0, rotten: 0, rocks: 0 };
            this.width = this.baseWidth;
            this.speed = PLAYER_BASE_SPEED;
            this.isStunned = false;
             if (this.stunTimer) clearTimeout(this.stunTimer);
             this.stunTimer = null;
             // Clear all active powerup timeouts
             Object.values(this.powerupTimers).forEach(timerId => clearTimeout(timerId));
             this.powerupTimers = {};
             this.bobOffset = 0;
             this.isMoving = false;
        }
    };
}

const player1 = createPlayer(CANVAS_WIDTH / 4 - PLAYER_WIDTH / 2, "Collets", '#D2691E', { left: 'a', right: 'd' });
const player2 = createPlayer((CANVAS_WIDTH * 3) / 4 - PLAYER_WIDTH / 2, "Willy", '#A0522D', { left: 'arrowleft', right: 'arrowright' });

// --- Item Functions ---
function spawnItem() {
    const spawnChance = Math.random();
    let itemType;

    // Determine item type based on chance and game progress (more variety later)
    const timeProgress = (GAME_DURATION - timerValue) / GAME_DURATION; // 0 to 1

    if (spawnChance < 0.03 + timeProgress * 0.05) { // 3% base chance, up to 8% for golden
        itemType = ITEM_TYPES.GOLDEN_NUT;
    } else if (spawnChance < 0.08 + timeProgress * 0.1) { // 5% base chance, up to 15% for powerups
         itemType = Math.random() < 0.5 ? ITEM_TYPES.POWERUP_WIDE : ITEM_TYPES.POWERUP_SPEED;
    } else if (spawnChance < 0.12 + timeProgress * 0.1) { // 4% base chance, up to 14% for rotten
        itemType = ITEM_TYPES.ROTTEN_NUT;
    } else if (spawnChance < 0.15 + timeProgress * 0.08) { // 3% base chance, up to 11% for rocks
         itemType = ITEM_TYPES.ROCK;
    }
     else {
        itemType = ITEM_TYPES.NUT; // Most common
    }

    const props = ITEM_PROPS[itemType];
    items.push({
        x: Math.random() * (CANVAS_WIDTH - ITEM_SIZE),
        y: -ITEM_SIZE,
        size: itemType === ITEM_TYPES.ROCK ? ITEM_SIZE * 1.2 : ITEM_SIZE, // Rocks slightly bigger
        speed: 1.5 + Math.random() * 2 + timeProgress * 1.5, // Base speed + random + increase over time
        color: props.color,
        type: itemType,
        value: props.score !== undefined ? props.score : 0,
        effect: props.effect,
        sound: props.sound,
        rotation: Math.random() * Math.PI * 2, // For visual flair
        rotationSpeed: (Math.random() - 0.5) * 0.05 // Slow rotation
    });
}

function updateItems() {
    for (let i = items.length - 1; i >= 0; i--) {
        items[i].y += items[i].speed;
        items[i].rotation += items[i].rotationSpeed;

        // Remove items that fall off the bottom
        if (items[i].y > CANVAS_HEIGHT) {
            // Maybe play a 'miss' sound softly? Optional.
            items.splice(i, 1);
        }
    }
}

function drawItems() {
    items.forEach(item => {
        ctx.save();
        ctx.translate(item.x + item.size / 2, item.y + item.size / 2); // Translate to center for rotation
        ctx.rotate(item.rotation);

        ctx.fillStyle = item.color;
        ctx.beginPath();

        switch(item.type) {
            case ITEM_TYPES.NUT:
            case ITEM_TYPES.GOLDEN_NUT:
                 // Draw a slightly irregular oval for a nut shape
                 ctx.ellipse(0, 0, item.size / 2, item.size / 2.5, Math.PI / 4, 0, 2 * Math.PI);
                 ctx.fill();
                 if (item.type === ITEM_TYPES.GOLDEN_NUT) { // Add sparkle
                    ctx.fillStyle = 'white';
                    ctx.fillRect(-item.size * 0.1, -item.size * 0.3, item.size * 0.2, item.size * 0.6);
                    ctx.fillRect(-item.size * 0.3, -item.size * 0.1, item.size * 0.6, item.size * 0.2);
                 }
                break;
            case ITEM_TYPES.ROTTEN_NUT:
                // Slightly different shape or maybe X mark
                ctx.ellipse(0, 0, item.size / 2.2, item.size / 2.5, -Math.PI / 6, 0, 2 * Math.PI);
                ctx.fill();
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 2;
                ctx.moveTo(-item.size*0.25, -item.size*0.25);
                ctx.lineTo(item.size*0.25, item.size*0.25);
                ctx.moveTo(item.size*0.25, -item.size*0.25);
                ctx.lineTo(-item.size*0.25, item.size*0.25);
                ctx.stroke();
                break;
            case ITEM_TYPES.ROCK:
                // Irregular polygon for rock
                ctx.moveTo(-item.size*0.5, -item.size*0.1);
                ctx.lineTo(-item.size*0.2, -item.size*0.4);
                ctx.lineTo(item.size*0.3, -item.size*0.5);
                ctx.lineTo(item.size*0.45, 0);
                ctx.lineTo(item.size*0.1, item.size*0.5);
                ctx.lineTo(-item.size*0.4, item.size*0.3);
                ctx.closePath();
                ctx.fill();
                break;
            case ITEM_TYPES.MEGA_NUT:
                // Giant Glowing Nut
                const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
                ctx.shadowColor = '#FF4500';
                ctx.shadowBlur = 15 + pulse * 10;
                ctx.ellipse(0, 0, item.size / 2, item.size / 2.5, Math.PI / 4, 0, 2 * Math.PI);
                ctx.fill();
                ctx.shadowBlur = 0;
                // Add "MEGA" text
                ctx.fillStyle = 'white';
                ctx.font = 'bold 16px "Fredoka One"';
                ctx.textAlign = 'center';
                ctx.fillText('MEGA', 0, 5);
                break;
            case ITEM_TYPES.POWERUP_WIDE:
            case ITEM_TYPES.POWERUP_SPEED:
                 // Simple square/circle for powerups
                 ctx.fillRect(-item.size / 2, -item.size / 2, item.size, item.size);
                 // Add simple icon inside? 'W' or arrow?
                 ctx.fillStyle = 'white';
                 ctx.font = 'bold 14px Arial';
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 ctx.fillText(item.type === ITEM_TYPES.POWERUP_WIDE ? 'W' : '>', 0, 1);
                break;
        }

        ctx.restore();
    });
}

// --- Particle System ---
function createParticles(x, y, color) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: x,
            y: y,
            size: Math.random() * 3 + 2,
            speedX: (Math.random() - 0.5) * 4,
            speedY: (Math.random() - 0.5) * 4,
            life: PARTICLE_LIFE,
            color: color
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.life--;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / PARTICLE_LIFE; // Fade out
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalAlpha = 1.0; // Reset alpha
    });
}


// --- Collision Detection ---
function checkCollisions() {
    [player1, player2].forEach(player => {
        if (player.isStunned) return; // No collisions while stunned

        for (let i = items.length - 1; i >= 0; i--) {
            let item = items[i];

            // Basic AABB collision detection
            if (item.x < player.x + player.width &&
                item.x + item.size > player.x &&
                item.y < player.y + player.height &&
                item.y + item.size > player.y + player.height * 0.2) // Catch higher up on body
            {
                // Collision occurred!
                handleItemCatch(player, item, i);
                break; // Player can only catch one item per frame
            }
        }
    });
}

function handleItemCatch(player, item, itemIndex) {
    // Apply score (ensure score doesn't go below 0)
    const oldScore = player.score;
    player.score = Math.max(0, player.score + item.value);

    // Trigger score pop animation
    let scoreDisplay = player === player1 ? score1Display : score2Display;
    updateScoreUI(player, scoreDisplay, oldScore);

    // Play sound
    if (item.sound) {
         playSound(item.sound);
    }

    // Apply effect (stun, powerup)
    if (item.effect) {
        if (item.effect === 'stun') {
            player.stun(1500); // Stun for 1.5 seconds
        } else if (item.effect === 'wide' || item.effect === 'speed') {
            player.activatePowerup(item.type);
        }
    }

    // Create particles
    if(item.value > 0 || item.effect){ // Particles for good things
        createParticles(item.x + item.size / 2, item.y + item.size / 2, item.color);
    }
    
    // Stats and Popups
    const px = player.x + player.width/2;
    const py = player.y - 20;
    if (item.type === ITEM_TYPES.NUT) { player.stats.nuts++; spawnPopup(px, py, '+1', '#8B4513'); }
    else if (item.type === ITEM_TYPES.GOLDEN_NUT) { player.stats.golden++; spawnPopup(px, py, '+5', '#FFD700'); }
    else if (item.type === ITEM_TYPES.ROTTEN_NUT) { player.stats.rotten++; spawnPopup(px, py, '-2', '#556B2F'); }
    else if (item.type === ITEM_TYPES.ROCK) { player.stats.rocks++; spawnPopup(px, py, 'STUNNED!', '#888888'); }
    else if (item.type === ITEM_TYPES.MEGA_NUT) { player.stats.nuts += 20; spawnPopup(px, py, '+20!', '#FF4500'); }

    // Remove the caught item
    items.splice(itemIndex, 1);
}

// --- Sound Function ---
function playSound(audioElement) {
    if (audioElement) {
        audioElement.currentTime = 0; // Rewind to start
        audioElement.play().catch(e => console.log("Audio play failed:", e)); // Play, catch errors
    }
}

// --- UI Updates ---
function updateScoreUI(player, displayElement, oldScore) {
     displayElement.textContent = `${player.name}: ${player.score}`;
     // Add pop effect class
     if(player.score > oldScore) {
         displayElement.classList.add('score-pop');
     } else if (player.score < oldScore) {
         displayElement.classList.add('score-bad-pop');
     }
     // Remove class after animation
     setTimeout(() => {
         displayElement.classList.remove('score-pop');
         displayElement.classList.remove('score-bad-pop');
     }, 150); // Match CSS transition duration
}

function updateTimer() {
    if (isPaused || isGameOver || isCountingDown) return;

    timerValue--;
    timerDisplay.textContent = `Time: ${timerValue}`;

    // Gradually decrease spawn interval
    currentSpawnInterval = Math.max(MIN_SPAWN_INTERVAL, currentSpawnInterval - SPAWN_INTERVAL_REDUCTION);


    if (timerValue <= 0) {
        endGame();
    }
}

function clearCanvas() {
    // Dynamic Sky Gradient
    let skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    const progress = (GAME_DURATION - timerValue) / GAME_DURATION;
    
    if (progress > 0.75) { // Super Squirrel Tension (Sunset)
        skyGrad.addColorStop(0, '#ff7043'); // Orange
        skyGrad.addColorStop(1, '#ffd54f'); // Yellow
    } else {
        skyGrad.addColorStop(0, '#81d4fa'); // Sky Blue
        skyGrad.addColorStop(1, '#e1f5fe');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawParallax();
}

function drawParallax() {
    parallaxLayers.forEach(layer => {
        ctx.fillStyle = layer.color;
        // Draw recurring shapes (trees/hills)
        const itemWidth = 150;
        const offset = (Date.now() * layer.speed) % itemWidth;
        for (let x = -offset; x < CANVAS_WIDTH; x += itemWidth) {
            ctx.beginPath();
            if (layer.height > 80) { // Hills
                ctx.arc(x + itemWidth/2, CANVAS_HEIGHT, itemWidth/1.5, Math.PI, 0);
            } else { // Trees
                ctx.moveTo(x + itemWidth/2, CANVAS_HEIGHT - layer.height);
                ctx.lineTo(x + itemWidth/4, CANVAS_HEIGHT);
                ctx.lineTo(x + itemWidth * 0.75, CANVAS_HEIGHT);
            }
            ctx.fill();
        }
    });
}

function updatePopups() {
    const dt = 1/60;
    for (let i = popups.length - 1; i >= 0; i--) {
        popups[i].y -= 1.5;
        popups[i].life -= dt;
        if (popups[i].life <= 0) popups.splice(i, 1);
    }
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

function determineWinner() {
    if (player1.score > player2.score) {
        return `${player1.name} is the Top Catcher!`;
    } else if (player2.score > player1.score) {
        return `${player2.name} is the Top Catcher!`;
    } else {
        return "It's a Nutty Tie!";
    }
}

function togglePause() {
    if (isGameOver || isCountingDown) return; // Can't pause if game not running

    isPaused = !isPaused;
    pauseIndicatorDisplay.style.display = isPaused ? 'block' : 'none';

    if (isPaused) {
         if (music) music.pause(); // Stop music when paused
         // Stop game intervals/timeouts that need pausing (timer already checks isPaused)
         // If using setTimeout for spawning, clear it here and restart on unpause
         cancelAnimationFrame(gameLoopId); // Stop the main loop
    } else {
         if (music && !isGameOver) music.play().catch(e => console.log("Music resume failed:", e)); // Resume music
         // Resume game intervals/timeouts
         requestAnimationFrame(gameLoop); // Restart the main loop
    }
}

// --- Game States ---
function showCountdown() {
    isCountingDown = true;
    isGameOver = true; // Keep game over state during countdown
    isPaused = false;
    countdownDisplay.style.display = 'block';
    pauseIndicatorDisplay.style.display = 'none';
    gameOverDisplay.style.display = 'none';

    let count = 3;
    countdownDisplay.textContent = count;

    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownDisplay.textContent = count;
            playSound(catchSound); // Simple tick sound
        } else {
            countdownDisplay.textContent = "GO!";
            playSound(powerupSound); // Go sound
            clearInterval(countdownInterval);
            setTimeout(() => {
                countdownDisplay.style.display = 'none';
                isCountingDown = false;
                startGame(); // Actually start the game logic now
            }, 500); // Show "GO!" for half a second
        }
    }, 800); // Interval for countdown numbers
}

function startGame() {
    isGameOver = false;
    isPaused = false;
    keysPressed = {};
    items = [];
    particles = [];
    timerValue = GAME_DURATION;
    currentSpawnInterval = INITIAL_SPAWN_INTERVAL;
    lastSpawnTime = 0; // Reset spawn timer
    megaNutSpawned = false;

    // Reset players
    player1.reset(CANVAS_WIDTH / 4 - PLAYER_WIDTH / 2);
    player2.reset((CANVAS_WIDTH * 3) / 4 - PLAYER_WIDTH / 2);

    // Reset UI
    updateScoreUI(player1, score1Display, 0);
    updateScoreUI(player2, score2Display, 0);
    timerDisplay.textContent = `Time: ${timerValue}`;
    gameOverDisplay.style.display = 'none';
    pauseIndicatorDisplay.style.display = 'none';

    // Clear existing intervals if any
    if (timerInterval) clearInterval(timerInterval);

    // Start timer
    timerInterval = setInterval(updateTimer, 1000);

    // Start background music
    if (music) {
        music.currentTime = 0;
        music.play().catch(e => console.log("Music play failed:", e));
    }

    // Start game loop
    if (gameLoopId) cancelAnimationFrame(gameLoopId); // Ensure no previous loop runs
    gameLoopId = requestAnimationFrame(gameLoop);
}

function endGame() {
    isGameOver = true;
    isPaused = false; // Ensure not paused
    if (timerInterval) clearInterval(timerInterval);
    if (gameLoopId) cancelAnimationFrame(gameLoopId); // Stop the loop
    gameLoopId = null;

    // Stop music
    if (music) music.pause();

    // Display Game Over message
    const winnerText = determineWinner();
    
    // Awards Logic
    const getAwards = (p) => {
        let awards = [];
        if (p.stats.nuts > 30) awards.push("👑 Nut King");
        if (p.stats.golden > 5) awards.push("✨ Gold Digger");
        if (p.stats.rocks > 3) awards.push("🪨 Rock Magnet");
        if (p.score > 80) awards.push("🐿️ Super Squirrel");
        return awards.length > 0 ? awards.join(" | ") : "🌟 Good Effort!";
    };

    // Save High Scores
    if (player1.score > hsNutColletas) {
        hsNutColletas = player1.score;
        localStorage.setItem('nutRush_hsColletas', hsNutColletas);
    }
    if (player2.score > hsNutWilly) {
        hsNutWilly = player2.score;
        localStorage.setItem('nutRush_hsWilly', hsNutWilly);
    }

    const awardsP1 = getAwards(player1);
    const awardsP2 = getAwards(player2);

    finalScoreDisplay.innerHTML = `
        <div style="margin-bottom:10px;">
           <b>${player1.name}:</b> ${player1.score} (Best: ${hsNutColletas})<br/>
           <small style="color:#FFD700">${awardsP1}</small>
        </div>
        <div style="margin-bottom:10px;">
           <b>${player2.name}:</b> ${player2.score} (Best: ${hsNutWilly})<br/>
           <small style="color:#FFD700">${awardsP2}</small>
        </div>
        <div style="margin-top:15px; font-size: 18px;">
            <a href="../index.html" style="color: #4CAF50; text-decoration: none; border: 2px solid #4CAF50; padding: 5px 15px; border-radius: 20px;">Back to Game Hub</a>
        </div>
    `;
    winnerDisplay.textContent = winnerText;
    gameOverDisplay.style.display = 'block';

    // Clear any lingering powerups visually/logically (reset does this, but good practice)
    player1.reset(player1.x); // Reset powerups but keep final position
    player2.reset(player2.x);
}

function restartGame() {
    // Simply trigger the countdown again
    showCountdown();
}

// --- Main Game Loop ---
function gameLoop(timestamp) { // timestamp provided by requestAnimationFrame
    if (isPaused || isGameOver || isCountingDown) {
         // If paused or game over, don't run game logic, but keep requesting frame if needed for pause screen etc.
         // For this setup, we only need to request again if unpausing.
         // If game is truly over or counting down, loop stops until restart.
        return;
    }

    // --- Updates ---
    player1.update(keysPressed);
    player2.update(keysPressed);

    // Item Spawning (time-based)
    if (timestamp - lastSpawnTime > currentSpawnInterval) {
        spawnItem();
        lastSpawnTime = timestamp;
    }

    updateItems();
    updateParticles();
    updatePopups();
    checkCollisions();

    // Mega Nut Spawn at 10s
    if (timerValue <= 10 && !megaNutSpawned) {
        megaNutSpawned = true;
        const props = ITEM_PROPS[ITEM_TYPES.MEGA_NUT];
        items.push({
            x: CANVAS_WIDTH / 2 - 40,
            y: -100,
            size: 80,
            speed: 5,
            color: props.color,
            type: ITEM_TYPES.MEGA_NUT,
            value: props.score,
            rotation: 0,
            rotationSpeed: 0.1
        });
    }

    // --- Drawing ---
    clearCanvas();
    drawItems();
    drawParticles();
    drawPopups();
    player1.draw();
    player2.draw();

    // Request next frame
    gameLoopId = requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
window.addEventListener('keydown', (e) => {
    keysPressed[e.key.toLowerCase()] = true; // Use lowercase for consistency (e.g. 'a' vs 'A')
    // Handle pause key separately
    if (e.key.toLowerCase() === 'p') {
        togglePause();
    }
});

window.addEventListener('keyup', (e) => {
    keysPressed[e.key.toLowerCase()] = false;
});

// --- Touch / Mouse Controls ---
function setupTouchControls() {
    const bindButton = (btnId, keyStr) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        // Press down
        const press = (e) => {
            e.preventDefault(); // Prevent default touch actions (scrolling/zooming)
            keysPressed[keyStr] = true;
        };

        // Release
        const release = (e) => {
            e.preventDefault();
            keysPressed[keyStr] = false;
        };

        // Touch events
        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release, { passive: false });
        btn.addEventListener('touchcancel', release, { passive: false });

        // Mouse fallbacks (for testing on desktop)
        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
    };

    // P1 (Collets) -> 'a' and 'd'
    bindButton('btn-p1-left', 'a');
    bindButton('btn-p1-right', 'd');

    // P2 (Willy) -> 'arrowleft' and 'arrowright'
    bindButton('btn-p2-left', 'arrowleft');
    bindButton('btn-p2-right', 'arrowright');

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


// --- Initial Setup ---
// Start with the countdown when the page loads
window.onload = () => {
    // Ensure players are drawn initially even before game starts
    clearCanvas();
    player1.draw();
    player2.draw();
    // Show initial UI state correctly
    score1Display.textContent = `${player1.name}: 0`;
    score2Display.textContent = `${player2.name}: 0`;
    timerDisplay.textContent = `Time: ${GAME_DURATION}`;

    setupTouchControls(); // Initialize touch buttons

    // Click handler to start the game
    startBtn.addEventListener('click', () => {
        startScreen.classList.add('hidden');
        resetGame(); // Ensure state is fresh
        showCountdown(); // Start the game flow
    });
};