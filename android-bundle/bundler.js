// bundler.js

// 1. Import the 'ws' module correctly (works with ESM)
import pkg from 'ws';

// 2. Destructure the 'Server' class from that object
const { Server: WebSocketServer } = pkg;

// 3. Create the WebSocket server
const wss = new WebSocketServer({ port: 8080 });

console.log('✅ WebSocket server running at ws://localhost:8080');

// 4. Handle connections
wss.on('connection', (ws) => {
  console.log('🟢 Client connected');

  ws.on('message', (data) => {
    console.log('📩 Received from client:', data.toString());

    try {
      const parsed = JSON.parse(data);
      // Echo back the same payload to all connected clients (broadcast)
      wss.clients.forEach((client) => {
        if (client.readyState === ws.OPEN) {
          client.send(JSON.stringify(parsed));
        }
      });
    } catch (err) {
      console.error('❌ Error parsing message:', err);
    }
  });

  ws.on('close', () => console.log('🔴 Client disconnected'));
});
