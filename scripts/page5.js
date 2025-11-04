let score = 0;
let bubbles = [];
let timer;
let gameInterval = 1500; // Interval initial entre chaque apparition de bulle
let gameInProgress = false;
let timeLeft = 0;
let maxGameInterval = 10;
let gameEnded = true;

// Appel initial pour afficher le timer à 30 au chargement de la page
updateTimerDisplay();

function startGame() {
  if (gameInProgress) return;
  if (!gameEnded) return;
  gameEnded = false;
  gameInProgress = true;
  document.getElementById("start-button").disabled = true;

  // Initialiser le timer à 30 lorsque la partie commence
  timeLeft = 30;
  updateTimerDisplay();

  score = 0;
  updateScore();
  bubbles = [];
  gameInterval = 1000; // Réduit l'intervalle à sa valeur initiale
  timeLeft = 30;
  updateTimerDisplay();
  timer = setInterval(createAndAdjustBubble, gameInterval);
  setTimeout(endGame, timeLeft * 1000);
}

function createAndAdjustBubble() {
  createBubble();
  adjustBubbleSpeed();
}

function createBubble() {
  const bubble = document.createElement("div");
  bubble.classList.add("bubble");
  bubble.style.top = `${Math.random() * 80 + 10}%`;
  bubble.style.left = `${Math.random() * 80 + 10}%`;
  bubble.addEventListener("click", popBubble);
  document.getElementById("game-board").appendChild(bubble);
  bubbles.push(bubble);

  // Supprimer la bulle après 2 secondes si elle n'est pas cliquée
  setTimeout(() => {
    if (bubbles.includes(bubble)) {
      bubble.remove();
      bubbles.splice(bubbles.indexOf(bubble), 1);
    }
  }, 3000);
}

function adjustBubbleSpeed() {
  // Augmenter la vitesse progressivement
  if (timeLeft < 15) {
    // Quand il reste moins de 15 secondes, augmentez la vitesse plus rapidement
    gameInterval -= 1000;
  } else if (timeLeft < 20) {
    // Quand il reste moins de 20 secondes, augmentez la vitesse un peu plus rapidement
    gameInterval -= 800;
  } else {
    // Sinon, augmentez la vitesse normalement
    gameInterval -= 700;
  }
  // Limiter la vitesse minimale
  if (gameInterval < 350) {
    gameInterval = 350;
  }

  clearInterval(timer);
  timer = setInterval(createAndAdjustBubble, gameInterval);
}

function popBubble() {
  score++;
  updateScore();
  this.remove();
  bubbles.splice(bubbles.indexOf(this), 1);
}

function updateScore() {
  document.getElementById("score").textContent = `Score: ${score}`;
}

function updateTimerDisplay() {
  document.getElementById("timer").textContent = `Time Left: ${timeLeft}`;
}

function endGame() {
  clearInterval(timer);
  gameInProgress = false;
  gameEnded = true;
  document.getElementById("start-button").disabled = false;
  document.getElementById("game-over").textContent = `Game Over! Your final score is ${score}.`;
  document.querySelectorAll(".bubble").forEach((bubble) => bubble.remove());
}

function countDown() {
  if (timeLeft > 0) {
    timeLeft--;
    updateTimerDisplay();
  }
  if (timeLeft === 0) {
    clearInterval(timer);
    endGame();
  }
}

setInterval(countDown, 1000);

function returnToLobby() {
  if (gameInProgress) {
    return; // Ne rien faire si la partie est en cours
  } else {
    // Rediriger vers la page "index.html"
    window.location.href = "index.html";
  }
}
