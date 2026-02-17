import type { EntityId, UnitKind, BuildingKind } from '../index.js';

/**
 * Shared message types for client-server communication.
 * Lockstep protocol: clients send commands, server broadcasts
 * the combined command set for each tick.
 */

// --- Client -> Server ---

export type ClientMessage =
  | ClientJoinMessage
  | ClientReadyMessage
  | ClientCommandMessage
  | ClientChecksumMessage;

export interface ClientJoinMessage {
  type: 'join';
  playerName: string;
}

export interface ClientReadyMessage {
  type: 'ready';
}

export interface ClientCommandMessage {
  type: 'command';
  tick: number;
  commands: GameCommand[];
}

export interface ClientChecksumMessage {
  type: 'checksum';
  tick: number;
  checksum: number;
}

// --- Server -> Client ---

export type ServerMessage =
  | ServerWelcomeMessage
  | ServerLobbyUpdateMessage
  | ServerGameStartMessage
  | ServerTickMessage
  | ServerDesyncMessage;

export interface ServerWelcomeMessage {
  type: 'welcome';
  playerId: number;
  playerName: string;
}

export interface ServerLobbyUpdateMessage {
  type: 'lobby_update';
  players: { id: number; name: string; ready: boolean }[];
}

export interface ServerGameStartMessage {
  type: 'game_start';
  mapSeed: number;
  players: { id: number; name: string; faction: 'humans' | 'orcs' }[];
}

export interface ServerTickMessage {
  type: 'tick';
  tick: number;
  commands: { playerId: number; commands: GameCommand[] }[];
}

export interface ServerDesyncMessage {
  type: 'desync';
  tick: number;
  expectedChecksum: number;
}

// --- Game Commands (shared between client/server) ---

export type GameCommand =
  | { action: 'move'; entities: EntityId[]; targetX: number; targetY: number }
  | { action: 'attack'; entities: EntityId[]; targetEntity: EntityId }
  | { action: 'gather'; entities: EntityId[]; targetEntity: EntityId }
  | { action: 'build'; entity: EntityId; buildingKind: BuildingKind; x: number; y: number }
  | { action: 'train'; buildingEntity: EntityId; unitKind: UnitKind }
  | { action: 'stop'; entities: EntityId[] };
