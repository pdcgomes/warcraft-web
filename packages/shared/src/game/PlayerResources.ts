/**
 * Standalone data class tracking per-player resource totals.
 * Lives outside any system so it can be accessed by multiple systems
 * and included in world checksum calculations.
 */
export class PlayerResources {
  private resources: Map<number, { gold: number; lumber: number }> = new Map();

  get(playerId: number): { gold: number; lumber: number } {
    let res = this.resources.get(playerId);
    if (!res) {
      res = { gold: 0, lumber: 0 };
      this.resources.set(playerId, res);
    }
    return res;
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
    }
    return hash >>> 0;
  }
}
