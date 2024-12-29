import {WebSocketServer} from 'ws';

const wss = new WebSocketServer({ port: 8000});

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('message', (message) => {
    // console.log('Received:', message);
    console.log('Buffer Length: ', message.length);
  });
  ws.send('Hello from server');
});

console.log('WebSocket server running on ws://localhost:8000');
