import type { ResourceCost } from '../data/UnitData.js';

/**
 * Standalone data class tracking per-player resource totals and supply.
 * Lives outside any system so it can be accessed by multiple systems
 * and included in world checksum calculations.
 */
export class PlayerResources {
  private resources: Map<number, { gold: number; lumber: number }> = new Map();
  private supply: Map<number, { used: number; cap: number }> = new Map();

  get(playerId: number): { gold: number; lumber: number } {
    let res = this.resources.get(playerId);
    if (!res) {
      res = { gold: 0, lumber: 0 };
      this.resources.set(playerId, res);
    }
    return res;
  }

  getSupply(playerId: number): { used: number; cap: number } {
    let s = this.supply.get(playerId);
    if (!s) {
      s = { used: 0, cap: 0 };
      this.supply.set(playerId, s);
    }
    return s;
  }

  /** Check if the player can afford a given cost. */
  canAfford(playerId: number, cost: ResourceCost): boolean {
    const res = this.get(playerId);
    return res.gold >= cost.gold && res.lumber >= cost.lumber;
  }

  /** Deduct resources. Returns false if the player cannot afford it. */
  deduct(playerId: number, cost: ResourceCost): boolean {
    if (!this.canAfford(playerId, cost)) return false;
    const res = this.get(playerId);
    res.gold -= cost.gold;
    res.lumber -= cost.lumber;
    return true;
  }

  /** Refund resources (e.g. when cancelling production). */
  refund(playerId: number, cost: ResourceCost): void {
    const res = this.get(playerId);
    res.gold += cost.gold;
    res.lumber += cost.lumber;
  }

  /** Check if the player has enough supply capacity for additional units. */
  hasSupply(playerId: number, amount: number = 1): boolean {
    const s = this.getSupply(playerId);
    return s.used + amount <= s.cap;
  }

  /** Get all player IDs that have resource entries. */
  getPlayerIds(): number[] {
    return Array.from(this.resources.keys()).sort((a, b) => a - b);
  }

  /**
   * Compute a deterministic checksum contribution for desync detection.
   */
  checksum(): number {
    let hash = 0;
    const playerIds = this.getPlayerIds();
    for (const id of playerIds) {
      const res = this.resources.get(id)!;
      hash = (hash * 31 + id) | 0;
      hash = (hash * 31 + res.gold) | 0;
      hash = (hash * 31 + res.lumber) | 0;
      const s = this.supply.get(id);
      if (s) {
        hash = (hash * 31 + s.used) | 0;
        hash = (hash * 31 + s.cap) | 0;
      }
    }
    return hash >>> 0;
  }
}
