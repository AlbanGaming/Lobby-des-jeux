const riddles = [];

const riddleElement = document.getElementById('riddle');
const userAnswerElement = document.getElementById('userAnswer');
const resultElement = document.getElementById('result');

let currentRiddle;

function addRiddle(question, answer) {
  riddles.push({ question: question, answer: answer });
}

function getRandomRiddle() {
  return riddles[Math.floor(Math.random() * riddles.length)];
}

function displayRiddle() {
  if (!currentRiddle) {
    currentRiddle = getRandomRiddle();
  }
  riddleElement.textContent = currentRiddle.question;
  userAnswerElement.value = '';
  resultElement.textContent = '';
}

function checkAnswer() {
  const userAnswer = userAnswerElement.value.trim().toLowerCase();
  if (userAnswer === currentRiddle.answer.toLowerCase()) {
    resultElement.textContent = "Bravo, tu as deviné juste !";
    currentRiddle = null; // Réinitialise la devinette actuelle
    setTimeout(displayRiddle, 2000); // Change la devinette après 2 secondes
  } else {
    resultElement.textContent = "Dommage, ce n'est pas la bonne réponse. Essaye encore !";
  }
}

// Ajout de nouvelles devinettes
addRiddle("Qu'est-ce qui est plein de trous mais contient de l'eau ?", "Une eponge");
addRiddle("Qu'est-ce qui voyage dans le monde entier tout en restant dans un coin ?", "Un timbre");
addRiddle("On ne peut pas me tenir tant qu'on ne m'a pas donné, que suis-je ?", "Une promesse");
addRiddle("Qu'est-ce qui augmente mais ne diminue jamais ?", "L’âge");
addRiddle("Je rase tous les jours mais ma barbe ne change pas, que-suis je ?", "Un barbier");
addRiddle("Qu'est-ce qu'on peut attraper mais jamais lancer ?", "Un rhume");
addRiddle("Qu'est-ce qui devient plus grand à mesure qu'on en retire ?", "Un trou");
addRiddle("A quelle question on ne peut jamais répondre oui ?", "Est-ce que tu dors");
addRiddle("Qu'est-ce qui a quatre doigts et un pouce mais n'est pas vivant ?", "Un gant");
addRiddle("Qu'est-ce qui ne peut pas parler mais répond quand on lui parle ?", "Un écho");
addRiddle("Je vous suis tout le temps et copie vos mouvements, pourtant vous ne pouvez ni me toucher ni m'attraper, qui suis-je ?", "mon ombre");
addRiddle("Plus il y en a, moins on voit, qu'est-ce que c'est ?", "L\'obscurité");
addRiddle("Qu'est-ce qui a plusieurs clés mais n'ouvre aucune serrure ?", "Le solfège");
addRiddle("Les parents de Pierre ont trois enfants, Paul et Bill : quel est le nom du troisième enfant ?", "Pierre");
addRiddle("Si vous m'avez, vous voudrez me partager, mais si vous me partagez je n'existe plus, que suis-je ?", "Un secret");
addRiddle("J'ai un chapeau mais pas de tête, j'ai un pied mais pas de chaussures, que suis-je ?", "Un champignon");

document.addEventListener('DOMContentLoaded', displayRiddle);

let retourLobbyBtn = document.createElement('button');
retourLobbyBtn.textContent = "Retour lobby";
retourLobbyBtn.addEventListener('click', function() {
  window.location.href = "index.html";
});

document.body.appendChild(retourLobbyBtn);