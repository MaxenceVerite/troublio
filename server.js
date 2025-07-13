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

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    // Remove this player from our players object
    delete players[socket.id];
    // Emit a message to all players to remove this player
    io.emit('disconnect', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
