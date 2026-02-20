export interface AIPersonality {
  readonly name: string;

  readonly economyWeight: number;
  readonly militaryWeight: number;
  readonly expansionWeight: number;
  readonly defenseWeight: number;
  readonly scoutWeight: number;

  readonly aggressiveness: number;
  readonly riskTolerance: number;
  readonly techPreference: number;
  readonly workerRatio: number;

  readonly thinkInterval: number;
  readonly firstAttackTick: number;
}

export function domainWeight(personality: AIPersonality, domain: string): number {
  switch (domain) {
    case 'economy': return personality.economyWeight;
    case 'military': return personality.militaryWeight;
    case 'expansion': return personality.expansionWeight;
    case 'defense': return personality.defenseWeight;
    case 'scout': return personality.scoutWeight;
    default: return 0.5;
  }
}

export const AI_PRESETS: Record<string, AIPersonality> = {
  rusher: {
    name: 'Rusher',
    economyWeight: 0.3, militaryWeight: 0.9, expansionWeight: 0.3,
    defenseWeight: 0.4, scoutWeight: 0.5,
    aggressiveness: 0.9, riskTolerance: 0.8, techPreference: 0.1, workerRatio: 0.25,
    thinkInterval: 20, firstAttackTick: 60,
  },
  turtler: {
    name: 'Turtler',
    economyWeight: 0.8, militaryWeight: 0.4, expansionWeight: 0.7,
    defenseWeight: 0.9, scoutWeight: 0.4,
    aggressiveness: 0.1, riskTolerance: 0.2, techPreference: 0.6, workerRatio: 0.35,
    thinkInterval: 35, firstAttackTick: 300,
  },
  balanced: {
    name: 'Balanced',
    economyWeight: 0.6, militaryWeight: 0.6, expansionWeight: 0.6,
    defenseWeight: 0.6, scoutWeight: 0.5,
    aggressiveness: 0.5, riskTolerance: 0.5, techPreference: 0.5, workerRatio: 0.3,
    thinkInterval: 30, firstAttackTick: 150,
  },
  boomer: {
    name: 'Boomer',
    economyWeight: 0.9, militaryWeight: 0.3, expansionWeight: 0.8,
    defenseWeight: 0.5, scoutWeight: 0.4,
    aggressiveness: 0.2, riskTolerance: 0.3, techPreference: 0.9, workerRatio: 0.35,
    thinkInterval: 40, firstAttackTick: 400,
  },
};
