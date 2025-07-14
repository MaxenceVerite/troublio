// Contenu initial du serveur
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const players = {};
const colors = [
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#FFA500', '#800080', '#008000', '#FFC0CB', '#800000', '#000080',
];
let colorIndex = 0;

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // Create a new player and add it to our players object
  players[socket.id] = {
    q: Math.floor(Math.random() * 20) - 10,
    r: Math.floor(Math.random() * 20) - 10,
    playerId: socket.id,
    username: socket.handshake.auth.username,
    color: colors[colorIndex % colors.length],
    troops: 3,
    hp: 3,
    lastMove: 0,
    moveCooldown: 1000,
    xp: 0,
    level: 1,
    nextLevelXp: 100,
  };
  colorIndex++;
  // Send the players object to the new player
  socket.emit('currentPlayers', players);
  // Update all other players of the new player
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('move', (target) => {
    const player = players[socket.id];
    if (!player) return;

    const now = Date.now();
    const cooldown = player.moveCooldown + player.troops * 100;
    if (now - player.lastMove < cooldown) {
      return;
    }

    // Check if the target is a valid move
    const dist = hex_distance(player, target);
    if (dist === 1) {
      const opponent = getPlayerAt(target);
      if (opponent) {
        // For now, let's just move to the opponent's cell
        player.q = target.q;
        player.r = target.r;
        player.lastMove = now;
        io.emit('playerMoved', player);
      } else {
        // Move
        player.q = target.q;
        player.r = target.r;
        player.lastMove = now;
        io.emit('playerMoved', player);
      }
    }
  });

  socket.on('upgrade', (type) => {
    const player = players[socket.id];
    if (!player) return;

    if (type === 'troops') {
      player.troops++;
    } else if (type === 'cooldown') {
      player.moveCooldown *= 0.9;
    }
    io.emit('playerUpdated', player);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    // Remove this player from our players object
    delete players[socket.id];
    // Emit a message to all players to remove this player
    io.emit('playerDisconnected', socket.id);
  });
});

function getPlayerAt(target) {
  return Object.values(players).find(p => p.q === target.q && p.r === target.r);
}

function hex_distance(a, b) {
  return (Math.abs(a.q - b.q)
        + Math.abs(a.q + a.r - b.q - b.r)
        + Math.abs(a.r - b.r)) / 2;
}

function checkLevelUp(player) {
  if (player.xp >= player.nextLevelXp) {
    player.level++;
    player.xp -= player.nextLevelXp;
    player.nextLevelXp = Math.floor(player.nextLevelXp * 1.5);
    io.to(player.playerId).emit('levelUp', player);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});

setInterval(() => {
  Object.values(players).forEach(player => {
    const opponents = getOpponentsInRange(player, 3);
    if (opponents.length > 0) {
      const target = opponents[0]; // For now, just target the first one
      for (let i = 0; i < player.troops; i++) {
        io.emit('projectile', {
          from: player.playerId,
          to: target.playerId,
        });
        target.hp--;
        target.troops = Math.ceil(target.hp);
        if (target.hp <= 0) {
          io.emit('playerDied', target.playerId);
          delete players[target.playerId];
        } else {
          io.emit('playerUpdated', target);
        }
      }
    }
  });
}, 1000);

function getOpponentsInRange(player, range) {
  return Object.values(players).filter(p => {
    return p.playerId !== player.playerId && hex_distance(player, p) <= range;
  });
}
