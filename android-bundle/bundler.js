// server.js
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

console.log('Server started on ws://localhost:8080');
console.log('Waiting ');

wss.on('connection', (ws) => {
  console.log(`Count : ${wss.clients.size}`);

  ws.on('message', (message) => {
    console.log('📩 Message received');

    // Broadcast the message to all other connected clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1 /* WebSocket.OPEN */) {
        client.send(message.toString());
      }
    });
  });

  ws.on('close', () => {
    console.log(`Count : ${wss.clients.size}`);
  });

  ws.on('error', (error) => {
    console.error();
  });
});