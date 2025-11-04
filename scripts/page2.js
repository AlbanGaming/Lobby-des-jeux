document.addEventListener('DOMContentLoaded', function() {
    const timerElement = document.getElementById('timer');
    const guessForm = document.getElementById('guessForm');
    const resultElement = document.getElementById('result');

    let targetSeconds;

    function startTimer() {
        targetSeconds = Math.floor(Math.random() * 86400); // Random number of seconds within a day
        timerElement.textContent = `Nombre de secondes : ${targetSeconds}`;
    }

    function checkGuess(hours, minutes, seconds) {
        if (hours > 23 || minutes > 59 || seconds > 59) {
            resultElement.textContent = "Veuillez entrer des valeurs valides (23 heures maximum, 59 minutes maximum, 59 secondes maximum).";
            return;
        }

        const guessedSeconds = (hours * 3600) + (minutes * 60) + seconds;
        if (guessedSeconds < targetSeconds) {
            resultElement.textContent = "Trop bas, essayez encore.";
        } else if (guessedSeconds > targetSeconds) {
            resultElement.textContent = "Trop haut, essayez encore.";
        } else {
            resultElement.textContent = "Bravo, vous avez deviné le nombre de secondes correctement!";
            startTimer();
        }
    }

    startTimer();

    guessForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const hours = parseInt(document.getElementById('hours').value) || 0;
        const minutes = parseInt(document.getElementById('minutes').value) || 0;
        const seconds = parseInt(document.getElementById('seconds').value) || 0;
        checkGuess(hours, minutes, seconds);
    });

    // Limiter les entrées à 24 heures maximum, 59 minutes maximum, 59 secondes maximum
    const inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            if (parseInt(this.value) > parseInt(this.max)) {
                this.value = this.max;
            }
        });
    });
});

let retourLobbyBtn = document.createElement('button');
retourLobbyBtn.textContent = "Retour lobby";
retourLobbyBtn.addEventListener('click', function() {
  window.location.href = "index.html";
});

document.body.appendChild(retourLobbyBtn);
