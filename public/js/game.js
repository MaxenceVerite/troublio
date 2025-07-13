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

const HEX_SIZE = 48;
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
  const x = HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
  const y = HEX_SIZE * (3 / 2 * r);
  return { x, y };
}

function drawHex(x, y, fillStyle = null) {
  const size = HEX_SIZE * 0.95; // Add spacing
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = 2 * Math.PI / 6 * (i + 0.5);
    const x_i = x + size * Math.cos(angle);
    const y_i = y + size * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(x_i, y_i);
    } else {
      ctx.lineTo(x_i, y_i);
    }
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle || '#333';
  ctx.fill();
  ctx.strokeStyle = '#555';
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

socket.on('playerDisconnected', (playerId) => {
  delete players[playerId];
  redraw();
});

socket.on('playerMoved', (playerInfo) => {
  const player = players[playerInfo.playerId];
  if (player) {
    player.targetQ = playerInfo.q;
    player.targetR = playerInfo.r;
  } else {
    players[playerInfo.playerId] = playerInfo;
  }
});

socket.on('playerDied', (playerId) => {
  delete players[playerId];
  redraw();
});

function update() {
  const now = Date.now();
  const dt = (now - lastUpdate) / 1000;
  lastUpdate = now;

  Object.values(players).forEach(player => {
    if (player.targetQ !== undefined && player.targetR !== undefined) {
      const targetPos = hexToPixel(player.targetQ, player.targetR);
      const currentPos = hexToPixel(player.q, player.r);

      const dx = targetPos.x - currentPos.x;
      const dy = targetPos.y - currentPos.y;

      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1) {
        player.q = player.targetQ;
        player.r = player.targetR;
        delete player.targetQ;
        delete player.targetR;
      } else {
        const speed = 5;
        player.q += (player.targetQ - player.q) * speed * dt;
        player.r += (player.targetR - player.r) * speed * dt;
      }
    }
  });

  redraw();
  requestAnimationFrame(update);
}

let lastUpdate = Date.now();
requestAnimationFrame(update);

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(1.5, 1.5);


  const me = players[socket.id];
  if (me) {
    const { x, y } = hexToPixel(me.q, me.r);
    ctx.translate(-x, -y);
  }

  drawGrid();
  drawPlayers();
  drawFogOfWar();

  ctx.restore();
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
    drawPlayer(x, y, player.username, player.color);
  });
}

const soldierImg = new Image();
soldierImg.src = 'img/soldier.png';

function drawPlayer(x, y, username, color) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = color;
  ctx.fillRect(x - 16, y - 16, 32, 32);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(soldierImg, x - 16, y - 16, 32, 32);
  ctx.restore();

  ctx.fillStyle = 'white';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(username, x, y - 20);
}

canvas.addEventListener('click', (event) => {
  const me = players[socket.id];
  if (!me) return;

  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left - canvas.width / 2) / 1.5;
  const y = (event.clientY - rect.top - canvas.height / 2) / 1.5;

  const mePos = hexToPixel(me.q, me.r);
  const { q, r } = pixelToHex(x + mePos.x, y + mePos.y);

  socket.emit('move', { q, r });
});

function pixelToHex(x, y) {
  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / HEX_SIZE;
  const r = (2 / 3 * y) / HEX_SIZE;
  return hex_round({ q, r });
}

function hex_round(h) {
  const q = Math.round(h.q);
  const r = Math.round(h.r);
  const s = Math.round(-h.q - h.r);

  const q_diff = Math.abs(q - h.q);
  const r_diff = Math.abs(r - h.r);
  const s_diff = Math.abs(s - (-h.q - h.r));

  if (q_diff > r_diff && q_diff > s_diff) {
    return { q: -r - s, r };
  } else if (r_diff > s_diff) {
    return { q, r: -q - s };
  } else {
    return { q, r };
  }
}

// redraw();
