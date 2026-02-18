import type { Point } from '@warcraft-web/shared';

/**
 * Singleton debug state object.
 *
 * All debug flags, tuning values, monitors, and transient debug data live
 * here as plain properties. Tweakpane binds to them bidirectionally; game
 * systems and renderers read from them directly.
 *
 * To add a new debug control, just add a property here and bind it in
 * DebugPanel -- one line each.
 */

export interface DebugPathEntry {
  entityId: number;
  path: Point[];
}

export const debugState = {
  // -- Master toggle (Tab key) --
  enabled: false,

  // -- Visualisation toggles --
  showPaths: false,
  showColliders: false,
  showBehaviorState: false,
  showUnitNames: false,
  showBuildingNames: false,

  // -- Tuning --
  speedMultiplier: 1.0,

  // -- Monitors (written by game loop, read-only in panel) --
  fps: 0,
  entityCount: 0,
  tick: 0,

  // -- Transient debug data --
  activePaths: [] as DebugPathEntry[],
};

export type DebugState = typeof debugState;
