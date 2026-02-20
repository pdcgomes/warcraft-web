export interface ProposalDebugEntry {
  domain: string;
  action: string;
  baseUtility: number;
  weight: number;
  finalScore: number;
  accepted: boolean;
}

export interface AdvisorDebugEntry {
  domain: string;
  proposalCount: number;
  proposals: ProposalDebugEntry[];
}

export interface TaskDebugEntry {
  id: string;
  domain: string;
  label: string;
  status: string;
}

export interface AIDebugSnapshot {
  enabled: boolean;
  activePersonality: string;

  reflex: {
    threatDetected: boolean;
    threatsNearBase: number;
    unitsUnderAttack: number;
    defendTaskInjected: boolean;
  };

  tactical: {
    lastRunTick: number;
    idleUnitsReassigned: number;
    failedTasksCleaned: number;
  };

  strategic: {
    lastRunTick: number;
    advisorOutputs: AdvisorDebugEntry[];
    rankedProposals: ProposalDebugEntry[];
    acceptedProposals: string[];
  };

  activeTasks: TaskDebugEntry[];
}

export function createDefaultAIDebugSnapshot(): AIDebugSnapshot {
  return {
    enabled: true,
    activePersonality: '',
    reflex: { threatDetected: false, threatsNearBase: 0, unitsUnderAttack: 0, defendTaskInjected: false },
    tactical: { lastRunTick: 0, idleUnitsReassigned: 0, failedTasksCleaned: 0 },
    strategic: { lastRunTick: 0, advisorOutputs: [], rankedProposals: [], acceptedProposals: [] },
    activeTasks: [],
  };
}
