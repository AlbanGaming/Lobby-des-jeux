document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('board');
  const restartBtn = document.getElementById('restartBtn');
  let currentPlayer = 'X';
  let cells = Array.from({ length: 9 });
  let isUserTurn = true;

  // Create cells
  for (let i = 0; i < cells.length; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    cell.dataset.index = i;
    cell.addEventListener('click', handleCellClick);
    board.appendChild(cell);
    cells[i] = cell;
  }

  // Handle cell click
  function handleCellClick(e) {
    if (isUserTurn) {
      const cell = e.target;
      if (!cell.textContent) {
        cell.textContent = currentPlayer;

        // Utilisation de setTimeout pour vérifier le gagnant après un court délai
        setTimeout(() => {
          if (checkWinner()) {
            alert(`Le joueur ${currentPlayer} a gagné !`);
            restartGame();
          } else if (checkDraw()) {
            alert('Match nul !');
            restartGame();
          } else {
            isUserTurn = false;
            setTimeout(makeAIMove, 500);
          }
        }, 100); // Ajout d'un délai de 100 millisecondes
      }
    }
  }



  // Make AI move
  // Make AI move
  function makeAIMove() {
    let bestScore = -Infinity;
    let bestMove;

    // Itérer sur chaque cellule vide
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i].textContent) {
        // Essayer ce coup pour l'IA
        cells[i].textContent = 'O';
        let score = minimax(cells, 0, false);
        cells[i].textContent = ''; // Annuler le coup

        // Mettre à jour le meilleur coup
        if (score > bestScore) {
          bestScore = score;
          bestMove = i;
        }
      }
    }

    // Jouer le meilleur coup
    cells[bestMove].textContent = 'O';

    // Vérifier s'il y a un gagnant ou un match nul
    if (checkWinner()) {
      alert(`L'ordinateur a gagné !`);
      restartGame();
    } else if (checkDraw()) {
      alert('Match nul !');
      restartGame();
    } else {
      isUserTurn = true;
    }
  }

  // Fonction d'évaluation pour l'algorithme Minimax
  function minimax(cells, depth, isMaximizing) {
    if (checkWinner()) {
      return isMaximizing ? -10 + depth : 10 - depth; // Pénaliser les coups qui prennent plus de temps à gagner ou récompenser les coups qui gagnent rapidement
    } else if (checkDraw()) {
      return 0;
    }

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < cells.length; i++) {
        if (!cells[i].textContent) {
          cells[i].textContent = 'O';
          let score = minimax(cells, depth + 1, false);
          cells[i].textContent = ''; // Annuler le coup
          bestScore = Math.max(score, bestScore);
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < cells.length; i++) {
        if (!cells[i].textContent) {
          cells[i].textContent = 'X';
          let score = minimax(cells, depth + 1, true);
          cells[i].textContent = ''; // Annuler le coup
          bestScore = Math.min(score, bestScore);
        }
      }
      return bestScore;
    }
  }


  // Check for a winner
  function checkWinner() {
    const winningCombos = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6]
    ];
    return winningCombos.some(combo => {
      const values = combo.map(index => cells[index].textContent);
      return values.every(value => value === 'X') || values.every(value => value === 'O');
    });
  }


  // Check for a draw
  function checkDraw() {
    return cells.every(cell => cell.textContent);
  }

  // Restart the game
  function restartGame() {
    cells.forEach(cell => {
      cell.textContent = '';
    });
    currentPlayer = 'X';
    isUserTurn = true;
  }

  // Restart button click event
  restartBtn.addEventListener('click', restartGame);
});

let retourLobbyBtn = document.createElement('button');
retourLobbyBtn.textContent = "Retour lobby";
retourLobbyBtn.addEventListener('click', function() {
  window.location.href = "index.html";
});

document.body.appendChild(retourLobbyBtn);