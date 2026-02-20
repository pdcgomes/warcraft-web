import type { FactionId } from '../components/Owner.js';
import type { EntityId } from '../ecs/Entity.js';
import type { AIPersonality } from './AIPersonality.js';
import { domainWeight } from './AIPersonality.js';
import type { Advisor, Proposal } from './advisors/Advisor.js';
import type { Task, TaskContext } from './tasks/Task.js';
import type { AIWorldView } from './AIWorldView.js';
import { buildWorldView } from './AIWorldView.js';
import type { AIDebugSnapshot, ProposalDebugEntry, AdvisorDebugEntry, TaskDebugEntry } from './AIDebugState.js';
import { createDefaultAIDebugSnapshot } from './AIDebugState.js';
import { Position } from '../components/Position.js';
import { Owner } from '../components/Owner.js';
import { Health } from '../components/Health.js';
import { Combat } from '../components/Combat.js';
import { UnitType } from '../components/UnitType.js';
import { UnitBehavior } from '../components/UnitBehavior.js';
import { UNIT_DATA } from '../data/UnitData.js';

import { EconomyAdvisor } from './advisors/EconomyAdvisor.js';
import { ExpansionAdvisor } from './advisors/ExpansionAdvisor.js';
import { MilitaryAdvisor } from './advisors/MilitaryAdvisor.js';
import { DefenseAdvisor } from './advisors/DefenseAdvisor.js';
import { ScoutAdvisor } from './advisors/ScoutAdvisor.js';
import { DefendTask } from './tasks/DefendTask.js';
import { GatherTask } from './tasks/GatherTask.js';

const TACTICAL_INTERVAL = 5;
const THREAT_RADIUS = 10000;

const DOMAIN_PRIORITY: Record<string, number> = {
  defense: 0,
  military: 1,
  economy: 2,
  expansion: 3,
  scout: 4,
};

export class AIController {
  readonly playerId: number;
  readonly faction: FactionId;
  readonly personality: AIPersonality;
  readonly debug: AIDebugSnapshot;

  private readonly advisors: Advisor[];
  private activeTasks: Task[] = [];
  private strategicCooldown: number;
  private tacticalCooldown = 0;
  private prevHealth: Map<EntityId, number> = new Map();
  private lastView: AIWorldView | null = null;

  constructor(playerId: number, faction: FactionId, personality: AIPersonality) {
    this.playerId = playerId;
    this.faction = faction;
    this.personality = personality;
    this.debug = createDefaultAIDebugSnapshot();
    this.debug.activePersonality = personality.name;
    this.strategicCooldown = Math.floor(personality.thinkInterval / 2);

    this.advisors = [
      new EconomyAdvisor(),
      new ExpansionAdvisor(),
      new MilitaryAdvisor(),
      new DefenseAdvisor(),
      new ScoutAdvisor(),
    ];
  }

  update(ctx: TaskContext): void {
    if (!this.debug.enabled) return;

    this.debug.reflex.threatDetected = false;
    this.debug.reflex.threatsNearBase = 0;
    this.debug.reflex.unitsUnderAttack = 0;
    this.debug.reflex.defendTaskInjected = false;

    this.reflexScan(ctx);
    this.tacticalCooldown--;
    if (this.tacticalCooldown <= 0) {
      this.tacticalCycle(ctx);
      this.tacticalCooldown = TACTICAL_INTERVAL;
    }

    this.strategicCooldown--;
    if (this.strategicCooldown <= 0) {
      this.think(ctx);
      this.strategicCooldown = this.personality.thinkInterval;
    }

    this.executeTasks(ctx);
    this.pruneTasks(ctx);
    this.updateHealthSnapshot(ctx);
    this.updateDebugTasks();
  }

  think(ctx: TaskContext): void {
    const view = buildWorldView(ctx.world, this.playerId, this.faction, ctx.playerResources, ctx.gameMap);
    this.lastView = view;

    const allProposals: { proposal: Proposal; weight: number; score: number }[] = [];
    const advisorOutputs: AdvisorDebugEntry[] = [];

    for (const advisor of this.advisors) {
      const proposals = advisor.evaluate(view, this.personality);
      const weight = domainWeight(this.personality, advisor.domain);

      const debugProposals: ProposalDebugEntry[] = [];
      for (const p of proposals) {
        const score = p.utility * weight;
        allProposals.push({ proposal: p, weight, score });
        debugProposals.push({
          domain: p.domain,
          action: p.action,
          baseUtility: p.utility,
          weight,
          finalScore: score,
          accepted: false,
        });
      }

      advisorOutputs.push({
        domain: advisor.domain,
        proposalCount: proposals.length,
        proposals: debugProposals,
      });
    }

    allProposals.sort((a, b) => b.score - a.score);

    const maxNewTasks = 5;
    let accepted = 0;
    const acceptedLabels: string[] = [];
    const rankedDebug: ProposalDebugEntry[] = [];

    for (const item of allProposals) {
      const isAccepted = accepted < maxNewTasks && !this.hasDomainTask(item.proposal.domain);

      rankedDebug.push({
        domain: item.proposal.domain,
        action: item.proposal.action,
        baseUtility: item.proposal.utility,
        weight: item.weight,
        finalScore: item.score,
        accepted: isAccepted,
      });

      if (isAccepted) {
        const task = item.proposal.createTask();
        this.activeTasks.push(task);
        acceptedLabels.push(item.proposal.action);
        accepted++;
      }
    }

    this.debug.strategic.lastRunTick = ctx.world.tick;
    this.debug.strategic.advisorOutputs = advisorOutputs;
    this.debug.strategic.rankedProposals = rankedDebug;
    this.debug.strategic.acceptedProposals = acceptedLabels;
  }

  private reflexScan(ctx: TaskContext): void {
    const view = this.lastView ?? buildWorldView(ctx.world, this.playerId, this.faction, ctx.playerResources, ctx.gameMap);

    let threatsNearBase = 0;
    let unitsUnderAttack = 0;

    const baseCenter = view.baseCenter;
    const r2 = THREAT_RADIUS * THREAT_RADIUS;
    const enemies = ctx.world.query(Position.type, Owner.type, Combat.type);

    for (const eid of enemies) {
      const owner = ctx.world.getComponent(eid, Owner)!;
      if (owner.playerId === this.playerId || owner.playerId === 0) continue;

      const health = ctx.world.getComponent(eid, Health);
      if (health && health.isDead) continue;

      const pos = ctx.world.getComponent(eid, Position)!;
      const dx = pos.x - baseCenter.x;
      const dy = pos.y - baseCenter.y;
      if (dx * dx + dy * dy <= r2) {
        threatsNearBase++;
      }
    }

    const ownUnits = ctx.world.query(Position.type, Owner.type, Health.type);
    for (const eid of ownUnits) {
      const owner = ctx.world.getComponent(eid, Owner)!;
      if (owner.playerId !== this.playerId) continue;

      const health = ctx.world.getComponent(eid, Health)!;
      const prev = this.prevHealth.get(eid);
      if (prev !== undefined && health.current < prev) {
        unitsUnderAttack++;
      }
    }

    this.debug.reflex.threatsNearBase = threatsNearBase;
    this.debug.reflex.unitsUnderAttack = unitsUnderAttack;

    const threatDetected = threatsNearBase > 0 || unitsUnderAttack > 0;
    this.debug.reflex.threatDetected = threatDetected;

    if (threatDetected && !this.hasActiveDefendTask()) {
      const defenders = this.gatherDefenders(ctx);
      if (defenders.length > 0) {
        const task = new DefendTask(defenders, baseCenter);
        this.activeTasks.push(task);
        this.debug.reflex.defendTaskInjected = true;

        this.cancelTasksByDomain('scout');
      }
    }
  }

  private tacticalCycle(ctx: TaskContext): void {
    let idleReassigned = 0;
    let failedCleaned = 0;

    const view = this.lastView ?? buildWorldView(ctx.world, this.playerId, this.faction, ctx.playerResources, ctx.gameMap);

    for (const workerId of view.idleWorkers) {
      const alreadyAssigned = this.activeTasks.some(
        t => t.domain === 'economy' && t.status === 'active',
      );
      if (!alreadyAssigned && view.knownResourceNodes.length > 0) {
        const resourceId = view.knownResourceNodes[0];
        this.activeTasks.push(new GatherTask(workerId, resourceId));
        idleReassigned++;
      }
    }

    for (const task of this.activeTasks) {
      if (task.status === 'active' && !task.isValid(ctx)) {
        task.status = 'failed';
        failedCleaned++;
      }
    }

    this.debug.tactical.lastRunTick = ctx.world.tick;
    this.debug.tactical.idleUnitsReassigned = idleReassigned;
    this.debug.tactical.failedTasksCleaned = failedCleaned;
  }

  private executeTasks(ctx: TaskContext): void {
    for (const task of this.activeTasks) {
      if (task.status === 'active') {
        task.execute(ctx);
      }
    }
  }

  private pruneTasks(ctx: TaskContext): void {
    this.activeTasks = this.activeTasks.filter(
      t => t.status === 'active',
    );
  }

  private hasActiveDefendTask(): boolean {
    return this.activeTasks.some(t => t.domain === 'defense' && t instanceof DefendTask && t.status === 'active');
  }

  private hasDomainTask(domain: string): boolean {
    return this.activeTasks.some(t => t.domain === domain && t.status === 'active');
  }

  private cancelTasksByDomain(domain: string): void {
    for (const task of this.activeTasks) {
      if (task.domain === domain && task.status === 'active') {
        task.status = 'cancelled';
      }
    }
  }

  private gatherDefenders(ctx: TaskContext): EntityId[] {
    const defenders: EntityId[] = [];
    const entities = ctx.world.query(Position.type, Owner.type, UnitType.type);

    for (const eid of entities) {
      const owner = ctx.world.getComponent(eid, Owner)!;
      if (owner.playerId !== this.playerId) continue;

      const unitType = ctx.world.getComponent(eid, UnitType)!;
      if (UNIT_DATA[unitType.kind].isWorker) continue;

      const health = ctx.world.getComponent(eid, Health);
      if (health && health.isDead) continue;

      defenders.push(eid);
    }
    return defenders;
  }

  private updateHealthSnapshot(ctx: TaskContext): void {
    this.prevHealth.clear();
    const entities = ctx.world.query(Owner.type, Health.type);
    for (const eid of entities) {
      const owner = ctx.world.getComponent(eid, Owner)!;
      if (owner.playerId !== this.playerId) continue;
      const health = ctx.world.getComponent(eid, Health)!;
      this.prevHealth.set(eid, health.current);
    }
  }

  private updateDebugTasks(): void {
    this.debug.activeTasks = this.activeTasks.map(t => ({
      id: t.id,
      domain: t.domain,
      label: t.label,
      status: t.status,
    }));
  }
}
