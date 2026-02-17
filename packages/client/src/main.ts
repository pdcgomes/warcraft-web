import { Application } from 'pixi.js';
import { GameRenderer } from './renderer/GameRenderer.js';
import { InputManager } from './input/InputManager.js';
import { HUD } from './ui/HUD.js';
import { EventLogPanel } from './ui/EventLogPanel.js';
import { LocalGame } from './game/LocalGame.js';

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

  // Game loop
  const TICK_MS = 100; // 10 ticks per second
  let accumulator = 0;
  let lastTime = performance.now();

  app.ticker.add(() => {
    const now = performance.now();
    const dt = now - lastTime;
    lastTime = now;

    accumulator += dt;

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
  });
}

main().catch(console.error);
