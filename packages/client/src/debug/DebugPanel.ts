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
      vis.addBinding(debugState, 'showHudDebug', { label: 'HUD Debug' });
      vis.addBinding(debugState, 'showPaths', { label: 'Paths' });
      vis.addBinding(debugState, 'showColliders', { label: 'Colliders' });
      vis.addBinding(debugState, 'showBehaviorState', { label: 'Behavior' });
      vis.addBinding(debugState, 'showUnitNames', { label: 'Units' });
      vis.addBinding(debugState, 'showBuildingNames', { label: 'Buildings' });
      vis.addBinding(debugState, 'showResourceNames', { label: 'Resources' });
      vis.addBinding(debugState, 'disableFog', { label: 'No Fog' });

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

      this.buildAIFolder(pane);

      this.setVisible(false);
    } catch (err) {
      console.warn('[DebugPanel] failed to initialize tweakpane:', err);
    }
  }

  private buildAIFolder(pane: Record<string, Function>): void {
    const ai = pane.addFolder({ title: 'AI', expanded: false });
    const debug = debugState.aiDebug;

    ai.addBinding(debug, 'enabled', { label: 'Enabled' });
    ai.addBinding(debug, 'activePersonality', { readonly: true, label: 'Personality' });

    const reflexFolder = ai.addFolder({ title: 'Reflexes', expanded: false });
    reflexFolder.addBinding(debug.reflex, 'threatDetected', { readonly: true, label: 'Threat' });
    reflexFolder.addBinding(debug.reflex, 'threatsNearBase', { readonly: true, label: 'Near base' });
    reflexFolder.addBinding(debug.reflex, 'unitsUnderAttack', { readonly: true, label: 'Under attack' });
    reflexFolder.addBinding(debug.reflex, 'defendTaskInjected', { readonly: true, label: 'Defend injected' });

    const tacticalFolder = ai.addFolder({ title: 'Tactical', expanded: false });
    tacticalFolder.addBinding(debug.tactical, 'lastRunTick', { readonly: true, label: 'Last run' });
    tacticalFolder.addBinding(debug.tactical, 'idleUnitsReassigned', { readonly: true, label: 'Idle reassigned' });
    tacticalFolder.addBinding(debug.tactical, 'failedTasksCleaned', { readonly: true, label: 'Failed cleaned' });

    const strategicFolder = ai.addFolder({ title: 'Strategic', expanded: false });
    strategicFolder.addBinding(debug.strategic, 'lastRunTick', { readonly: true, label: 'Last run' });

    this.strategicTextTarget = { proposalText: '', taskText: '' };
    strategicFolder.addBinding(this.strategicTextTarget, 'proposalText', {
      readonly: true, label: 'Proposals', multiline: true, rows: 8,
    });

    const taskFolder = ai.addFolder({ title: 'Active Tasks', expanded: false });
    taskFolder.addBinding(this.strategicTextTarget, 'taskText', {
      readonly: true, label: 'Tasks', multiline: true, rows: 6,
    });
  }

  private strategicTextTarget: { proposalText: string; taskText: string } = {
    proposalText: '', taskText: '',
  };

  private updateAIText(): void {
    const debug = debugState.aiDebug;

    const lines: string[] = [];
    for (const p of debug.strategic.rankedProposals) {
      const marker = p.accepted ? ' ✓' : '';
      lines.push(`[${p.domain}] ${p.action}  ${p.finalScore.toFixed(2)}${marker}`);
    }
    this.strategicTextTarget.proposalText = lines.join('\n') || '(none)';

    const taskLines: string[] = [];
    for (const t of debug.activeTasks) {
      taskLines.push(`[${t.domain}] ${t.label}  ${t.status}`);
    }
    this.strategicTextTarget.taskText = taskLines.join('\n') || '(none)';
  }

  setVisible(visible: boolean): void {
    if (!this.pane) return;
    const root = this.pane.element.parentElement;
    if (root) {
      root.style.display = visible ? '' : 'none';
    }
  }

  refresh(): void {
    this.updateAIText();
    this.pane?.refresh();
  }

  dispose(): void {
    this.pane?.dispose();
  }
}
