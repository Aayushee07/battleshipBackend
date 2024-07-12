import { App } from 'uWebSockets.js';
import pkg from 'uuid';

const { v4: uuidv4 } = pkg;

const app = App();
const sessions = {};

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
      sessions[sessionId] = { players: [], boards: {}, chance: null }; // Initialize with empty players
      ws.subscribe(sessionId);
      ws.send(JSON.stringify({ type: 'sessionCreated', data: { sessionId } }));
      console.log(`Session created with ID: ${sessionId}`);
    } else if (msg.type === 'joinSession') {
      const { sessionId } = msg.data;
      if (sessions[sessionId] && sessions[sessionId].players.length < 2) { // Limit to 2 players per session
        const playerId = uuidv4(); // Generate unique player ID
        sessions[sessionId].players.push(playerId); // Add player to session
        ws.subscribe(sessionId);

        if (sessions[sessionId].players.length === 1) {
          sessions[sessionId].chance = playerId; // Assign chance to the first player who joins
          ws.send(JSON.stringify({ type: 'sessionJoined', data: { sessionId, playerId, chance: true } }));
          ws.send(JSON.stringify({ type: 'chance', data: { sessionId, playerId, chance: true } }));
          console.log(`Player ${playerId} joined session ${sessionId} with chance true`);
        } else {
          ws.send(JSON.stringify({ type: 'sessionJoined', data: { sessionId, playerId, chance: false } }));
          ws.send(JSON.stringify({ type: 'chance', data: { sessionId, playerId, chance: false } }));
          console.log(`Player ${playerId} joined session ${sessionId} with chance false`);
        }

        const existingPlayerId = sessions[sessionId].players.find(id => id !== playerId);
        if (existingPlayerId) {
          ws.publish(sessionId, JSON.stringify({ type: 'playerJoined', data: { playerId, chance: false } }));
        }
      } else {
        ws.send(JSON.stringify({ type: 'sessionFull' }));
        console.log(`Session ${sessionId} is full or does not exist`);
      }
    } else if (msg.type === 'strike') {
      const { sessionId, row, col, playerId } = msg.data;
      if (sessions[sessionId] && sessions[sessionId].players.includes(playerId) && sessions[sessionId].chance === playerId) {
        console.log(`Strike sent from player ${playerId} at (${row}, ${col})`);

        // Toggle the chance to the other player
        const nextPlayerId = sessions[sessionId].players.find(id => id !== playerId);
        sessions[sessionId].chance = nextPlayerId;
        
        // Notify all players of the strike
        ws.publish(sessionId, JSON.stringify({ type: 'strike', data: { row, col, playerId } }));
        
        // Notify all players of the next turn
        ws.publish(sessionId, JSON.stringify({ type: 'chance', data: { playerId: nextPlayerId, chance: true } }));
      } else {
        console.log(`Invalid strike request from player ${playerId} or not their turn`);
        ws.send(JSON.stringify({ type: 'invalidStrike', data: { message: 'Not your turn' } }));
      }
    } else if (msg.type === 'strikeResult') {
      const { sessionId, row, col, playerId, result } = msg.data;
      if (sessions[sessionId]) {
        console.log(`Strike result for player ${playerId} at (${row}, ${col}): ${result}`);
        ws.publish(sessionId, JSON.stringify({ type: 'strikeResult', data: { row, col, result, playerId } }));
        ws.publish(sessionId, JSON.stringify({ type: 'chance', data: { row, col, result, playerId ,chance:false} }));
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
