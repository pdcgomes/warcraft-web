import { Application } from 'pixi.js';
import { Movement, UnitType } from '@warcraft-web/shared';
import { GameRenderer } from './renderer/GameRenderer.js';
import { InputManager } from './input/InputManager.js';
import { HUD } from './ui/HUD.js';
import { EventLogPanel } from './ui/EventLogPanel.js';
import { LocalGame } from './game/LocalGame.js';
import { debugState } from './debug/DebugState.js';
import { DebugPanel } from './debug/DebugPanel.js';
import { DebugRenderer } from './debug/DebugRenderer.js';
import { UNIT_STATS } from './game/EntityFactory.js';

async function main() {
  const container = document.getElementById('game-container')!;

  // Create PixiJS application
  const app = new Application();
  await app.init({
    background: 0x111122,
    resizeTo: container,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  container.insertBefore(app.canvas, container.firstChild);

  // Initialize the local game (creates world, entities, systems)
  const localGame = new LocalGame();
  localGame.init();

  // Create renderer and center camera on player spawn
  const renderer = new GameRenderer(app, localGame);
  renderer.centerOn(localGame.spawnScreenX, localGame.spawnScreenY);

  // Create input manager
  const inputManager = new InputManager(app, renderer, localGame);

  // Create HUD (receives inputManager for order button callbacks)
  const hud = new HUD(localGame, renderer, inputManager);

  // Create event log panel
  const eventLog = new EventLogPanel(localGame.eventLog);

  // Create debug overlay
  const debugPanel = new DebugPanel();
  const debugRenderer = new DebugRenderer(localGame, renderer.entityRenderer);
  renderer.worldContainer.addChild(debugRenderer.container);

  // Tab key toggles debug overlay
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      debugState.enabled = !debugState.enabled;
      debugPanel.setVisible(debugState.enabled);
    }
  });

  // Track previous speed multiplier to detect changes
  let prevSpeedMultiplier = debugState.speedMultiplier;

  // Game loop
  const TICK_MS = 100; // 10 ticks per second
  let accumulator = 0;
  let lastTime = performance.now();

  app.ticker.add(() => {
    const now = performance.now();
    const dt = now - lastTime;
    lastTime = now;

    accumulator += dt;

    // Apply speed multiplier when it changes
    if (debugState.enabled && debugState.speedMultiplier !== prevSpeedMultiplier) {
      applySpeedMultiplier(localGame, debugState.speedMultiplier);
      prevSpeedMultiplier = debugState.speedMultiplier;
    }

    // Run simulation ticks at fixed rate
    while (accumulator >= TICK_MS) {
      renderer.entityRenderer.snapshotPositions();
      localGame.tick();
      accumulator -= TICK_MS;
    }

    // Render with interpolation
    const alpha = accumulator / TICK_MS;
    renderer.render(alpha);
    hud.update();
    eventLog.update();
    inputManager.update();

    // Update debug overlay
    debugRenderer.update(alpha);
    if (debugState.enabled) {
      debugState.fps = Math.round(app.ticker.FPS);
      debugState.entityCount = localGame.world.query('Position').length;
      debugState.tick = localGame.world.tick;
      debugPanel.refresh();

      // Clean up debug paths for entities that have stopped moving
      debugState.activePaths = debugState.activePaths.filter(entry => {
        const mov = localGame.world.getComponent(entry.entityId, Movement);
        return mov !== undefined && mov.isMoving;
      });
    }
  });
}

/**
 * Walk all entities with Movement + UnitType and set their speed
 * to the base stat value multiplied by the given multiplier.
 */
function applySpeedMultiplier(game: LocalGame, multiplier: number): void {
  const world = game.world;
  const entities = world.query(Movement.type, UnitType.type);

  for (const entityId of entities) {
    const mov = world.getComponent(entityId, Movement)!;
    const ut = world.getComponent(entityId, UnitType)!;
    const baseSpeed = UNIT_STATS[ut.kind]?.speed;
    if (baseSpeed !== undefined) {
      mov.speed = Math.round(baseSpeed * multiplier);
    }
  }
}

main().catch(console.error);
