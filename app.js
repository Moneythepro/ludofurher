// Ludo PWA simple pass-and-play
const startScreen = document.getElementById('screen-start');
const gameScreen = document.getElementById('screen-game');
const btnStart = document.getElementById('btnStart');
const playersSelect = document.getElementById('players');
const targetSelect = document.getElementById('target');
const boardEl = document.getElementById('board');
const btnRoll = document.getElementById('btnRoll');
const rollValueEl = document.getElementById('rollValue');
const turnInfo = document.getElementById('turnInfo');
const winnerModal = document.getElementById('winnerModal');
const winnerTitle = document.getElementById('winnerTitle');
const winnerText = document.getElementById('winnerText');
const btnAgain = document.getElementById('btnAgain');
const btnHome = document.getElementById('btnHome');

let players = [];
let currentPlayer = 0;
let rollValue = null;
let targetTokens = 1;

// Colors fixed for 4-player
const COLORS = ['#ef4444', '#22c55e', '#facc15', '#3b82f6'];

btnStart.addEventListener('click', startGame);
btnRoll.addEventListener('click', rollDice);
btnAgain.addEventListener('click', () => {
  winnerModal.close();
  startGame();
});
btnHome.addEventListener('click', () => {
  winnerModal.close();
  showScreen(startScreen);
});

function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

function startGame() {
  const numPlayers = parseInt(playersSelect.value);
  targetTokens = parseInt(targetSelect.value);
  players = Array.from({ length: numPlayers }, (_, i) => ({
    id: i,
    name: document.getElementById(`p${i}name`)?.value || ['Red','Green','Yellow','Blue'][i],
    color: COLORS[i],
    tokensHome: 0
  }));
  currentPlayer = 0;
  drawBoard();
  showScreen(gameScreen);
  updateHUD();
}

function drawBoard() {
  boardEl.innerHTML = '';
  // Simple placeholder board
  const size = 600;
  const cell = size / 15;
  const svgNS = 'http://www.w3.org/2000/svg';
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', c * cell);
      rect.setAttribute('y', r * cell);
      rect.setAttribute('width', cell);
      rect.setAttribute('height', cell);
      rect.setAttribute('fill', (r + c) % 2 === 0 ? '#1e293b' : '#0f172a');
      rect.setAttribute('stroke', '#111');
      boardEl.appendChild(rect);
    }
  }
}

function updateHUD() {
  turnInfo.textContent = `${players[currentPlayer].name}'s turn`;
  rollValueEl.textContent = rollValue !== null ? rollValue : '—';
}

function rollDice() {
  rollValue = Math.floor(Math.random() * 6) + 1;
  updateHUD();
  // For simplicity, random token movement
  if (Math.random() < 0.3) { // simulate reaching home
    players[currentPlayer].tokensHome++;
    if (players[currentPlayer].tokensHome >= targetTokens) {
      showWinner(players[currentPlayer]);
      return;
    }
  }
  // Next turn
  currentPlayer = (currentPlayer + 1) % players.length;
  updateHUD();
}

function showWinner(player) {
  winnerTitle.textContent = 'Winner!';
  winnerText.textContent = `${player.name} wins the game 🎉`;
  winnerModal.showModal();
}
