const socket = io({ autoConnect: false });

const loginDiv = document.getElementById('login');
const usernameInput = document.getElementById('username');
const playButton = document.getElementById('playButton');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const xpFill = document.getElementById('xpFill');
const level = document.getElementById('level');
const cooldownFill = document.getElementById('cooldownFill');
const upgradeModal = document.getElementById('upgradeModal');
const upgradeTroopsBtn = document.getElementById('upgradeTroops');
const upgradeCooldownBtn = document.getElementById('upgradeCooldown');

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

const grid = [];
const MAP_RADIUS = 10;
for (let q = -MAP_RADIUS; q <= MAP_RADIUS; q++) {
  const r1 = Math.max(-MAP_RADIUS, -q - MAP_RADIUS);
  const r2 = Math.min(MAP_RADIUS, -q + MAP_RADIUS);
  for (let r = r1; r <= r2; r++) {
    grid.push({ q, r, ...hexToPixel(q, r) });
  }
}

function drawGrid() {
  grid.forEach(hex => {
    drawHex(hex.x, hex.y);
  });
}

function drawReachable() {
  const me = players[socket.id];
  if (!me) return;

  const now = Date.now();
  const cooldown = me.moveCooldown + me.troops * 100;
  if (now - me.lastMove < cooldown) {
    return;
  }

  const neighbors = [
    { q: me.q + 1, r: me.r }, { q: me.q - 1, r: me.r },
    { q: me.q, r: me.r + 1 }, { q: me.q, r: me.r - 1 },
    { q: me.q + 1, r: me.r - 1 }, { q: me.q - 1, r: me.r + 1 },
  ];

  neighbors.forEach(n => {
    const { x, y } = hexToPixel(n.q, n.r);
    drawHex(x, y, 'rgba(255, 255, 255, 0.2)');
  });
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

  const grad = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
  grad.addColorStop(0, '#444');
  grad.addColorStop(1, '#222');

  ctx.fillStyle = fillStyle || grad;
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.stroke();
}

let players = {};
const projectiles = [];

socket.on('projectile', ({ from, to }) => {
  const fromPlayer = players[from];
  const toPlayer = players[to];
  if (fromPlayer && toPlayer) {
    projectiles.push(new Projectile(fromPlayer, toPlayer));
  }
});

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

socket.on('levelUp', (player) => {
  players[player.playerId] = player;
  upgradeModal.style.display = 'block';
});

socket.on('playerUpdated', (player) => {
  players[player.playerId] = player;
  redraw();
});

upgradeTroopsBtn.addEventListener('click', () => {
  socket.emit('upgrade', 'troops');
  upgradeModal.style.display = 'none';
});

upgradeCooldownBtn.addEventListener('click', () => {
  socket.emit('upgrade', 'cooldown');
  upgradeModal.style.display = 'none';
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
  const player = players[playerId];
  if (player) {
    player.isDying = true;
    player.deathAnimTimer = 1;
  }
});

function update() {
  const now = Date.now();
  const dt = (now - lastUpdate) / 1000;
  lastUpdate = now;

  projectiles.forEach((p, i) => {
    p.update(dt);
    if (p.isFinished()) {
      projectiles.splice(i, 1);
    }
  });

  Object.keys(players).forEach(id => {
    const player = players[id];
    if (player.isDying) {
      player.deathAnimTimer -= dt;
      if (player.deathAnimTimer <= 0) {
        delete players[id];
      }
    } else if (player.targetQ !== undefined && player.targetR !== undefined) {
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
    updateUI(me);
  }

  drawGrid();
  drawReachable();
  drawPlayers();
  drawProjectiles();
  drawFogOfWar();

  ctx.restore();
}

function updateUI(player) {
  const xpPercent = (player.xp / player.nextLevelXp) * 100;
  xpFill.style.width = `${xpPercent}%`;
  level.textContent = `Level ${player.level}`;

  const now = Date.now();
  const cooldown = player.moveCooldown + player.troops * 100;
  const cooldownPercent = Math.min(((now - player.lastMove) / cooldown) * 100, 100);
  cooldownFill.style.width = `${cooldownPercent}%`;
}

function drawProjectiles() {
  projectiles.forEach(p => p.draw(ctx));
}

function drawFogOfWar() {
  const me = players[socket.id];
  if (!me) return;

  const visionRadius = 5; // in hexes

  grid.forEach(hex => {
    const dist = hex_distance(me, hex);
    if (dist > visionRadius) {
      drawHex(hex.x, hex.y, 'rgba(0, 0, 0, 0.5)');
    }
  });
}

function hex_distance(a, b) {
  return (Math.abs(a.q - b.q)
        + Math.abs(a.q + a.r - b.q - b.r)
        + Math.abs(a.r - b.r)) / 2;
}

function drawPlayers() {
  const me = players[socket.id];
  if (!me) return;

  const visionRadius = 5;

  Object.values(players).forEach(player => {
    if (player.playerId === me.playerId || hex_distance(me, player) <= visionRadius) {
      drawPlayer(player);
    }
  });
}

const soldierImg = new Image();
soldierImg.src = 'img/soldier.png';

function drawPlayer(player) {
  const { x, y } = hexToPixel(player.q, player.r);

  ctx.save();
  if (player.isDying) {
    ctx.globalAlpha = player.deathAnimTimer;
  }
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = player.color;
  ctx.fillRect(x - 16, y - 16, 32, 32);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(soldierImg, x - 16, y - 16, 32, 32);
  ctx.restore();

  ctx.fillStyle = 'white';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(player.username, x, y - 20);

  drawHealthBar(x, y - 30, player.hp);
}

function drawHealthBar(x, y, hp) {
  const barWidth = 40;
  const barHeight = 5;
  const hpPerBar = 5;
  const numBars = Math.ceil(hp / hpPerBar);

  for (let i = 0; i < numBars; i++) {
    const barX = x - barWidth / 2 + (i % 10) * (barWidth / 10);
    const barY = y - Math.floor(i / 10) * (barHeight + 2);

    let color = '#00ff00'; // Green
    if (i >= 10) {
      color = '#0000ff'; // Blue
    }

    const hpInBar = Math.min(hp - i * hpPerBar, hpPerBar);
    const width = (hpInBar / hpPerBar) * (barWidth / 10);

    ctx.fillStyle = '#555';
    ctx.fillRect(barX, barY, barWidth / 10, barHeight);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, width, barHeight);
  }
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
