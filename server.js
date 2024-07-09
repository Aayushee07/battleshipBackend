import { App } from 'uWebSockets.js';

const app = App();

app.ws('/*', {
  open: (ws, req) => {
    // Handle new WebSocket connection
    console.log('New connection:', ws);

    // Example: Send a message to the client
    ws.send('Welcome to the battleship game!');
  },
  message: (ws, message, isBinary) => {
    // Handle incoming messages from clients
    console.log('Received message:', message.toString());

    // Example: Send a reply message back to the client
    ws.send('Message received!');
  },
  close: (ws, code, message) => {
    // Handle WebSocket connection close
    console.log('Connection closed:', code, message);
  }
});

app.listen(8080, (token) => {
  if (token) {
    console.log('Server is listening on port 8080');
  }
});
