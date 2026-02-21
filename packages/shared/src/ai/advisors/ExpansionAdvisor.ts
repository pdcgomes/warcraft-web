import type { Advisor, Proposal } from './Advisor.js';
import type { AIWorldView } from '../AIWorldView.js';
import type { AIPersonality } from '../AIPersonality.js';
import type { AIRandom } from '../AIRandom.js';
import type { BuildingKind } from '../../components/Building.js';
import type { Point } from '../../math/Point.js';
import { BuildTask } from '../tasks/BuildTask.js';
import { BUILDING_DATA } from '../../data/BuildingData.js';
import { meetsPrerequisites } from '../../data/UnitData.js';

export class ExpansionAdvisor implements Advisor {
  readonly domain = 'expansion';

  evaluate(view: AIWorldView, personality: AIPersonality, rng: AIRandom): Proposal[] {
    const proposals: Proposal[] = [];

    this.proposeBarracks(view, rng, proposals);
    this.proposeSupply(view, rng, proposals);
    this.proposeTechBuildings(view, personality, rng, proposals);

    return proposals;
  }

  private proposeBarracks(view: AIWorldView, rng: AIRandom, proposals: Proposal[]): void {
    if (view.ownBuildingKinds.has('barracks')) return;

    const location = this.findBuildSite(view, 3, 3, rng);
    if (!location) return;

    const workers = this.getAvailableWorkers(view);
    if (workers.length === 0) return;

    proposals.push({
      domain: 'expansion',
      action: 'Build barracks',
      utility: 0.85,
      createTask: () => new BuildTask('barracks', location, [workers[0]], view.faction),
    });
  }

  private proposeSupply(view: AIWorldView, rng: AIRandom, proposals: Proposal[]): void {
    if (view.supplyUsed < view.supplyCap - 2) return;

    const farmKind: BuildingKind = view.faction === 'humans' ? 'farm' : 'pig_farm';
    const data = BUILDING_DATA[farmKind];
    const location = this.findBuildSite(view, data.tileWidth, data.tileHeight, rng);
    if (!location) return;

    const workers = this.getAvailableWorkers(view);
    if (workers.length === 0) return;

    proposals.push({
      domain: 'expansion',
      action: `Build ${farmKind}`,
      utility: 0.75,
      createTask: () => new BuildTask(farmKind, location, [workers[0]], view.faction),
    });
  }

  private proposeTechBuildings(view: AIWorldView, personality: AIPersonality, rng: AIRandom, proposals: Proposal[]): void {
    if (personality.techPreference < 0.3) return;

    const candidates = this.getTechBuildingOrder(view);

    for (const kind of candidates) {
      if (view.ownBuildingKinds.has(kind)) continue;

      const data = BUILDING_DATA[kind];
      if (data.faction !== 'any' && data.faction !== view.faction) continue;
      if (!meetsPrerequisites(data.requires, view.ownBuildingKinds)) continue;

      const location = this.findBuildSite(view, data.tileWidth, data.tileHeight, rng);
      if (!location) continue;

      const workers = this.getAvailableWorkers(view);
      if (workers.length === 0) break;

      const utility = 0.4 + personality.techPreference * 0.3;
      const k = kind;

      proposals.push({
        domain: 'expansion',
        action: `Build ${k}`,
        utility: Math.min(utility, 0.8),
        createTask: () => new BuildTask(k, location, [workers[0]], view.faction),
      });
      break;
    }
  }

  private getTechBuildingOrder(view: AIWorldView): BuildingKind[] {
    if (view.faction === 'humans') {
      return ['lumber_mill', 'blacksmith', 'stable', 'tower'];
    }
    return ['war_mill', 'blacksmith', 'beastiary', 'guard_tower'];
  }

  private findBuildSite(view: AIWorldView, width: number, height: number, rng: AIRandom): Point | null {
    const cx = Math.round(view.baseCenter.x / 1000);
    const cy = Math.round(view.baseCenter.y / 1000);

    for (let ring = 4; ring <= 12; ring++) {
      const candidates: Point[] = [];
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0) continue;
          candidates.push({ x, y });
        }
      }
      if (candidates.length > 0) {
        return rng.pick(candidates)!;
      }
    }
    return null;
  }

  private getAvailableWorkers(view: AIWorldView): number[] {
    if (view.idleWorkers.length > 0) return [...view.idleWorkers];
    const allWorkers = view.ownUnits.get('worker') ?? [];
    return allWorkers.length > 0 ? [allWorkers[0]] : [];
  }
}
