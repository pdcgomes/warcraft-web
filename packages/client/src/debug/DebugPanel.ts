import { debugState } from './DebugState.js';

/**
 * Debug panel powered by Tweakpane.
 *
 * Hidden by default; toggled with the Tab key via DebugState.enabled.
 * Organizes controls into folders for easy discovery. Adding a new
 * control is a single `folder.addBinding(debugState, 'prop', opts)` call.
 */
export class DebugPanel {
  private pane: { element: HTMLElement; addFolder: Function; refresh: Function; dispose: Function } | null = null;

  constructor() {
    this.initAsync();
  }

  private async initAsync(): Promise<void> {
    try {
      const tp = await import('tweakpane');
      const PaneClass = (tp as Record<string, unknown>).Pane as new (opts: Record<string, unknown>) => Record<string, Function> & { element: HTMLElement };
      const pane = new PaneClass({ title: 'Debug', expanded: true });
      pane.element.parentElement!.style.zIndex = '1000';
      this.pane = pane as unknown as typeof this.pane;

      const vis = pane.addFolder({ title: 'Visualisation' });
      vis.addBinding(debugState, 'showPaths', { label: 'Paths' });
      vis.addBinding(debugState, 'showColliders', { label: 'Colliders' });
      vis.addBinding(debugState, 'showBehaviorState', { label: 'Behavior' });
      vis.addBinding(debugState, 'showUnitNames', { label: 'Units' });
      vis.addBinding(debugState, 'showBuildingNames', { label: 'Buildings' });
      vis.addBinding(debugState, 'showResourceNames', { label: 'Resources' });

      const visEl = (vis as unknown as { element: HTMLElement }).element;
      if (visEl) {
        const container = visEl.querySelector('.tp-fldv-c') as HTMLElement | null;
        if (container) {
          container.style.display = 'grid';
          container.style.gridTemplateColumns = '1fr 1fr';
          container.style.gap = '0';
        }
      }

      const rendering = pane.addFolder({ title: 'Rendering' });
      rendering.addBinding(debugState, 'forceGraphics', { label: 'Force Graphics' });

      const tuning = pane.addFolder({ title: 'Tuning' });
      tuning.addBinding(debugState, 'speedMultiplier', {
        label: 'Speed ×',
        min: 0.1,
        max: 5.0,
        step: 0.1,
      });

      const monitors = pane.addFolder({ title: 'Monitors' });
      monitors.addBinding(debugState, 'fps', { readonly: true, label: 'FPS' });
      monitors.addBinding(debugState, 'entityCount', { readonly: true, label: 'Entities' });
      monitors.addBinding(debugState, 'tick', { readonly: true, label: 'Tick' });

      this.setVisible(false);
    } catch (err) {
      console.warn('[DebugPanel] failed to initialize tweakpane:', err);
    }
  }

  setVisible(visible: boolean): void {
    if (!this.pane) return;
    const root = this.pane.element.parentElement;
    if (root) {
      root.style.display = visible ? '' : 'none';
    }
  }

  refresh(): void {
    this.pane?.refresh();
  }

  dispose(): void {
    this.pane?.dispose();
  }
}
