import type { Advisor, Proposal } from './Advisor.js';
import type { AIWorldView } from '../AIWorldView.js';
import type { AIPersonality } from '../AIPersonality.js';
import type { BuildingKind } from '../../components/Building.js';
import { DefendTask } from '../tasks/DefendTask.js';
import { BuildTask } from '../tasks/BuildTask.js';
import { BUILDING_DATA } from '../../data/BuildingData.js';

export class DefenseAdvisor implements Advisor {
  readonly domain = 'defense';

  evaluate(view: AIWorldView, personality: AIPersonality): Proposal[] {
    const proposals: Proposal[] = [];

    this.proposeBaseDefense(view, proposals);
    this.proposeTowerConstruction(view, personality, proposals);

    return proposals;
  }

  private proposeBaseDefense(view: AIWorldView, proposals: Proposal[]): void {
    if (view.activeThreats.length === 0) return;

    const defenders = [...view.idleMilitary];
    if (defenders.length === 0) {
      const allMilitary: number[] = [];
      for (const [kind, units] of view.ownUnits) {
        if (kind !== 'worker') allMilitary.push(...units);
      }
      if (allMilitary.length === 0) return;
      defenders.push(...allMilitary);
    }

    const units = defenders;
    const base = view.baseCenter;

    proposals.push({
      domain: 'defense',
      action: 'Rally to defend base',
      utility: 0.95,
      createTask: () => new DefendTask(units, base),
    });
  }

  private proposeTowerConstruction(view: AIWorldView, personality: AIPersonality, proposals: Proposal[]): void {
    if (personality.defenseWeight < 0.5) return;
    if (view.economyScore < 0.5) return;
    if (view.gold < 300) return;

    const towerKind: BuildingKind = view.faction === 'humans' ? 'tower' : 'guard_tower';
    const data = BUILDING_DATA[towerKind];

    if (!view.ownBuildingKinds.has(towerKind.includes('tower') ? (view.faction === 'humans' ? 'lumber_mill' : 'war_mill') : 'barracks')) {
      return;
    }

    const cx = Math.round(view.baseCenter.x / 1000);
    const cy = Math.round(view.baseCenter.y / 1000);
    const location = { x: cx + 5, y: cy + 5 };

    const workers = view.idleWorkers.length > 0
      ? [view.idleWorkers[0]]
      : (view.ownUnits.get('worker')?.length ? [view.ownUnits.get('worker')![0]] : []);

    if (workers.length === 0) return;

    const utility = 0.35 + personality.defenseWeight * 0.25;
    const w = workers;

    proposals.push({
      domain: 'defense',
      action: `Build ${towerKind}`,
      utility: Math.min(utility, 0.7),
      createTask: () => new BuildTask(towerKind, location, w, view.faction),
    });
  }
}
