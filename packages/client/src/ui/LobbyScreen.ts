import type { ServerMessage, ServerLobbyUpdateMessage, ServerGameStartMessage } from '@warcraft-web/shared';

/**
 * Lobby UI: shows players, handles ready-up, and starts the game on game_start.
 */
export class LobbyScreen {
  private readonly el: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly playersEl: HTMLElement;

  private ws: WebSocket | null = null;
  private playerId: number = 0;

  onGameStart: ((msg: ServerGameStartMessage, playerId: number, ws: WebSocket) => void) | null = null;
  onBack: (() => void) | null = null;

  constructor() {
    this.el = document.getElementById('lobby-screen')!;
    this.statusEl = document.getElementById('lobby-status')!;
    this.playersEl = document.getElementById('lobby-players')!;

    document.getElementById('btn-ready')!.addEventListener('click', () => {
      this.sendReady();
    });

    document.getElementById('btn-lobby-back')!.addEventListener('click', () => {
      this.disconnect();
      this.onBack?.();
    });
  }

  show(): void {
    this.el.style.display = 'flex';
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  connect(url: string): void {
    this.statusEl.textContent = 'Connecting...';
    this.playersEl.innerHTML = '';

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.statusEl.textContent = 'Failed to connect.';
      return;
    }

    this.ws.addEventListener('open', () => {
      this.statusEl.textContent = 'Connected. Waiting for players...';
      const name = 'Player' + Math.floor(Math.random() * 1000);
      this.ws!.send(JSON.stringify({ type: 'join', playerName: name }));
    });

    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data) as ServerMessage;
      this.handleMessage(msg);
    });

    this.ws.addEventListener('close', () => {
      this.statusEl.textContent = 'Disconnected.';
    });

    this.ws.addEventListener('error', () => {
      this.statusEl.textContent = 'Connection error.';
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome':
        this.playerId = msg.playerId;
        this.statusEl.textContent = `Joined as ${msg.playerName} (Player ${msg.playerId})`;
        break;

      case 'lobby_update':
        this.renderPlayers(msg);
        break;

      case 'game_start':
        this.hide();
        this.onGameStart?.(msg, this.playerId, this.ws!);
        break;
    }
  }

  private renderPlayers(msg: ServerLobbyUpdateMessage): void {
    this.playersEl.innerHTML = msg.players
      .map(p => {
        const readyIcon = p.ready ? '<span style="color:#4a4">&#10003;</span>' : '<span style="color:#888">&#8230;</span>';
        return `<div style="padding:4px 0;">${readyIcon} ${p.name} (Player ${p.id})</div>`;
      })
      .join('');
  }

  private sendReady(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ready' }));
    }
  }
}
