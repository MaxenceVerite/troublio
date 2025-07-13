const socket = io({ autoConnect: false });

const loginDiv = document.getElementById('login');
const usernameInput = document.getElementById('username');
const playButton = document.getElementById('playButton');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

playButton.addEventListener('click', () => {
  const username = usernameInput.value;
  if (username) {
    loginDiv.style.display = 'none';
    canvas.style.display = 'block';
    socket.auth = { username };
    socket.connect();
  }
});

socket.on('connect', () => {
  console.log('connected to server');
});

const HEX_SIZE = 32;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const HEX_HEIGHT = 2 * HEX_SIZE;

function drawGrid() {
  for (let q = -10; q < 10; q++) {
    for (let r = -10; r < 10; r++) {
      const { x, y } = hexToPixel(q, r);
      drawHex(x, y);
    }
  }
}

function hexToPixel(q, r) {
  const x = HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r) + canvas.width / 2;
  const y = HEX_SIZE * (3 / 2 * r) + canvas.height / 2;
  return { x, y };
}

function drawHex(x, y, fillStyle = null) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = 2 * Math.PI / 6 * (i + 0.5);
    const x_i = x + HEX_SIZE * Math.cos(angle);
    const y_i = y + HEX_SIZE * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(x_i, y_i);
    } else {
      ctx.lineTo(x_i, y_i);
    }
  }
  ctx.closePath();
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  } else {
    ctx.stroke();
  }
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

  const me = players[socket.id];
  if (me) {
    ctx.save();
    const { x, y } = hexToPixel(me.q, me.r);
    ctx.translate(canvas.width / 2 - x, canvas.height / 2 - y);
    drawGrid();
    drawPlayers();
    drawFogOfWar();
    ctx.restore();
  } else {
    drawGrid();
    drawPlayers();
  }
}

function drawFogOfWar() {
  const me = players[socket.id];
  if (!me) return;

  const visionRadius = 5; // in hexes

  for (let q = -15; q < 15; q++) {
    for (let r = -15; r < 15; r++) {
      const dist = hex_distance(me, { q, r });
      if (dist > visionRadius) {
        const { x, y } = hexToPixel(q, r);
        drawHex(x, y, 'rgba(0, 0, 0, 0.5)');
      }
    }
  }
}

function hex_distance(a, b) {
  return (Math.abs(a.q - b.q)
        + Math.abs(a.q + a.r - b.q - b.r)
        + Math.abs(a.r - b.r)) / 2;
}

function drawPlayers() {
  Object.values(players).forEach(player => {
    const { x, y } = hexToPixel(player.q, player.r);
    drawPlayer(x, y, player.username);
  });
}

function drawPlayer(x, y, username) {
  ctx.fillStyle = 'blue';
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(username, x, y - 15);
}

redraw();
