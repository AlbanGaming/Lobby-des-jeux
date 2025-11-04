document.addEventListener('DOMContentLoaded', () => {
    const dino = document.querySelector('.dino');
    const obstacle = document.querySelector('.obstacle');
    const gameOverText = document.querySelector('.game-over');
    const scoreDisplay = document.getElementById('score');
    const restartButton = document.getElementById('restart-btn');
    const speedIncreaseInterval = 30000; // Interval de temps pour augmenter la vitesse (30 secondes)
    let isJumping = false;
    let gravityInterval;
    let gameInterval;
    let score = 0;
    let obstacleSpeed = 4; // Vitesse de départ des obstacles
    let lastSpeedIncreaseTime = 0; // Temps du dernier ajustement de vitesse

    function jump() {
        if (!isJumping && gameOverText.style.display !== 'block') {
            isJumping = true;
            let position = 0;
            const jumpInterval = setInterval(() => {
                if (position === 200) {
                    clearInterval(jumpInterval);
                    let downInterval = setInterval(() => {
                        if (position === 0) {
                            clearInterval(downInterval);
                            isJumping = false;
                            clearInterval(gravityInterval);
                            gravityInterval = setInterval(gravity, 40);
                        }
                        position -= 5;
                        dino.style.bottom = position + 'px';
                    }, 20);
                }
                position += 5;
                dino.style.bottom = position + 'px';
            }, 20);
        }
    }

    function gravity() {
        let dinoBottom = parseInt(window.getComputedStyle(dino).getPropertyValue('bottom'));
        if (dinoBottom > 0) {
            dino.style.bottom = (dinoBottom - 2) + 'px';
        }
    }

    function restartGame() {
        score = 0;
        scoreDisplay.textContent = score;
        dino.style.bottom = '0px';
        obstacle.style.left = '800px';
        gameOverText.style.display = 'none';
        clearInterval(gameInterval);
        clearInterval(gravityInterval);
        obstacleSpeed = 4; // Réinitialise la vitesse des obstacles
        lastSpeedIncreaseTime = 0; // Réinitialise le temps du dernier ajustement de vitesse

        setTimeout(() => {
            gameInterval = setInterval(gameLoop, 20);
            gravityInterval = setInterval(gravity, 40);
        }, 500);
    }

    function handleKeyDown(event) {
        if (event.code === 'Space') {
            jump();
        }
    }

    function gameLoop() {
        const obstacleLeft = parseInt(window.getComputedStyle(obstacle).getPropertyValue('left'));

        if (obstacleLeft < 0) {
            obstacle.style.left = '800px';

            // Augmente la vitesse des obstacles si le temps écoulé dépasse l'intervalle de temps pour augmenter la vitesse
            if (performance.now() - lastSpeedIncreaseTime > speedIncreaseInterval) {
                obstacleSpeed += 1;
                lastSpeedIncreaseTime = performance.now();
            }
        } else {
            obstacle.style.left = obstacleLeft - obstacleSpeed + 'px';
        }

        const dinoBottom = parseInt(window.getComputedStyle(dino).getPropertyValue('bottom'));
        const obstacleLeftVal = parseInt(window.getComputedStyle(obstacle).getPropertyValue('left'));

        if (obstacleLeftVal < 50 && obstacleLeftVal > 0 && dinoBottom < 50) {
            gameOverText.style.display = 'block';
            clearInterval(gameInterval);
            clearInterval(gravityInterval);
            obstacle.style.animation = 'none';
        }

        score += 5;
        scoreDisplay.textContent = score;
    }

    document.addEventListener('keydown', handleKeyDown);

    gameInterval = setInterval(gameLoop, 20);
    gravityInterval = setInterval(gravity, 40);

    gameOverText.addEventListener('click', restartGame);
    restartButton.addEventListener('click', restartGame);
});
