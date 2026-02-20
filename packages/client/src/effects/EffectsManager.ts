import { Container, Graphics, Sprite, Texture, type Renderer } from 'pixi.js';
import {
  Position, Health, Combat, Owner, Building,
  UnitBehavior, Movement, ResourceCarrier,
  tileToScreen, TerrainType,
} from '@warcraft-web/shared';
import type { EntityId, Point, DamageType } from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';
import { ParticlePool } from './ParticlePool.js';
import type { Particle } from './Particle.js';
import type { EmitterConfig, TextureKey } from './EmitterConfigs.js';
import * as Configs from './EmitterConfigs.js';

const NORMAL_POOL_SIZE = 512;
const GLOW_POOL_SIZE = 128;
const PROJECTILE_SPEED = 200; // pixels per second

const SMOKE_INTERVAL = 0.6;       // seconds between chimney smoke puffs
const DUST_INTERVAL = 0.2;        // seconds between dust trail puffs
const CONSTRUCTION_INTERVAL = 0.4;
const SPARKLE_INTERVAL = 0.3;
const WATER_SPARKLE_CHANCE = 0.0008; // per water tile per frame

const SMOKE_BUILDINGS = new Set([
  'town_hall', 'great_hall', 'blacksmith', 'lumber_mill', 'war_mill',
]);
const TORCH_BUILDINGS = new Set([
  'tower', 'guard_tower', 'town_hall', 'great_hall',
]);

interface Projectile {
  sprite: Sprite;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  elapsed: number;
  duration: number;
  damageType: DamageType;
}

/**
 * Spawns and manages visual particles and projectiles in response to
 * game state changes. Purely cosmetic -- has no effect on simulation.
 */
export class EffectsManager {
  private readonly game: LocalGame;
  private readonly normalPool: ParticlePool;
  private readonly glowPool: ParticlePool;
  readonly effectsContainer: Container;
  readonly glowContainer: Container;

  private textures: Record<TextureKey, Texture> = {} as any;

  // Per-entity state tracking for delta detection
  private prevHealth = new Map<EntityId, number>();
  private prevCooldown = new Map<EntityId, number>();
  private entityScreenPos = new Map<EntityId, Point>();
  private trackedEntities = new Set<EntityId>();

  // Cooldowns for continuous per-entity effects
  private smokeCooldowns = new Map<EntityId, number>();
  private dustCooldowns = new Map<EntityId, number>();
  private constructionCooldowns = new Map<EntityId, number>();
  private sparkleCooldowns = new Map<EntityId, number>();

  // Pre-computed water tile screen positions for ambient sparkle
  private waterPositions: Point[] = [];

  // Active projectiles
  private projectiles: Projectile[] = [];
  private projectileContainer: Container;

  constructor(parentContainer: Container, game: LocalGame, renderer: Renderer) {
    this.game = game;

    this.effectsContainer = new Container();
    this.effectsContainer.label = 'effects';

    this.glowContainer = new Container();
    this.glowContainer.label = 'glow';

    this.projectileContainer = new Container();
    this.projectileContainer.label = 'projectiles';
    this.effectsContainer.addChild(this.projectileContainer);

    this.normalPool = new ParticlePool(this.effectsContainer, NORMAL_POOL_SIZE);
    this.glowPool = new ParticlePool(this.glowContainer, GLOW_POOL_SIZE);

    this.generateTextures(renderer);
    this.cacheWaterPositions();
  }

  private generateTextures(renderer: Renderer): void {
    let g = new Graphics();
    g.circle(0, 0, 2);
    g.fill(0xffffff);
    this.textures.circle2 = renderer.generateTexture(g);

    g = new Graphics();
    g.circle(0, 0, 4);
    g.fill(0xffffff);
    this.textures.circle4 = renderer.generateTexture(g);

    g = new Graphics();
    g.rect(-1, -1, 2, 2);
    g.fill(0xffffff);
    this.textures.square2 = renderer.generateTexture(g);

    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    this.textures.glow16 = Texture.from(canvas);
  }

  private cacheWaterPositions(): void {
    const map = this.game.gameMap;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.getTerrain({ x, y }) === TerrainType.Water) {
          this.waterPositions.push(tileToScreen({ x: x + 0.5, y: y + 0.5 }));
        }
      }
    }
  }

  // ---- Main update (called once per render frame) ----

  update(dt: number): void {
    const world = this.game.world;
    const currentEntities = new Set<EntityId>();

    // Scan all entities with Health for combat/death detection
    const healthEntities = world.query(Health.type, Position.type);
    for (const eid of healthEntities) {
      currentEntities.add(eid);
      const pos = world.getComponent(eid, Position)!;
      const screen = tileToScreen({ x: pos.tileX, y: pos.tileY });
      const health = world.getComponent(eid, Health)!;
      const combat = world.getComponent(eid, Combat);

      // Detect health decrease → hit sparks
      const prev = this.prevHealth.get(eid);
      if (prev !== undefined && health.current < prev) {
        this.spawnBurst(Configs.MELEE_HIT_SPARK, screen.x, screen.y);
      }

      // Detect attack firing (cooldown jumps up) → projectile for ranged
      if (combat && combat.targetEntity !== null) {
        const prevCd = this.prevCooldown.get(eid);
        if (prevCd !== undefined && prevCd <= 1 && combat.cooldownRemaining === combat.attackCooldown) {
          if (combat.damageType === 'ranged' || combat.damageType === 'siege') {
            const targetPos = world.getComponent(combat.targetEntity, Position);
            if (targetPos) {
              const targetScreen = tileToScreen({ x: targetPos.tileX, y: targetPos.tileY });
              this.spawnProjectile(screen.x, screen.y - 8, targetScreen.x, targetScreen.y - 4, combat.damageType);
            }
          }
        }
        this.prevCooldown.set(eid, combat.cooldownRemaining);
      }

      this.prevHealth.set(eid, health.current);
      this.entityScreenPos.set(eid, screen);
    }

    // Detect entity removal → death puff at last known position
    for (const eid of this.trackedEntities) {
      if (!currentEntities.has(eid)) {
        const lastPos = this.entityScreenPos.get(eid);
        if (lastPos) {
          this.spawnBurst(Configs.DEATH_PUFF, lastPos.x, lastPos.y);
          this.spawnBurst(Configs.DEATH_FLASH, lastPos.x, lastPos.y);
        }
        this.prevHealth.delete(eid);
        this.prevCooldown.delete(eid);
        this.entityScreenPos.delete(eid);
        this.smokeCooldowns.delete(eid);
        this.dustCooldowns.delete(eid);
        this.constructionCooldowns.delete(eid);
        this.sparkleCooldowns.delete(eid);
      }
    }
    this.trackedEntities = currentEntities;

    this.updateBuildingEffects(dt);
    this.updateUnitEffects(dt);
    this.updateWaterSparkle();
    this.updateProjectiles(dt);
    this.updateParticles(dt);
  }

  // ---- Building effects: smoke, torch glow, construction dust ----

  private updateBuildingEffects(dt: number): void {
    const world = this.game.world;
    const buildings = world.query(Building.type, Position.type, Owner.type);

    for (const eid of buildings) {
      const building = world.getComponent(eid, Building)!;
      const pos = world.getComponent(eid, Position)!;
      const screen = tileToScreen({ x: pos.tileX, y: pos.tileY });

      if (!building.isComplete) {
        const cd = (this.constructionCooldowns.get(eid) ?? 0) - dt;
        if (cd <= 0) {
          this.spawnBurst(Configs.CONSTRUCTION_DUST, screen.x, screen.y - 4);
          this.constructionCooldowns.set(eid, CONSTRUCTION_INTERVAL);
        } else {
          this.constructionCooldowns.set(eid, cd);
        }
        continue;
      }

      if (SMOKE_BUILDINGS.has(building.kind)) {
        const cd = (this.smokeCooldowns.get(eid) ?? 0) - dt;
        if (cd <= 0) {
          this.spawnBurst(Configs.CHIMNEY_SMOKE, screen.x + 6, screen.y - 20);
          this.smokeCooldowns.set(eid, SMOKE_INTERVAL);
        } else {
          this.smokeCooldowns.set(eid, cd);
        }
      }

      if (TORCH_BUILDINGS.has(building.kind)) {
        const cd = (this.sparkleCooldowns.get(eid) ?? 0) - dt;
        if (cd <= 0) {
          this.spawnBurst(Configs.TORCH_GLOW, screen.x - 5, screen.y - 16);
          this.sparkleCooldowns.set(eid, 0.25);
        } else {
          this.sparkleCooldowns.set(eid, cd);
        }
      }
    }
  }

  // ---- Unit effects: dust trails, gathering sparkle ----

  private updateUnitEffects(dt: number): void {
    const world = this.game.world;
    const units = world.query(Position.type, UnitBehavior.type);

    for (const eid of units) {
      const behavior = world.getComponent(eid, UnitBehavior)!;
      const pos = world.getComponent(eid, Position)!;
      const mov = world.getComponent(eid, Movement);

      if (mov?.isMoving) {
        const cd = (this.dustCooldowns.get(eid) ?? 0) - dt;
        if (cd <= 0) {
          const screen = tileToScreen({ x: pos.tileX, y: pos.tileY });
          this.spawnBurst(Configs.DUST_TRAIL, screen.x, screen.y + 2);
          this.dustCooldowns.set(eid, DUST_INTERVAL);
        } else {
          this.dustCooldowns.set(eid, cd);
        }
      }

      if (behavior.state === 'gathering') {
        const carrier = world.getComponent(eid, ResourceCarrier);
        if (carrier?.carryingType === 'gold') {
          const cd = (this.sparkleCooldowns.get(eid) ?? 0) - dt;
          if (cd <= 0) {
            const screen = tileToScreen({ x: pos.tileX, y: pos.tileY });
            this.spawnBurst(Configs.GOLD_SPARKLE, screen.x, screen.y - 6);
            this.sparkleCooldowns.set(eid, SPARKLE_INTERVAL);
          } else {
            this.sparkleCooldowns.set(eid, cd);
          }
        }
      }
    }
  }

  // ---- Water sparkle ----

  private updateWaterSparkle(): void {
    const fog = this.game.fog;
    for (const pos of this.waterPositions) {
      if (Math.random() > WATER_SPARKLE_CHANCE) continue;
      if (fog) {
        const tx = Math.floor((pos.x / 32 + pos.y / 16) / 2);
        const ty = Math.floor((pos.y / 16 - pos.x / 32) / 2);
        if (!fog.isExplored(tx, ty)) continue;
      }
      this.spawnBurst(Configs.WATER_SPARKLE, pos.x, pos.y);
    }
  }

  // ---- Projectiles ----

  private spawnProjectile(sx: number, sy: number, ex: number, ey: number, damageType: DamageType): void {
    const dx = ex - sx;
    const dy = ey - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const sprite = new Sprite(this.textures.square2);
    sprite.anchor.set(0.5);
    sprite.scale.set(1.5, 0.8);
    sprite.tint = damageType === 'siege' ? 0x8b6914 : 0xcccccc;
    sprite.rotation = Math.atan2(dy, dx);
    sprite.x = sx;
    sprite.y = sy;
    this.projectileContainer.addChild(sprite);

    this.projectiles.push({
      sprite, startX: sx, startY: sy, endX: ex, endY: ey,
      elapsed: 0,
      duration: dist / PROJECTILE_SPEED,
      damageType,
    });
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.elapsed += dt;
      const t = Math.min(1, p.elapsed / p.duration);

      p.sprite.x = p.startX + (p.endX - p.startX) * t;
      p.sprite.y = p.startY + (p.endY - p.startY) * t;

      if (t >= 1) {
        this.spawnBurst(Configs.RANGED_HIT_SPARK, p.endX, p.endY);
        this.projectileContainer.removeChild(p.sprite);
        p.sprite.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  // ---- Order feedback markers ----

  /**
   * Spawn a visual marker at a world position to confirm or reject an order.
   * Called from InputManager after issuing commands.
   */
  spawnOrderMarker(wx: number, wy: number, kind: 'move' | 'attack' | 'patrol' | 'gather' | 'reject'): void {
    switch (kind) {
      case 'move':
      case 'patrol':
        this.spawnRing(Configs.ORDER_MOVE_RING, wx, wy);
        this.spawnBurst(Configs.ORDER_MOVE_CENTER, wx, wy);
        break;
      case 'attack':
        this.spawnRing(Configs.ORDER_ATTACK_RING, wx, wy);
        this.spawnBurst(Configs.ORDER_ATTACK_CENTER, wx, wy);
        break;
      case 'gather':
        this.spawnRing(Configs.ORDER_GATHER_RING, wx, wy);
        break;
      case 'reject':
        this.spawnBurst(Configs.ORDER_REJECT, wx, wy);
        break;
    }
  }

  /**
   * Spawn particles in an evenly-spaced ring pattern (for order markers).
   */
  private spawnRing(config: EmitterConfig, wx: number, wy: number): void {
    const pool = config.additive ? this.glowPool : this.normalPool;
    const count = config.count[1];
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const p = pool.acquire();
      if (!p) break;

      const angle = angleStep * i;
      const speed = lerp(config.speed[0], config.speed[1], Math.random());
      const life = lerp(config.lifetime[0], config.lifetime[1], Math.random());

      p.x = wx;
      p.y = wy;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.gravity = config.gravity;
      p.life = life;
      p.maxLife = life;
      p.alphaStart = config.alphaStart;
      p.alphaEnd = config.alphaEnd;
      p.scaleStart = config.scaleStart;
      p.scaleEnd = config.scaleEnd;

      p.sprite.texture = this.textures[config.textureKey];
      p.sprite.tint = config.tint;
      p.sprite.blendMode = config.additive ? 'add' : 'normal';
      p.sprite.x = wx;
      p.sprite.y = wy;
      p.sprite.alpha = config.alphaStart;
      p.sprite.scale.set(config.scaleStart);
    }
  }

  // ---- Particle spawning & physics ----

  spawnBurst(config: EmitterConfig, wx: number, wy: number): void {
    const pool = config.additive ? this.glowPool : this.normalPool;
    const count = randInt(config.count[0], config.count[1]);

    for (let i = 0; i < count; i++) {
      const p = pool.acquire();
      if (!p) break;

      const angle = lerp(config.angle[0], config.angle[1], Math.random());
      const speed = lerp(config.speed[0], config.speed[1], Math.random());
      const life = lerp(config.lifetime[0], config.lifetime[1], Math.random());

      p.x = wx;
      p.y = wy;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.gravity = config.gravity;
      p.life = life;
      p.maxLife = life;
      p.alphaStart = config.alphaStart;
      p.alphaEnd = config.alphaEnd;
      p.scaleStart = config.scaleStart;
      p.scaleEnd = config.scaleEnd;

      p.sprite.texture = this.textures[config.textureKey];
      p.sprite.tint = config.tint;
      if (config.additive) {
        p.sprite.blendMode = 'add';
      } else {
        p.sprite.blendMode = 'normal';
      }
      p.sprite.x = wx;
      p.sprite.y = wy;
      p.sprite.alpha = config.alphaStart;
      p.sprite.scale.set(config.scaleStart);
    }
  }

  private updateParticles(dt: number): void {
    const step = (pool: ParticlePool) => {
      pool.forEachActive((p) => {
        p.life -= dt;
        if (p.life <= 0) {
          pool.release(p);
          return;
        }

        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const t = 1 - p.life / p.maxLife; // 0→1 over lifetime
        p.sprite.x = p.x;
        p.sprite.y = p.y;
        p.sprite.alpha = lerp(p.alphaStart, p.alphaEnd, t);
        p.sprite.scale.set(lerp(p.scaleStart, p.scaleEnd, t));
      });
    };

    step(this.normalPool);
    step(this.glowPool);
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
