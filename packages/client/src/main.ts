import { Application } from 'pixi.js';
import { Movement, UnitType, UNIT_DATA, BUILDING_DATA } from '@warcraft-web/shared';
import { GameRenderer } from './renderer/GameRenderer.js';
import { InputManager } from './input/InputManager.js';
import { HUD } from './ui/HUD.js';
import { EventLogPanel } from './ui/EventLogPanel.js';
import { MainMenu } from './ui/MainMenu.js';
import { LobbyScreen } from './ui/LobbyScreen.js';
import { LocalGame } from './game/LocalGame.js';
import { NetworkGame } from './game/NetworkGame.js';
import { debugState } from './debug/DebugState.js';
import { DebugPanel } from './debug/DebugPanel.js';
import { DebugRenderer } from './debug/DebugRenderer.js';
import { AssetLoader } from './assets/AssetLoader.js';

const SERVER_URL = `ws://${location.hostname}:8080`;

async function main() {
  const container = document.getElementById('game-container')!;
  const isRestart = sessionStorage.getItem('restart') === '1';
  if (isRestart) sessionStorage.removeItem('restart');

  const app = new Application();
  await app.init({
    background: 0x111122,
    resizeTo: container,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  container.insertBefore(app.canvas, container.firstChild);

  // Loading screen
  const loadingScreen = document.getElementById('loading-screen')!;
  const loadingBarFill = document.getElementById('loading-bar-fill')!;
  const loadingText = document.getElementById('loading-text')!;

  const assetLoader = new AssetLoader();
  await assetLoader.loadAll((progress) => {
    const pct = Math.round(progress * 100);
    loadingBarFill.style.width = `${pct}%`;
    loadingText.textContent = `${pct}%`;
  });
  loadingScreen.style.display = 'none';

  // Menu system
  const mainMenu = new MainMenu();
  const lobbyScreen = new LobbyScreen();

  mainMenu.onSinglePlayer = () => {
    mainMenu.hide();
    startSinglePlayer(app, container, assetLoader);
  };

  mainMenu.onMultiplayer = () => {
    mainMenu.hide();
    lobbyScreen.show();
    lobbyScreen.connect(SERVER_URL);
  };

  if (isRestart) {
    startSinglePlayer(app, container, assetLoader);
  } else {
    mainMenu.show();
  }

  lobbyScreen.onBack = () => {
    lobbyScreen.hide();
    mainMenu.show();
  };

  lobbyScreen.onGameStart = (msg, playerId, ws) => {
    const faction = msg.players.find(p => p.id === playerId)?.faction ?? 'humans';
    startMultiplayer(app, container, playerId, faction as 'humans' | 'orcs', ws, assetLoader);
  };
}

function startSinglePlayer(app: Application, container: HTMLElement, assetLoader: AssetLoader): void {
  const localGame = new LocalGame();
  localGame.init();

  const renderer = new GameRenderer(app, localGame, assetLoader);
  renderer.centerOn(localGame.spawnScreen);

  const inputManager = new InputManager(app, renderer, localGame);
  const hud = new HUD(localGame, renderer, inputManager);
  const eventLog = new EventLogPanel(localGame.eventLog);

  const debugPanel = new DebugPanel();
  const debugRenderer = new DebugRenderer(localGame, renderer.entityRenderer);
  renderer.worldContainer.addChild(debugRenderer.container);

  const endgameOverlay = document.getElementById('endgame-overlay')!;
  const endgameTitle = document.getElementById('endgame-title')!;
  const endgameSubtitle = document.getElementById('endgame-subtitle')!;
  const btnEndgameMenu = document.getElementById('btn-endgame-menu')!;
  let endgameShown = false;

  btnEndgameMenu.addEventListener('click', () => {
    location.reload();
  });

  // ---- Pause menu ----
  const pauseOverlay = document.getElementById('pause-overlay')!;
  const pauseConfirm = document.getElementById('pause-confirm')!;
  const pauseConfirmMsg = document.getElementById('pause-confirm-msg')!;
  const btnMenu = document.getElementById('btn-menu')!;
  const btnResume = document.getElementById('btn-resume')!;
  const btnRestart = document.getElementById('btn-restart')!;
  const btnQuit = document.getElementById('btn-quit')!;
  const btnConfirmYes = document.getElementById('btn-confirm-yes')!;
  const btnConfirmNo = document.getElementById('btn-confirm-no')!;

  let pendingConfirmAction: (() => void) | null = null;

  function setPaused(paused: boolean): void {
    localGame.paused = paused;
    pauseOverlay.style.display = paused ? 'flex' : 'none';
    pauseConfirm.style.display = 'none';
    pendingConfirmAction = null;
    lastTime = performance.now();
    accumulator = 0;
  }

  function showConfirm(message: string, action: () => void): void {
    pauseConfirmMsg.textContent = message;
    pendingConfirmAction = action;
    pauseConfirm.style.display = '';
  }

  btnMenu.addEventListener('click', () => setPaused(true));
  btnResume.addEventListener('click', () => setPaused(false));
  btnRestart.addEventListener('click', () => {
    showConfirm('Restart the match? Current progress will be lost.', () => {
      sessionStorage.setItem('restart', '1');
      location.reload();
    });
  });
  btnQuit.addEventListener('click', () => {
    showConfirm('Quit to menu? Current progress will be lost.', () => {
      location.reload();
    });
  });
  btnConfirmYes.addEventListener('click', () => {
    pendingConfirmAction?.();
  });
  btnConfirmNo.addEventListener('click', () => {
    pauseConfirm.style.display = 'none';
    pendingConfirmAction = null;
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (endgameShown) return;
      setPaused(!localGame.paused);
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      debugState.enabled = !debugState.enabled;
      debugPanel.setVisible(debugState.enabled);
    }
  });

  let prevSpeedMultiplier = debugState.speedMultiplier;

  const TICK_MS = 100;
  let accumulator = 0;
  let lastTime = performance.now();

  app.ticker.add(() => {
    const now = performance.now();
    const dt = now - lastTime;
    lastTime = now;

    accumulator += dt;

    if (debugState.enabled && debugState.speedMultiplier !== prevSpeedMultiplier) {
      applySpeedMultiplier(localGame, debugState.speedMultiplier);
      prevSpeedMultiplier = debugState.speedMultiplier;
    }

    while (accumulator >= TICK_MS) {
      renderer.entityRenderer.snapshotPositions();
      localGame.tick();
      localGame.recalculateSupply();
      accumulator -= TICK_MS;
    }

    // Victory / defeat overlay
    if (localGame.winner !== null && !endgameShown) {
      endgameShown = true;
      const isVictory = localGame.winner === localGame.localPlayerId;
      endgameTitle.textContent = isVictory ? 'Victory!' : 'Defeat';
      endgameTitle.style.color = isVictory ? '#4caf50' : '#f44336';
      endgameSubtitle.textContent = isVictory
        ? 'You have destroyed all enemy buildings.'
        : 'Your base has been destroyed.';
      endgameOverlay.style.display = 'flex';
    }

    const alpha = accumulator / TICK_MS;
    renderer.render(alpha);
    hud.update();
    eventLog.update();
    inputManager.update();

    const placingKind = inputManager.getPlacingBuilding();
    if (placingKind) {
      const ghostTile = inputManager.getGhostTilePos();
      if (ghostTile) {
        const bData = BUILDING_DATA[placingKind];
        const canPlace = localGame.gameMap.isAreaBuildable(ghostTile, bData.tileWidth, bData.tileHeight);
        renderer.drawBuildGhost(ghostTile, bData.tileWidth, bData.tileHeight, canPlace);
      }
    } else {
      renderer.hideBuildGhost();
    }

    debugRenderer.update(alpha);
    if (debugState.enabled) {
      debugState.fps = Math.round(app.ticker.FPS);
      debugState.entityCount = localGame.world.query('Position').length;
      debugState.tick = localGame.world.tick;

      const aiController = localGame.aiSystem.getController(2);
      if (aiController) {
        Object.assign(debugState.aiDebug, aiController.debug);
      }

      debugPanel.refresh();

      debugState.activePaths = debugState.activePaths.filter(entry => {
        const mov = localGame.world.getComponent(entry.entityId, Movement);
        return mov !== undefined && mov.isMoving;
      });
    }
  });
}

function startMultiplayer(
  app: Application,
  container: HTMLElement,
  playerId: number,
  faction: 'humans' | 'orcs',
  ws: WebSocket,
  assetLoader: AssetLoader,
): void {
  const netGame = new NetworkGame(playerId, faction, ws);
  netGame.init();

  const renderer = new GameRenderer(app, netGame as any, assetLoader);
  renderer.centerOn(netGame.spawnScreen);

  const inputManager = new InputManager(app, renderer, netGame as any);
  const hud = new HUD(netGame as any, renderer, inputManager);
  const eventLog = new EventLogPanel(netGame.eventLog);

  const TICK_MS = 100;
  let accumulator = 0;
  let lastTime = performance.now();

  app.ticker.add(() => {
    const now = performance.now();
    const dt = now - lastTime;
    lastTime = now;

    accumulator += dt;

    // Flush pending commands to server each frame
    netGame.flushCommands();

    // Render (server drives ticking via NetworkGame.applyServerTick)
    const alpha = accumulator / TICK_MS;
    if (accumulator >= TICK_MS) {
      renderer.entityRenderer.snapshotPositions();
      accumulator -= TICK_MS;
    }

    renderer.render(alpha);
    hud.update();
    eventLog.update();
    inputManager.update();

    const placingKind = inputManager.getPlacingBuilding();
    if (placingKind) {
      const ghostTile = inputManager.getGhostTilePos();
      if (ghostTile) {
        const bData = BUILDING_DATA[placingKind];
        const canPlace = netGame.gameMap.isAreaBuildable(ghostTile, bData.tileWidth, bData.tileHeight);
        renderer.drawBuildGhost(ghostTile, bData.tileWidth, bData.tileHeight, canPlace);
      }
    } else {
      renderer.hideBuildGhost();
    }
  });
}

function applySpeedMultiplier(game: LocalGame, multiplier: number): void {
  const world = game.world;
  const entities = world.query(Movement.type, UnitType.type);

  for (const entityId of entities) {
    const mov = world.getComponent(entityId, Movement)!;
    const ut = world.getComponent(entityId, UnitType)!;
    const baseSpeed = UNIT_DATA[ut.kind]?.speed;
    if (baseSpeed !== undefined) {
      mov.speed = Math.round(baseSpeed * multiplier);
    }
  }
}

main().catch(console.error);
