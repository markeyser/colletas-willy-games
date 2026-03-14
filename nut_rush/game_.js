const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const score1Display = document.getElementById('score1');
const score2Display = document.getElementById('score2');
const timerDisplay = document.getElementById('timer');
const gameOverDisplay = document.getElementById('gameOver');
const finalScoreDisplay = document.getElementById('finalScore');

// Game Variables
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;
let timerValue = 60;
let timerInterval = null;
let gameLoopInterval = null;
let nuts = [];
let keysPressed = {}; // Keep track of pressed keys
let gameOver = false;
let nutSpawnRate = 1000; // Milliseconds between nut spawns
let lastNutSpawn = 0;

// Player Properties
const playerWidth = 50;
const playerHeight = 60;
const playerSpeed = 7;

const player1 = {
    x: canvasWidth / 4 - playerWidth / 2,
    y: canvasHeight - playerHeight - 10,
    width: playerWidth,
    height: playerHeight,
    color: '#D2691E', // Chocolate brown
    score: 0,
    name: "Collets",
    draw: function() {
        // Body
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Funny Pigtails for Collets
        ctx.fillStyle = '#8B4513'; // Darker brown
        // Left Pigtail
        ctx.beginPath();
        ctx.arc(this.x + 5, this.y + 5, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(this.x - 5, this.y + 10, 10, 15); // Hanging part
        // Right Pigtail
        ctx.beginPath();
        ctx.arc(this.x + this.width - 5, this.y + 5, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(this.x + this.width - 5, this.y + 10, 10, 15); // Hanging part

        // Eyes (simple dots)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x + 15, this.y + 25, 5, 0, Math.PI * 2);
        ctx.arc(this.x + this.width - 15, this.y + 25, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x + 17, this.y + 27, 2, 0, Math.PI * 2);
        ctx.arc(this.x + this.width - 13, this.y + 27, 2, 0, Math.PI * 2);
        ctx.fill();

        // Funny Mouth
         ctx.strokeStyle = 'black';
         ctx.lineWidth = 2;
         ctx.beginPath();
         ctx.arc(this.x + this.width / 2, this.y + 40, 10, 0.2 * Math.PI, 0.8 * Math.PI);
         ctx.stroke();
    }
};

const player2 = {
    x: (canvasWidth * 3) / 4 - playerWidth / 2,
    y: canvasHeight - playerHeight - 10,
    width: playerWidth,
    height: playerHeight,
    color: '#A0522D', // Sienna brown
    score: 0,
    name: "Willy",
    draw: function() {
        // Body
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Glasses for Willy
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        // Left lens
        ctx.beginPath();
        ctx.arc(this.x + 15, this.y + 25, 10, 0, Math.PI * 2);
        ctx.stroke();
        // Right lens
        ctx.beginPath();
        ctx.arc(this.x + this.width - 15, this.y + 25, 10, 0, Math.PI * 2);
        ctx.stroke();
        // Bridge
        ctx.beginPath();
        ctx.moveTo(this.x + 25, this.y + 25);
        ctx.lineTo(this.x + this.width - 25, this.y + 25);
        ctx.stroke();

         // Eyes behind glasses
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x + 15, this.y + 25, 3, 0, Math.PI * 2); // Smaller pupil
        ctx.arc(this.x + this.width - 15, this.y + 25, 3, 0, Math.PI * 2);
        ctx.fill();

        // Simple Mouth
         ctx.strokeStyle = 'black';
         ctx.lineWidth = 2;
         ctx.beginPath();
         ctx.moveTo(this.x + 15, this.y + 45);
         ctx.lineTo(this.x + this.width - 15, this.y + 45);
         ctx.stroke();
    }
};

// Nut Properties
const nutSize = 15;
const nutSpeed = 2;

function createNut() {
    nuts.push({
        x: Math.random() * (canvasWidth - nutSize),
        y: -nutSize, // Start above the screen
        size: nutSize,
        speed: nutSpeed + Math.random() * 2, // Add slight speed variation
        color: '#8B4513' // Dark brown for nuts
    });
}

function updateNutPositions() {
    for (let i = nuts.length - 1; i >= 0; i--) {
        nuts[i].y += nuts[i].speed;

        // Remove nuts that fall off the bottom
        if (nuts[i].y > canvasHeight) {
            nuts.splice(i, 1);
        }
    }
}

function drawNuts() {
    nuts.forEach(nut => {
        ctx.fillStyle = nut.color;
        ctx.beginPath();
        // Draw a slightly irregular oval for a nut shape
        ctx.ellipse(nut.x + nut.size / 2, nut.y + nut.size / 2, nut.size / 2, nut.size / 2.5, Math.PI / 4, 0, 2 * Math.PI);
        ctx.fill();
    });
}

function handleInput() {
    // Player 1 Controls (A and D)
    if (keysPressed['a'] || keysPressed['A']) {
        player1.x -= playerSpeed;
    }
    if (keysPressed['d'] || keysPressed['D']) {
        player1.x += playerSpeed;
    }

    // Player 2 Controls (Left and Right Arrows)
    if (keysPressed['ArrowLeft']) {
        player2.x -= playerSpeed;
    }
    if (keysPressed['ArrowRight']) {
        player2.x += playerSpeed;
    }

    // Keep players within canvas bounds
    player1.x = Math.max(0, Math.min(canvasWidth - player1.width, player1.x));
    player2.x = Math.max(0, Math.min(canvasWidth - player2.width, player2.x));
}

function checkCollisions() {
    for (let i = nuts.length - 1; i >= 0; i--) {
        let nut = nuts[i];

        // Check collision with Player 1
        if (nut.x < player1.x + player1.width &&
            nut.x + nut.size > player1.x &&
            nut.y < player1.y + player1.height &&
            nut.y + nut.size > player1.y)
        {
            player1.score++;
            score1Display.textContent = `${player1.name}: ${player1.score}`;
            nuts.splice(i, 1); // Remove the caught nut
            continue; // Skip checking player 2 for this nut
        }

        // Check collision with Player 2
        if (nut.x < player2.x + player2.width &&
            nut.x + nut.size > player2.x &&
            nut.y < player2.y + player2.height &&
            nut.y + nut.size > player2.y)
        {
            player2.score++;
            score2Display.textContent = `${player2.name}: ${player2.score}`;
            nuts.splice(i, 1); // Remove the caught nut
        }
    }
}

function updateTimer() {
    if (gameOver) return; // Stop timer if game over

    timerValue--;
    timerDisplay.textContent = `Time: ${timerValue}`;

    if (timerValue <= 0) {
        endGame();
    }
}

function drawUI() {
    // Scores and Timer are updated via HTML elements now
    // You could draw them on canvas too if preferred:
    // ctx.fillStyle = 'black';
    // ctx.font = '20px Arial';
    // ctx.fillText(`Collets: ${player1.score}`, 10, 25);
    // ctx.fillText(`Willy: ${player2.score}`, canvasWidth - 120, 25);
    // ctx.fillText(`Time: ${timerValue}`, canvasWidth / 2 - 40, 25);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    // Optionally draw a background if not using CSS background
    // ctx.fillStyle = '#e0f7fa';
    // ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

function determineWinner() {
    if (player1.score > player2.score) {
        return `${player1.name} wins!`;
    } else if (player2.score > player1.score) {
        return `${player2.name} wins!`;
    } else {
        return "It's a tie!";
    }
}

function endGame() {
    gameOver = true;
    clearInterval(timerInterval);
    cancelAnimationFrame(gameLoopInterval); // Stop the game loop

    // Display Game Over message
    const winnerText = determineWinner();
    finalScoreDisplay.textContent = `Final Scores - ${player1.name}: ${player1.score} | ${player2.name}: ${player2.score} \n ${winnerText}`;
    gameOverDisplay.style.display = 'block';

    console.log("Game Over!");
}

function gameLoop(timestamp) {
    if (gameOver) return;

    clearCanvas();
    handleInput();

    // Spawn nuts based on time elapsed
    if (timestamp - lastNutSpawn > nutSpawnRate) {
        createNut();
        lastNutSpawn = timestamp;
        // Optionally increase difficulty slightly over time
        // nutSpawnRate = Math.max(200, nutSpawnRate * 0.995);
    }

    updateNutPositions();
    checkCollisions();

    player1.draw();
    player2.draw();
    drawNuts();
    // drawUI(); // UI is handled by HTML elements mostly

    gameLoopInterval = requestAnimationFrame(gameLoop);
}

function startGame() {
    gameOver = false;
    player1.score = 0;
    player2.score = 0;
    player1.x = canvasWidth / 4 - playerWidth / 2; // Reset positions
    player2.x = (canvasWidth * 3) / 4 - playerWidth / 2;
    nuts = [];
    timerValue = 60;
    lastNutSpawn = 0;
    keysPressed = {};

    score1Display.textContent = `${player1.name}: ${player1.score}`;
    score2Display.textContent = `${player2.name}: ${player2.score}`;
    timerDisplay.textContent = `Time: ${timerValue}`;
    gameOverDisplay.style.display = 'none'; // Hide game over screen

    // Clear existing intervals if any (important for restart)
    if (timerInterval) clearInterval(timerInterval);
    if (gameLoopInterval) cancelAnimationFrame(gameLoopInterval);

    // Start timer
    timerInterval = setInterval(updateTimer, 1000);

    // Start game loop
    gameLoopInterval = requestAnimationFrame(gameLoop);
}

function restartGame() {
    startGame();
}

// Event Listeners for Keyboard Input
window.addEventListener('keydown', (e) => {
    keysPressed[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    keysPressed[e.key] = false;
});

// Start the game when the page loads
window.onload = startGame;