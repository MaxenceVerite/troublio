const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

socket.on('connect', () => {
  console.log('connected to server');
});

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

function drawGrid() {
  for (let x = 0; x < 20; x++) {
    for (let y = 0; y < 20; y++) {
      const screenX = (x - y) * TILE_WIDTH / 2 + canvas.width / 2;
      const screenY = (x + y) * TILE_HEIGHT / 2;
      drawTile(screenX, screenY);
    }
  }
}

function drawTile(x, y) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + TILE_WIDTH / 2, y + TILE_HEIGHT / 2);
  ctx.lineTo(x, y + TILE_HEIGHT);
  ctx.lineTo(x - TILE_WIDTH / 2, y + TILE_HEIGHT / 2);
  ctx.closePath();
  ctx.stroke();
}

let players = {};

socket.on('currentPlayers', (serverPlayers) => {
  players = serverPlayers;
  redraw();
});

socket.on('newPlayer', (playerInfo) => {
  players[playerInfo.playerId] = playerInfo;
  redraw();
});

socket.on('disconnect', (playerId) => {
  delete players[playerId];
  redraw();
});

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawPlayers();
}

function drawPlayers() {
  Object.values(players).forEach(player => {
    const screenX = (player.x - player.y) * TILE_WIDTH / 2 + canvas.width / 2;
    const screenY = (player.x + player.y) * TILE_HEIGHT / 2;
    drawPlayer(screenX, screenY);
  });
}

function drawPlayer(x, y) {
  ctx.fillStyle = 'blue';
  ctx.beginPath();
  ctx.arc(x, y + TILE_HEIGHT / 2, 10, 0, 2 * Math.PI);
  ctx.fill();
}

redraw();
