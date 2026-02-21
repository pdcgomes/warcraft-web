import type { AIWorldView } from './AIWorldView.js';
import type { AIPersonality } from './AIPersonality.js';
import type { AIRandom } from './AIRandom.js';

export interface AttackReadinessResult {
  score: number;
  threshold: number;
  ready: boolean;
}

/**
 * Computes a composite 0-1 "attack readiness" score from multiple game-state
 * signals and compares it against a personality-derived threshold.
 *
 * Factors: force ratio, strength ratio, economy health, resource stockpile,
 * tech advantage, and base safety. Personality modulates the weights so that
 * aggressive AIs attack sooner while cautious AIs wait for comfort.
 */
export function computeAttackReadiness(
  view: AIWorldView,
  personality: AIPersonality,
  rng: AIRandom,
): AttackReadinessResult {
  const desiredForce = Math.round(3 + (1 - personality.aggressiveness) * 4);
  const forceRatio = Math.min(1, view.idleMilitary.length / Math.max(1, desiredForce));

  const strengthRatio = view.estimatedEnemyStrength > 0
    ? Math.min(1, view.ownMilitaryStrength / view.estimatedEnemyStrength)
    : (view.ownMilitaryStrength > 0 ? 1 : 0);

  const economyHealth = view.economyScore;

  const resourceStockpile = Math.min(1, (view.gold + view.lumber) / 1000);

  const techAdvantage = Math.min(1, view.techLevel / 4);

  const baseSafety = view.activeThreats.length === 0 ? 1 : 0;

  // Personality-modulated weights
  const aggr = personality.aggressiveness;
  const wForce     = 0.30 - aggr * 0.10;     // aggressive -> force matters less
  const wStrength  = 0.25 - aggr * 0.08;     // aggressive -> more willing when outnumbered
  const wEconomy   = 0.15 + (1 - aggr) * 0.05;  // cautious -> economy matters more
  const wResource  = 0.10;
  const wTech      = 0.10;
  const wSafety    = 0.10 + (1 - aggr) * 0.05;  // cautious -> base safety matters more

  const totalWeight = wForce + wStrength + wEconomy + wResource + wTech + wSafety;

  const score = (
    wForce * forceRatio +
    wStrength * strengthRatio +
    wEconomy * economyHealth +
    wResource * resourceStockpile +
    wTech * techAdvantage +
    wSafety * baseSafety
  ) / totalWeight;

  const noise = (rng.next() - 0.5) * 0.06;
  const threshold = 0.35 + (1 - aggr) * 0.35 + noise;

  return { score, threshold, ready: score >= threshold };
}
