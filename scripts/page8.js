const targetWord = "apple";

const wordContainer = document.getElementById('wordContainer');
const guessButton = document.getElementById('guessButton');
const resultDisplay = document.getElementById('resultDisplay');

// Create letter boxes for the target word
targetWord.split('').forEach(() => {
  const letterBox = document.createElement('div');
  letterBox.className = 'letter';
  letterBox.addEventListener('click', handleLetterClick);
  wordContainer.appendChild(letterBox);
});

let selectedLetterIndex = 0;

function handleLetterClick(event) {
  const clickedLetterIndex = Array.from(wordContainer.children).indexOf(event.target);
  if (clickedLetterIndex === selectedLetterIndex && selectedLetterIndex < targetWord.length) {
    event.target.textContent = targetWord[selectedLetterIndex];
    event.target.classList.add('selected');
    selectedLetterIndex++;
  }
}

guessButton.addEventListener('click', function() {
  let guess = '';
  wordContainer.querySelectorAll('.letter').forEach(letterBox => {
    guess += letterBox.textContent;
  });
  if (guess.length === targetWord.length) {
    displayResult(guess);
  } else {
    displayError("Please fill in all the letters.");
  }
});

function displayResult(guess) {
  let result = '';
  for (let i = 0; i < targetWord.length; i++) {
    if (guess[i] === targetWord[i]) {
      wordContainer.children[i].classList.add('green');
    } else if (targetWord.includes(guess[i])) {
      wordContainer.children[i].classList.add('orange');
    }
  }
  if (guess === targetWord) {
    resultDisplay.innerHTML = "<div class='success'>Congratulations! You've guessed the word!</div>";
  }
}

function displayError(message) {
  resultDisplay.innerHTML = "<div class='error'>" + message + "</div>";
  setTimeout(() => {
    resultDisplay.innerHTML = '';
  }, 4000);
}
