// Contenu initial du serveur
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const players = {};

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // Create a new player and add it to our players object
  players[socket.id] = {
    q: Math.floor(Math.random() * 20) - 10,
    r: Math.floor(Math.random() * 20) - 10,
    playerId: socket.id,
    username: socket.handshake.auth.username,
  };
  // Send the players object to the new player
  socket.emit('currentPlayers', players);
  // Update all other players of the new player
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('move', (target) => {
    const player = players[socket.id];
    if (!player) return;

    // Check if the target is a valid move
    const dist = hex_distance(player, target);
    if (dist === 1 && !isOccupied(target)) {
      player.q = target.q;
      player.r = target.r;
      io.emit('playerMoved', player);
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    // Remove this player from our players object
    delete players[socket.id];
    // Emit a message to all players to remove this player
    io.emit('disconnect', socket.id);
  });
});

function isOccupied(target) {
  return Object.values(players).some(p => p.q === target.q && p.r === target.r);
}

function hex_distance(a, b) {
  return (Math.abs(a.q - b.q)
        + Math.abs(a.q + a.r - b.q - b.r)
        + Math.abs(a.r - b.r)) / 2;
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
