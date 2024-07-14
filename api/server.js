import { App } from 'uWebSockets.js';
import pkg from 'uuid';

const { v4: uuidv4 } = pkg;

const app = App();
const sessions = {};
const playerConnections = {}; // To keep track of player connections

app.ws('/*', {
  open: (ws) => {
    console.log('New connection');
    ws.subscribe('global');
  },
  message: (ws, message) => {
    const decodedMessage = Buffer.from(message).toString('utf-8');
    const msg = JSON.parse(decodedMessage);

    if (msg.type === 'createSession') {
      const sessionId = uuidv4();
      sessions[sessionId] = { players: [], boards: {}, chance: null }; 
      ws.subscribe(sessionId);
      ws.send(JSON.stringify({ type: 'sessionCreated', data: { sessionId } }));
      console.log(`Session created with ID: ${sessionId}`);
    } else if (msg.type === 'joinSession') {
      const { sessionId } = msg.data;
      if (sessions[sessionId] && sessions[sessionId].players.length < 2) { 
        const playerId = uuidv4(); 
        sessions[sessionId].players.push(playerId); 
        playerConnections[playerId] = ws; 
        ws.subscribe(sessionId);

        console.log(playerConnections)

        const isFirstPlayer = sessions[sessionId].players.length === 1;
        sessions[sessionId].chance = isFirstPlayer ? playerId : sessions[sessionId].chance;

        ws.send(JSON.stringify({ type: 'sessionJoined', data: { sessionId, playerId } }));
        ws.send(JSON.stringify({ type: 'chance', data: { sessionId, playerId, chance: isFirstPlayer } }));
        console.log(`Player ${playerId} joined session ${sessionId} with chance ${isFirstPlayer}`);

        const existingPlayerId = sessions[sessionId].players.find(id => id !== playerId);
        if (existingPlayerId) {
          playerConnections[existingPlayerId].send(JSON.stringify({ type: 'playerJoined', data: { playerId, chance: false } }));
        }
      } else {
        ws.send(JSON.stringify({ type: 'sessionFull' }));
        console.log(`Session ${sessionId} is full or does not exist`);
      }
    } else if (msg.type === 'strike') {
      const { sessionId, row, col, playerId } = msg.data;
      if (sessions[sessionId] && sessions[sessionId].players.includes(playerId)) {
        console.log(`Strike sent from player ${playerId} at (${row}, ${col})`);

        const nextPlayerId = sessions[sessionId].players.find(id => id !== playerId);
        playerConnections[nextPlayerId].send(JSON.stringify({ type: 'strike', data: { row, col, playerId } }));
      } else {
        console.log(`Invalid strike request from player ${playerId} or not their turn`);
        ws.send(JSON.stringify({ type: 'invalidStrike', data: { message: 'Not your turn' } }));
      }
    } else if (msg.type === 'strikeResult') {
      const { sessionId, row, col, playerId, result } = msg.data;
      if (sessions[sessionId]) {
        const opponentId = sessions[sessionId].players.find(id => id !== playerId);
        console.log(`Strike result for player ${playerId} at (${row}, ${col}): ${result}`);

        playerConnections[opponentId].send(JSON.stringify({ type: 'strikeResult', data: { row, col, result, playerId } }));

        if (result === 'miss') {
          playerConnections[opponentId].send(JSON.stringify({ type: 'chance', data: { row, col, result, playerId, chance: false } }));
          playerConnections[playerId].send(JSON.stringify({ type: 'chance', data: { row, col, result, playerId, chance: true } }));
        } 
      } else {
        console.log(`Invalid strike result request from player ${playerId}`);
      }
    }
  },
  close: (ws) => {
    console.log('Connection closed');
  }
});

app.listen(8080, (token) => {
  if (token) {
    console.log('Server is listening on port 8080');
  }
});
