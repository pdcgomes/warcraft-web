import type { WebSocket } from 'ws';
import type {
  ClientMessage, ServerMessage, ServerLobbyUpdateMessage,
} from '@warcraft-web/shared';
import { GameSession } from './GameSession.js';

interface LobbyPlayer {
  id: number;
  name: string;
  ready: boolean;
  ws: WebSocket;
}

/**
 * Game lobby: handles player join/ready/match start.
 * When 2 players are ready, starts a GameSession.
 */
export class Lobby {
  private players: Map<WebSocket, LobbyPlayer> = new Map();
  private nextPlayerId = 1;
  private activeSession: GameSession | null = null;

  addConnection(ws: WebSocket): void {
    // Don't assign player ID until they send 'join'
  }

  removeConnection(ws: WebSocket): void {
    const player = this.players.get(ws);
    if (player) {
      this.players.delete(ws);
      console.log(`Player ${player.name} (${player.id}) left`);

      // If in a game session, notify
      if (this.activeSession) {
        this.activeSession.removePlayer(player.id);
        this.activeSession = null;
      }

      this.broadcastLobbyUpdate();
    }
  }

  handleMessage(ws: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case 'join':
        this.handleJoin(ws, message.playerName);
        break;

      case 'ready':
        this.handleReady(ws);
        break;

      case 'command':
      case 'checksum':
        // Forward to active game session
        if (this.activeSession) {
          const player = this.players.get(ws);
          if (player) {
            this.activeSession.handleMessage(player.id, message);
          }
        }
        break;
    }
  }

  private handleJoin(ws: WebSocket, playerName: string): void {
    if (this.players.has(ws)) return; // Already joined

    const player: LobbyPlayer = {
      id: this.nextPlayerId++,
      name: playerName,
      ready: false,
      ws,
    };

    this.players.set(ws, player);
    console.log(`Player ${player.name} joined as player ${player.id}`);

    // Send welcome
    this.send(ws, {
      type: 'welcome',
      playerId: player.id,
      playerName: player.name,
    });

    this.broadcastLobbyUpdate();
  }

  private handleReady(ws: WebSocket): void {
    const player = this.players.get(ws);
    if (!player) return;

    player.ready = true;
    console.log(`Player ${player.name} is ready`);

    this.broadcastLobbyUpdate();
    this.tryStartGame();
  }

  private tryStartGame(): void {
    const playerList = Array.from(this.players.values());

    // Need exactly 2 players, both ready
    if (playerList.length < 2) return;
    if (!playerList.every(p => p.ready)) return;

    console.log('Starting game!');

    const mapSeed = Date.now();
    const gamePlayers = playerList.slice(0, 2).map((p, i) => ({
      id: p.id,
      name: p.name,
      faction: (i === 0 ? 'humans' : 'orcs') as 'humans' | 'orcs',
      ws: p.ws,
    }));

    // Broadcast game start
    const startMsg: ServerMessage = {
      type: 'game_start',
      mapSeed,
      players: gamePlayers.map(p => ({ id: p.id, name: p.name, faction: p.faction })),
    };
    for (const p of gamePlayers) {
      this.send(p.ws, startMsg);
    }

    // Create game session
    this.activeSession = new GameSession(gamePlayers);
    this.activeSession.start();
  }

  private broadcastLobbyUpdate(): void {
    const update: ServerLobbyUpdateMessage = {
      type: 'lobby_update',
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        ready: p.ready,
      })),
    };

    for (const player of this.players.values()) {
      this.send(player.ws, update);
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
