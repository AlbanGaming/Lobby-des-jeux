const bird = document.getElementById("bird");
const gameArea = document.getElementById("gameArea");
let birdTop = 220; // Position initiale de l'oiseau dans la zone de jeu
let gravity = 0.8; // Nouvelle valeur de gravité
let gameEnd = false;
let jumpOffset = 0; // Décalage du saut initial à zéro
let pipes = []; // Tableau pour stocker les tuyaux
let pipeInterval; // Interval pour générer les tuyaux
let score = 0; // Variable pour stocker le score

const scoreElement = document.createElement("div"); // Création de l'élément pour afficher le score
scoreElement.classList.add("score");
scoreElement.innerText = "Score: " + score;
gameArea.appendChild(scoreElement); // Ajout de l'élément à la zone de jeu

function updateScore() {
    setInterval(() => {
        score++; // Incrémentation du score
        scoreElement.innerText = "Score: " + score; // Mise à jour de l'affichage du score
    }, 2000); // Mettre à jour le score toutes les 2 secondes
}


// Fonction pour générer aléatoirement la hauteur des tuyaux
function randomPipeHeight() {
    return Math.floor(Math.random() * 150) + 100; // Hauteur aléatoire entre 100 et 250 pixels
}

// Fonction pour faire bouger les tuyaux
function movePipes() {
    pipes.forEach(pipe => {
        pipe.style.left = parseInt(pipe.style.left) - 2 + "px"; // Déplacement vers la gauche à une vitesse de 2 pixels par frame
    });

    // Supprimer les tuyaux qui sortent de l'écran
    pipes = pipes.filter(pipe => parseInt(pipe.style.left) > -50);

    // Vérifier la collision avec les tuyaux
    const birdRect = bird.getBoundingClientRect();

    pipes.forEach(pipe => {
        const pipeRect = pipe.getBoundingClientRect();

        // Vérifier si l'oiseau est à l'intérieur du tuyau
        if (
            birdRect.left < pipeRect.right &&
            birdRect.right > pipeRect.left &&
            birdRect.top < pipeRect.bottom &&
            birdRect.bottom > pipeRect.top
        ) {
            gameOver(); // Collision détectée, déclencher game over
        }
    });
}

// Fonction pour créer les tuyaux
function createPipe(height) {
    const pipeTop = document.createElement("div");
    const pipeBottom = document.createElement("div");
    pipeTop.classList.add("pipe");
    pipeTop.style.height = height + "px";
    pipeTop.style.left = "600px";
    pipeTop.style.bottom = "0";
    gameArea.appendChild(pipeTop);
    pipes.push(pipeTop);

    pipeBottom.classList.add("pipe");
    pipeBottom.style.height = gameArea.clientHeight - height - 150 + "px"; // Hauteur de la zone de jeu - hauteur du tuyau supérieur - espace entre les tuyaux
    pipeBottom.style.left = "600px";
    pipeBottom.style.top = "0";
    gameArea.appendChild(pipeBottom);
    pipes.push(pipeBottom);
}

document.addEventListener("keydown", jump);

function jump(event) {
    if (event.code === "Space") {
        birdTop -= 70; // Augmentez la valeur pour obtenir un saut plus haut
        jumpOffset = 20; // Décalage initial du saut
    }
}

function resetGame() {
    birdTop = 220; // Réinitialiser la position de l'oiseau
    bird.style.top = birdTop + "px";
    gameEnd = false;
    gameLoop();
    restartButton.style.display = "none"; // Cacher le bouton "Recommencer"
}

const restartButton = document.createElement("button"); // Déclaration et initialisation de restartButton

function showGameOver() {
    const gameOverElement = document.createElement("div");
    gameOverElement.innerText = "Game Over";
    gameOverElement.style.position = "absolute";
    gameOverElement.style.top = "50%";
    gameOverElement.style.left = "50%";
    gameOverElement.style.transform = "translate(-50%, -50%)";
    gameOverElement.style.fontSize = "36px";
    gameOverElement.style.color = "red";
    document.body.appendChild(gameOverElement);

    setTimeout(() => {
        document.body.removeChild(gameOverElement);
        restartButton.style.display = "block"; // Affiche le bouton "Recommencer"
    }, 3000); // Supprime le message "Game Over" après 3 secondes

    restartButton.innerText = "Recommencer";
    restartButton.style.position = "absolute";
    restartButton.style.top = "60%";
    restartButton.style.left = "50%";
    restartButton.style.transform = "translateX(-50%)";
    restartButton.addEventListener("click", resetGame);
    document.body.appendChild(restartButton); // Ajout du bouton "Recommencer" au DOM
}


function gameLoop() {
    birdTop += gravity;

    // Limiter la position de l'oiseau à l'intérieur de la zone de jeu
    if (birdTop < 0) {
        birdTop = 0;
    } else if (birdTop > gameArea.clientHeight - bird.clientHeight) {
        birdTop = gameArea.clientHeight - bird.clientHeight;
    }

    bird.style.top = birdTop + "px";

    // Vérifier si l'oiseau touche le haut ou le bas de la zone de jeu
    if (birdTop <= 0 || birdTop >= gameArea.clientHeight - bird.clientHeight) {
        gameOver();
    }

    // Déplacer les tuyaux
    movePipes();

    if (!gameEnd) {
        requestAnimationFrame(gameLoop);
    }
}

function gameOver() {
    gameEnd = true;
    console.log("Game Over!");
    showGameOver();
    clearInterval(pipeInterval); // Arrêter la génération de nouveaux tuyaux
    // Supprimer les tuyaux existants
    pipes.forEach(pipe => {
        pipe.remove();
    });
}

function resetGame() {
    birdTop = 220; // Réinitialiser la position de l'oiseau
    bird.style.top = birdTop + "px";
    gameEnd = false;
    gameLoop();
    restartButton.style.display = "none"; // Cacher le bouton "Recommencer"
    // Regénérer les tuyaux
    pipes = [];
    clearInterval(pipeInterval); // Arrêter l'interval précédent s'il existe
    pipeInterval = setInterval(() => {
        const pipeHeight = randomPipeHeight();
        createPipe(pipeHeight);
    }, 1500);
}

// Générer les tuyaux à intervalles réguliers
pipeInterval = setInterval(() => {
    const pipeHeight = randomPipeHeight();
    createPipe(pipeHeight);
}, 1500);

gameLoop();

restartButton.id = "restartButton";

let retourLobbyBtn = document.createElement('button');
retourLobbyBtn.textContent = "Retour lobby";
retourLobbyBtn.addEventListener('click', function() {
  window.location.href = "index.html";
});

document.body.appendChild(retourLobbyBtn);