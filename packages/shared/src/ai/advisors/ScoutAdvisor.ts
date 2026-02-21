import type { Advisor, Proposal } from './Advisor.js';
import type { AIWorldView } from '../AIWorldView.js';
import type { AIPersonality } from '../AIPersonality.js';
import type { AIRandom } from '../AIRandom.js';
import { ScoutTask } from '../tasks/ScoutTask.js';

export class ScoutAdvisor implements Advisor {
  readonly domain = 'scout';

  evaluate(view: AIWorldView, personality: AIPersonality, rng: AIRandom): Proposal[] {
    const proposals: Proposal[] = [];

    if (view.unexploredRegions.length === 0) return proposals;
    if (view.idleMilitary.length === 0) return proposals;

    const target = rng.pick(view.unexploredRegions) ?? view.unexploredRegions[0];
    const unit = rng.pick(view.idleMilitary) ?? view.idleMilitary[0];
    const utility = 0.3 + personality.scoutWeight * 0.3;

    proposals.push({
      domain: 'scout',
      action: `Scout (${target.x},${target.y})`,
      utility: Math.min(utility, 0.7),
      createTask: () => new ScoutTask(unit, target),
    });

    return proposals;
  }
}
