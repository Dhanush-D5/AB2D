// bundler.js

// ✅ Import the Server class directly (ESM-compatible import)
import { WebSocketServer } from 'ws';

// ✅ Create the server
const wss = new WebSocketServer({ port: 8080 });

console.log('✅ WebSocket server running at ws://localhost:8080');

// ✅ Handle connections
wss.on('connection', (ws) => {
  console.log('🟢 Client connected');

  ws.on('message', (data) => {
    console.log('📩 Received:', data.toString());

    try {
      const parsed = JSON.parse(data);
      // Echo the same payload back to all clients (broadcast)
      wss.clients.forEach((client) => {
        if (client.readyState === ws.OPEN) {
          client.send(JSON.stringify(parsed));
        }
      });
    } catch {
      console.error('Invalid JSON from client');
    }
  });

  ws.on('close', () => console.log('🔴 Client disconnected'));
});