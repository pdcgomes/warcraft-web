import type { Advisor, Proposal } from './Advisor.js';
import type { AIWorldView } from '../AIWorldView.js';
import type { AIPersonality } from '../AIPersonality.js';
import type { EntityId } from '../../ecs/Entity.js';
import { GatherTask } from '../tasks/GatherTask.js';
import { TrainTask } from '../tasks/TrainTask.js';

const TARGET_GOLD_LUMBER_RATIO = 2;

export class EconomyAdvisor implements Advisor {
  readonly domain = 'economy';

  evaluate(view: AIWorldView, personality: AIPersonality): Proposal[] {
    const proposals: Proposal[] = [];

    this.proposeWorkerAssignments(view, proposals);
    this.proposeWorkerTraining(view, personality, proposals);

    return proposals;
  }

  private proposeWorkerAssignments(view: AIWorldView, proposals: Proposal[]): void {
    if (view.idleWorkers.length === 0 || view.knownResourceNodes.length === 0) return;

    for (const workerId of view.idleWorkers) {
      const preferGold = this.shouldPreferGold(view);
      const resourceId = this.findBestResource(view, preferGold);
      if (resourceId === null) continue;

      const rid = resourceId;
      const wid = workerId;
      proposals.push({
        domain: 'economy',
        action: preferGold ? 'Assign worker to gold' : 'Assign worker to lumber',
        utility: 0.8,
        createTask: () => new GatherTask(wid, rid),
      });
    }
  }

  private proposeWorkerTraining(view: AIWorldView, personality: AIPersonality, proposals: Proposal[]): void {
    const workerCount = view.ownUnits.get('worker')?.length ?? 0;
    const targetWorkers = Math.ceil(personality.workerRatio * view.supplyCap);

    if (workerCount >= targetWorkers) return;
    if (view.supplyUsed >= view.supplyCap) return;

    const townHallKind = view.faction === 'humans' ? 'town_hall' : 'great_hall';
    const townHalls = view.ownBuildings.get(townHallKind);
    if (!townHalls || townHalls.length === 0) return;

    const buildingId = townHalls[0];
    const workerNeed = (targetWorkers - workerCount) / targetWorkers;
    const utility = 0.5 + workerNeed * 0.3;

    proposals.push({
      domain: 'economy',
      action: 'Train worker',
      utility: Math.min(utility, 0.9),
      createTask: () => new TrainTask(buildingId, 'worker', 'economy'),
    });
  }

  private shouldPreferGold(view: AIWorldView): boolean {
    const { gold, lumber } = view.workersGathering;
    if (lumber === 0) return gold <= 1;
    return (gold / Math.max(1, lumber)) < TARGET_GOLD_LUMBER_RATIO;
  }

  private findBestResource(view: AIWorldView, preferGold: boolean): EntityId | null {
    if (view.knownResourceNodes.length === 0) return null;

    // Prefer matching resource type; fall back to any
    for (const rid of view.knownResourceNodes) {
      // We can't access the World directly here, so we just return the first available node.
      // The WorldView could be extended with richer resource info in the future.
      return rid;
    }
    return null;
  }
}
