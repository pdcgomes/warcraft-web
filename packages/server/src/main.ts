import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { Lobby } from './Lobby.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

const app = express();
const httpServer = createServer(app);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// WebSocket server
const wss = new WebSocketServer({ server: httpServer });
const lobby = new Lobby();

wss.on('connection', (ws) => {
  console.log('Client connected');

  lobby.addConnection(ws);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      lobby.handleMessage(ws, message);
    } catch (err) {
      console.error('Invalid message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    lobby.removeConnection(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Warcraft Web server listening on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});
