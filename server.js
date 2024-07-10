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
      sessions[sessionId] = { players: [], boards: {} }; 
      ws.send(JSON.stringify({ type: 'sessionCreated', data: { sessionId } }));
      console.log(`Session created with ID: ${sessionId}`);
    } else if (msg.type === 'joinSession') {
      const { sessionId } = msg.data;
      if (sessions[sessionId] && sessions[sessionId].players.length < 2) { 
        const playerId = uuidv4(); 
        sessions[sessionId].players.push(playerId);
        ws.subscribe(sessionId); 
        ws.send(JSON.stringify({ type: 'sessionJoined', data: { sessionId, playerId } }));
        console.log(`Player ${playerId} joined session ${sessionId}`);

        const existingPlayerId = sessions[sessionId].players.find(id => id !== playerId);
        if (existingPlayerId) {
          ws.publish(sessionId, JSON.stringify({ type: 'playerJoined', data: { playerId } }));
        }
      } else {
        ws.send(JSON.stringify({ type: 'sessionFull' }));
        console.log(`Session ${sessionId} is full`);
      }
    } else if (msg.type === 'strike') {
      const { sessionId, row, col, playerId } = msg.data;
      if (sessions[sessionId] && sessions[sessionId].players.includes(playerId)) {
        console.log(`Strike sent from player ${playerId} at (${row}, ${col})`);
        ws.publish(sessionId, JSON.stringify({ type: 'strike', data: { row, col, playerId } }));
      } else {
        console.log(`Invalid strike request from player ${playerId}`);
      }
    } else if (msg.type === 'strikeResult') {
      const { sessionId, row, col, playerId, result } = msg.data;
      if (sessions[sessionId]) {
        console.log(`Strike result for player ${playerId} at (${row}, ${col}): ${result}`);
        ws.publish(sessionId, JSON.stringify({ type: 'strikeResult', data: { row, col, result, playerId } }));
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
