// JavaScript pour le jeu "juste prix"
let essais = 0;
let historique = document.querySelector('#historique');
let proposition = document.querySelector('#proposition');
let resultat = document.querySelector('#resultat');
let essayer = document.querySelector('#essayer');
let nombreAleatoire = Math.floor(Math.random() * 100) + 1; // Générer le nombre aléatoire au début du jeu

essayer.addEventListener('click', verifierNombre);

function verifierNombre() {
  essais++; // Augmenter le nombre d'essais à chaque tentative
  let nombreSaisi = Number(proposition.value);

  if (nombreSaisi === nombreAleatoire) {
    resultat.textContent = `Bravo! Vous avez deviné le juste prix en ${essais} essai(s)`;
    resultat.style.backgroundColor = 'green';
    historique.textContent = '';
    // Créer un élément image
    let imageGagnant = document.createElement('img');
    imageGagnant.src = 'images/medaille.png';
    imageGagnant.width = 50;
    // Ajouter l'image à votre page
    document.body.insertBefore(imageGagnant, document.body.firstChild);
    // Générer un nouveau nombre aléatoire pour une nouvelle partie
    nombreAleatoire = Math.floor(Math.random() * 100) + 1;
  } else if (nombreSaisi < nombreAleatoire) {
    resultat.textContent = 'Le nombre saisi est trop bas';
    resultat.style.backgroundColor = '#8B0000';
    let message = `\nEssai #${essais} : ${nombreSaisi} (trop bas ▼)\n`;
    historique.innerHTML += message + "<br>";
  } else {
    resultat.textContent = 'Le nombre saisi est trop haut';
    resultat.style.backgroundColor = '#8B0000';
    let message = `\nEssai #${essais} : ${nombreSaisi} (trop haut ▲)\n`;
    historique.innerHTML += message + "<br>";
  }
  proposition.value = '';
  proposition.focus();
}

window.addEventListener('load', function() {
  let retourLobbyBtn = document.createElement('button');
  retourLobbyBtn.textContent = "Retour lobby";
  retourLobbyBtn.addEventListener('click', function() {
    window.location.href = "index.html";
  });

  document.body.appendChild(retourLobbyBtn);
});
