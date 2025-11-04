// Créer des nuages décoratifs
const cloudsContainer = document.getElementById('clouds');
for (let i = 0; i < 5; i++) {
    const cloud = document.createElement('div');
    cloud.className = 'cloud';
    cloud.style.width = Math.random() * 100 + 80 + 'px';
    cloud.style.height = Math.random() * 40 + 30 + 'px';
    cloud.style.top = Math.random() * 30 + '%';
    cloud.style.left = Math.random() * 100 + '%';
    cloud.style.animationDuration = Math.random() * 20 + 30 + 's';
    cloudsContainer.appendChild(cloud);
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Variables du jeu
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let score = 0;
let highScore = parseInt(localStorage.getItem('dinoHighScore')) || 0;
let gameSpeed = 6;
let gravity = 0.6;
let frameCount = 0;

// Dinosaure
const dino = {
    x: 100,
    y: 300,
    width: 50,
    height: 50,
    jumping: false,
    velocityY: 0,
    jumpPower: -15,
    running: true
};

// Obstacles
let obstacles = [];
let obstacleTimer = 0;
let obstacleInterval = 100;

// Nuages dans le jeu
let gameClouds = [];
for (let i = 0; i < 3; i++) {
    gameClouds.push({
        x: Math.random() * canvas.width,
        y: Math.random() * 100 + 20,
        width: Math.random() * 60 + 40,
        speed: Math.random() * 0.5 + 0.3
    });
}

// Sol
let groundX = 0;

// Mise à jour du meilleur score
document.getElementById('highScore').textContent = highScore;

// Dessiner le dinosaure avec animation
function drawDino() {
    ctx.fillStyle = '#2ecc71';
    
    // Corps
    ctx.fillRect(dino.x, dino.y, dino.width, dino.height - 10);
    
    // Tête
    ctx.fillRect(dino.x + 30, dino.y - 15, 25, 25);
    
    // Œil
    ctx.fillStyle = 'white';
    ctx.fillRect(dino.x + 45, dino.y - 10, 6, 6);
    ctx.fillStyle = 'black';
    ctx.fillRect(dino.x + 47, dino.y - 8, 3, 3);
    
    // Queue
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(dino.x - 10, dino.y + 10, 15, 10);
    
    // Jambes avec animation
    ctx.fillStyle = '#27ae60';
    if (dino.running && frameCount % 10 < 5) {
        ctx.fillRect(dino.x + 10, dino.y + 40, 10, 20);
        ctx.fillRect(dino.x + 30, dino.y + 40, 10, 15);
    } else {
        ctx.fillRect(dino.x + 10, dino.y + 40, 10, 15);
        ctx.fillRect(dino.x + 30, dino.y + 40, 10, 20);
    }
}

// Dessiner les obstacles (cactus)
function drawObstacle(obs) {
    ctx.fillStyle = '#27ae60';
    
    // Corps du cactus
    ctx.fillRect(obs.x, obs.y, 20, obs.height);
    
    // Bras du cactus
    if (obs.type === 1) {
        ctx.fillRect(obs.x - 10, obs.y + 15, 10, 15);
        ctx.fillRect(obs.x + 20, obs.y + 20, 10, 15);
    } else if (obs.type === 2) {
        ctx.fillRect(obs.x - 10, obs.y + 10, 10, 20);
    }
    
    // Épines
    ctx.fillStyle = '#1e8449';
    for (let i = 0; i < obs.height; i += 10) {
        ctx.fillRect(obs.x - 2, obs.y + i, 4, 4);
        ctx.fillRect(obs.x + 18, obs.y + i, 4, 4);
    }
}

// Dessiner le sol
function drawGround() {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, 360, canvas.width, 40);
    
    // Lignes du sol
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    for (let i = groundX % 30; i < canvas.width; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 360);
        ctx.lineTo(i + 10, 360);
        ctx.stroke();
    }
}

// Dessiner les nuages
function drawClouds() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    gameClouds.forEach(cloud => {
        ctx.fillRect(cloud.x, cloud.y, cloud.width, 30);
        ctx.fillRect(cloud.x + 10, cloud.y - 10, cloud.width - 20, 20);
    });
}

// Mettre à jour le jeu
function update() {
    if (gameState !== 'playing') return;

    frameCount++;
    score++;
    document.getElementById('score').textContent = Math.floor(score / 10);

    // Augmenter la difficulté progressivement
    if (frameCount % 300 === 0) {
        gameSpeed += 0.5;
        obstacleInterval = Math.max(60, obstacleInterval - 5);
    }

    // Mouvement du sol
    groundX -= gameSpeed;

    // Mouvement des nuages
    gameClouds.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.width < 0) {
            cloud.x = canvas.width;
            cloud.y = Math.random() * 100 + 20;
        }
    });

    // Gravité et saut
    if (dino.jumping) {
        dino.velocityY += gravity;
        dino.y += dino.velocityY;

        if (dino.y >= 300) {
            dino.y = 300;
            dino.jumping = false;
            dino.velocityY = 0;
        }
    }

    // Créer des obstacles
    obstacleTimer++;
    if (obstacleTimer > obstacleInterval) {
        const height = Math.random() * 30 + 40;
        obstacles.push({
            x: canvas.width,
            y: 360 - height,
            width: 20,
            height: height,
            type: Math.floor(Math.random() * 3)
        });
        obstacleTimer = 0;
    }

    // Déplacer et nettoyer les obstacles
    obstacles = obstacles.filter(obs => {
        obs.x -= gameSpeed;
        return obs.x + obs.width > 0;
    });

    // Détection de collision
    obstacles.forEach(obs => {
        if (dino.x < obs.x + obs.width - 10 &&
            dino.x + dino.width - 10 > obs.x &&
            dino.y < obs.y + obs.height &&
            dino.y + dino.height > obs.y) {
            gameOver();
        }
    });
}

// Dessiner tout
function draw() {
    // Ciel
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(0.5, '#E0F6FF');
    gradient.addColorStop(1, '#FFE5B4');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawClouds();
    drawGround();
    drawDino();
    obstacles.forEach(drawObstacle);
}

// Boucle du jeu
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Sauter
function jump() {
    if (!dino.jumping && gameState === 'playing') {
        dino.jumping = true;
        dino.velocityY = dino.jumpPower;
    }
}

// Game Over
function gameOver() {
    gameState = 'gameOver';
    dino.running = false;
    
    const finalScore = Math.floor(score / 10);
    document.getElementById('finalScore').textContent = finalScore;
    
    if (finalScore > highScore) {
        highScore = finalScore;
        localStorage.setItem('dinoHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
    
    document.getElementById('gameOverScreen').classList.add('show');
}

// Démarrer le jeu
function startGame() {
    gameState = 'playing';
    score = 0;
    gameSpeed = 6;
    frameCount = 0;
    obstacles = [];
    obstacleTimer = 0;
    obstacleInterval = 100;
    dino.y = 300;
    dino.jumping = false;
    dino.velocityY = 0;
    dino.running = true;
    
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.remove('show');
    document.getElementById('score').textContent = '0';
}

// Événements
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'start') {
            startGame();
        } else {
            jump();
        }
    }
});

canvas.addEventListener('click', () => {
    if (gameState === 'start') {
        startGame();
    } else {
        jump();
    }
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

// Démarrer la boucle
gameLoop();