import type { WebSocket } from 'ws';
import type {
  ClientMessage, ClientCommandMessage, ClientChecksumMessage,
  ServerMessage, ServerTickMessage, ProtocolGameCommand,
} from '@warcraft-web/shared';

interface SessionPlayer {
  id: number;
  name: string;
  faction: 'humans' | 'orcs';
  ws: WebSocket;
}

const TICK_RATE_MS = 100; // 10 ticks per second

/**
 * Manages a multiplayer game session using lockstep synchronization.
 *
 * Protocol:
 * 1. Each tick, the server waits for commands from all players.
 * 2. Server broadcasts the combined command set.
 * 3. All clients simulate deterministically using the same commands.
 * 4. Clients periodically send checksums for desync detection.
 */
export class GameSession {
  private players: SessionPlayer[];
  private currentTick = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  /** Commands received for the current tick, keyed by playerId. */
  private pendingCommands: Map<number, ProtocolGameCommand[]> = new Map();

  /** Checksums received from clients, keyed by tick number -> playerId -> checksum. */
  private checksums: Map<number, Map<number, number>> = new Map();

  constructor(players: SessionPlayer[]) {
    this.players = players;
  }

  start(): void {
    console.log(`GameSession started with ${this.players.length} players`);

    // Initialize empty commands for all players
    for (const player of this.players) {
      this.pendingCommands.set(player.id, []);
    }

    // Start the tick loop
    this.tickTimer = setInterval(() => {
      this.processTick();
    }, TICK_RATE_MS);
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    console.log('GameSession stopped');
  }

  removePlayer(playerId: number): void {
    this.players = this.players.filter(p => p.id !== playerId);
    this.pendingCommands.delete(playerId);

    if (this.players.length === 0) {
      this.stop();
    }
  }

  handleMessage(playerId: number, message: ClientMessage): void {
    switch (message.type) {
      case 'command':
        this.handleCommand(playerId, message as ClientCommandMessage);
        break;

      case 'checksum':
        this.handleChecksum(playerId, message as ClientChecksumMessage);
        break;
    }
  }

  private handleCommand(playerId: number, message: ClientCommandMessage): void {
    const existing = this.pendingCommands.get(playerId) || [];
    existing.push(...message.commands);
    this.pendingCommands.set(playerId, existing);
  }

  private handleChecksum(playerId: number, message: ClientChecksumMessage): void {
    let tickChecksums = this.checksums.get(message.tick);
    if (!tickChecksums) {
      tickChecksums = new Map();
      this.checksums.set(message.tick, tickChecksums);
    }
    tickChecksums.set(playerId, message.checksum);

    // Check for desync if we have checksums from all players
    if (tickChecksums.size >= this.players.length) {
      this.checkDesync(message.tick, tickChecksums);
    }
  }

  private processTick(): void {
    this.currentTick++;

    // Collect all commands and broadcast
    const tickMsg: ServerTickMessage = {
      type: 'tick',
      tick: this.currentTick,
      commands: [],
    };

    for (const player of this.players) {
      const commands = this.pendingCommands.get(player.id) || [];
      tickMsg.commands.push({
        playerId: player.id,
        commands,
      });
    }

    this.broadcast(tickMsg);

    // Clear pending commands
    for (const player of this.players) {
      this.pendingCommands.set(player.id, []);
    }

    // Clean up old checksums (keep last 20 ticks)
    if (this.currentTick > 20) {
      this.checksums.delete(this.currentTick - 20);
    }
  }

  private checkDesync(tick: number, checksums: Map<number, number>): void {
    const values = Array.from(checksums.values());
    const allSame = values.every(v => v === values[0]);

    if (!allSame) {
      console.error(`DESYNC detected at tick ${tick}!`);
      console.error('Checksums:', Object.fromEntries(checksums));

      // Notify all players
      const desyncMsg: ServerMessage = {
        type: 'desync',
        tick,
        expectedChecksum: values[0],
      };
      this.broadcast(desyncMsg);
    }
  }

  private broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const player of this.players) {
      if (player.ws.readyState === player.ws.OPEN) {
        player.ws.send(data);
      }
    }
  }
}
