import type { Advisor, Proposal } from './Advisor.js';
import type { AIWorldView } from '../AIWorldView.js';
import type { AIPersonality } from '../AIPersonality.js';
import type { AIRandom } from '../AIRandom.js';
import type { UnitKind } from '../../components/UnitType.js';
import { TrainTask } from '../tasks/TrainTask.js';
import { AttackTask } from '../tasks/AttackTask.js';
import { computeAttackReadiness } from '../AttackReadiness.js';
import { UNIT_DATA, meetsPrerequisites } from '../../data/UnitData.js';

export class MilitaryAdvisor implements Advisor {
  readonly domain = 'military';

  evaluate(view: AIWorldView, personality: AIPersonality, rng: AIRandom): Proposal[] {
    const proposals: Proposal[] = [];

    this.proposeTraining(view, personality, proposals);
    this.proposeAttack(view, personality, rng, proposals);

    return proposals;
  }

  private proposeTraining(view: AIWorldView, personality: AIPersonality, proposals: Proposal[]): void {
    if (!view.ownBuildingKinds.has('barracks')) return;
    if (view.supplyUsed >= view.supplyCap) return;

    const barracks = view.ownBuildings.get('barracks');
    if (!barracks || barracks.length === 0) return;

    const unitKind = this.pickTrainingUnit(view);
    if (!unitKind) return;

    const buildingId = barracks[0];
    const armySize = this.countMilitaryUnits(view);
    const targetArmy = Math.ceil((1 - personality.workerRatio) * view.supplyCap * 0.6);
    const need = Math.max(0, targetArmy - armySize) / Math.max(1, targetArmy);
    const utility = 0.4 + need * 0.4;

    proposals.push({
      domain: 'military',
      action: `Train ${unitKind}`,
      utility: Math.min(utility, 0.85),
      createTask: () => new TrainTask(buildingId, unitKind!, 'military'),
    });
  }

  private proposeAttack(view: AIWorldView, personality: AIPersonality, rng: AIRandom, proposals: Proposal[]): void {
    if (view.tick < personality.firstAttackTick) return;
    if (view.knownEnemyBuildings.length === 0 && view.knownEnemyUnits.length === 0) return;
    if (view.idleMilitary.length < 2) return;

    const { score, ready } = computeAttackReadiness(view, personality, rng);
    if (!ready) return;

    const allTargets = [...view.knownEnemyBuildings, ...view.knownEnemyUnits];
    const targetEntity = rng.pick(allTargets) ?? allTargets[0];
    const targetPos = { x: 0, y: 0 };

    const utility = 0.3 + score * 0.5;
    const units = [...view.idleMilitary];
    const te = targetEntity;

    proposals.push({
      domain: 'military',
      action: 'Attack enemy base',
      utility: Math.min(utility, 0.9),
      createTask: () => new AttackTask(units, targetPos, te),
    });
  }

  private pickTrainingUnit(view: AIWorldView): UnitKind | null {
    const faction = view.faction;
    const basicMelee: UnitKind = faction === 'humans' ? 'footman' : 'grunt';
    const ranged: UnitKind = faction === 'humans' ? 'archer' : 'troll_axethrower';
    const cavalry: UnitKind = faction === 'humans' ? 'knight' : 'raider';

    if (view.techLevel >= 4) {
      const cavData = UNIT_DATA[cavalry];
      if (meetsPrerequisites(cavData.requires, view.ownBuildingKinds)) return cavalry;
    }

    if (view.techLevel >= 2) {
      const rangedData = UNIT_DATA[ranged];
      if (meetsPrerequisites(rangedData.requires, view.ownBuildingKinds)) return ranged;
    }

    return basicMelee;
  }

  private countMilitaryUnits(view: AIWorldView): number {
    let count = 0;
    for (const [kind, units] of view.ownUnits) {
      if (kind !== 'worker') count += units.length;
    }
    return count;
  }
}
