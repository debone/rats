import { Particle, ParticleContainer, Texture, Ticker } from 'pixi.js';

// ============================================================================
// Types
// ============================================================================

/** A value that can be static, a range, or a function (per-particle) */
export type EmitterOp<T> = T | { min: T; max: T } | ((particle: ParticleData, index: number) => T);

/** A value that can be static or a range (emitter-level, no particle context) */
export type SimpleOp<T> = T | { min: T; max: T };

/** Per-particle runtime data */
export interface ParticleData {
  active: boolean;
  particle: Particle;

  // Lifecycle
  life: number;
  maxLife: number;
  delay: number;

  // Motion
  vx: number;
  vy: number;
  ax: number; // acceleration
  ay: number;
  gravityX: number;
  gravityY: number;

  // Visual interpolation (start → end over lifetime)
  alphaStart: number;
  alphaEnd: number;
  scaleStart: number;
  scaleEnd: number;
  rotationSpeed: number;

  // Tint RGB components for interpolation
  tintStartR: number;
  tintStartG: number;
  tintStartB: number;
  tintEndR: number;
  tintEndG: number;
  tintEndB: number;

  // Optimization flags
  hasTintInterpolation: boolean;
  hasAlphaInterpolation: boolean;
  hasScaleInterpolation: boolean;
}

/** ParticleContainer dynamic properties configuration */
export interface DynamicProperties {
  position?: boolean; // Default: true (almost always needed)
  vertex?: boolean; // For scale changes. Default: auto-detect from scale config
  rotation?: boolean; // For rotation. Default: auto-detect from rotate config
  color?: boolean; // For tint/alpha changes. Default: auto-detect from alpha/tint config
  uvs?: boolean; // For texture animation (spritesheet frames). Default: false
}

/** Emitter configuration */
export interface EmitterConfig {
  texture: Texture;

  // Pool
  maxParticles?: number; // Max particles in pool (default: 100)

  // Emission
  frequency?: SimpleOp<number>; // ms between auto-emits, 0 = manual only (default: 0)
  quantity?: SimpleOp<number>; // Particles per emit (default: 1)
  lifespan?: EmitterOp<number>; // ms (default: 1000)
  delay?: EmitterOp<number>; // ms before particle activates (default: 0)
  emitting?: boolean; // Start emitting immediately (default: false)

  // Position
  x?: EmitterOp<number>;
  y?: EmitterOp<number>;

  // Motion
  speed?: EmitterOp<number>; // Pixels/sec, used with angle
  speedX?: EmitterOp<number>; // Direct velocity
  speedY?: EmitterOp<number>;
  angle?: EmitterOp<number>; // Degrees, direction of speed
  accelerationX?: EmitterOp<number>;
  accelerationY?: EmitterOp<number>;
  gravityX?: EmitterOp<number>; // Per-particle gravity
  gravityY?: EmitterOp<number>;
  maxVelocityX?: number;
  maxVelocityY?: number;

  // Visual
  alpha?: EmitterOp<number> | { start: EmitterOp<number>; end: EmitterOp<number> };
  scale?: EmitterOp<number> | { start: EmitterOp<number>; end: EmitterOp<number> };
  rotate?: EmitterOp<number>; // Degrees/sec rotation speed
  tint?: EmitterOp<number> | { start: EmitterOp<number>; end: EmitterOp<number> };
  anchor?: number | { x: number; y: number }; // Anchor point (default: 0.5 = centered)

  // Callbacks
  onEmit?: (particle: Particle, data: ParticleData) => void;
  onDeath?: (particle: Particle, data: ParticleData) => void;

  // Advanced
  follow?: { x: number; y: number }; // Object to follow
  followOffset?: { x: number; y: number };
  timeScale?: number; // Speed multiplier (default: 1)
  particleBringToTop?: boolean; // New particles on top (default: true), false = behind

  // Ticker (defaults to Ticker.shared)
  ticker?: Ticker;

  /**
   * Override ParticleContainer dynamic properties for GPU optimization.
   * By default, these are auto-detected from your visual config:
   * - vertex: true if scale is configured
   * - rotation: true if rotate is configured
   * - color: true if alpha or tint is configured
   * - uvs: false (enable manually for spritesheet animation)
   * Set to false to disable updates you don't need.
   */
  dynamicProperties?: DynamicProperties;
}

// ============================================================================
// Helpers
// ============================================================================

function resolveOp<T extends number>(op: EmitterOp<T> | undefined, fallback: T, data: ParticleData, index: number): T {
  if (op === undefined) return fallback;
  if (typeof op === 'function') return op(data, index);
  if (typeof op === 'object' && 'min' in op && 'max' in op) {
    return (op.min + Math.random() * (op.max - op.min)) as T;
  }
  return op as T;
}

/** Resolve emitter-level ops (no particle context) */
function resolveSimpleOp<T extends number>(op: SimpleOp<T> | undefined, fallback: T): T {
  if (op === undefined) return fallback;
  if (typeof op === 'object' && 'min' in op && 'max' in op) {
    return (op.min + Math.random() * (op.max - op.min)) as T;
  }
  return op as T;
}

function degToRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Color helpers for tint interpolation
function extractRGB(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

function combineRGB(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

// ============================================================================
// ParticleEmitter
// ============================================================================

export class ParticleEmitter {
  readonly container: ParticleContainer;

  private config: EmitterConfig;
  private pool: ParticleData[] = []; // All allocated particles (grows lazily)
  private freeIndices: number[] = []; // Indices of inactive particles available for reuse
  private activeIndices: number[] = []; // Indices of active particles for fast iteration
  private maxParticles: number;
  private emitTimer = 0;
  private _emitting = false;
  private _destroyed = false;
  private ticker: Ticker;
  private particleBringToTop: boolean;

  // Cached config values to avoid repeated lookups
  private maxVelocityX: number;
  private maxVelocityY: number;
  private anchorX: number;
  private anchorY: number;

  // Defaults
  private readonly defaults = {
    maxParticles: 100,
    frequency: 0,
    quantity: 1,
    lifespan: 1000,
    delay: 0,
    x: 0,
    y: 0,
    speedX: 0,
    speedY: 0,
    accelerationX: 0,
    accelerationY: 0,
    gravityX: 0,
    gravityY: 0,
    maxVelocityX: 10000,
    maxVelocityY: 10000,
    alpha: 1,
    scale: 1,
    rotate: 0,
    tint: 0xffffff,
    timeScale: 1,
  };

  /** Position offset (use for follow or manual positioning) */
  x = 0;
  y = 0;

  timeScale = 1;

  constructor(config: EmitterConfig) {
    this.config = config;
    this.ticker = config.ticker ?? Ticker.shared;

    this.maxParticles = config.maxParticles ?? this.defaults.maxParticles;
    this.timeScale = config.timeScale ?? this.defaults.timeScale;
    this._emitting = config.emitting ?? false;
    this.particleBringToTop = config.particleBringToTop ?? true;

    // Cache velocity limits
    this.maxVelocityX = config.maxVelocityX ?? this.defaults.maxVelocityX;
    this.maxVelocityY = config.maxVelocityY ?? this.defaults.maxVelocityY;

    // Cache anchor (default centered)
    const anchor = config.anchor ?? 0.5;
    if (typeof anchor === 'number') {
      this.anchorX = anchor;
      this.anchorY = anchor;
    } else {
      this.anchorX = anchor.x;
      this.anchorY = anchor.y;
    }

    // Auto-detect dynamic properties from config, allow manual override
    const dp = config.dynamicProperties ?? {};
    const hasScale = config.scale !== undefined;
    const hasRotate = config.rotate !== undefined;
    // const hasAlpha = config.alpha !== undefined;
    // const hasTint = config.tint !== undefined;

    // Create container with optimized dynamic properties
    this.container = new ParticleContainer({
      dynamicProperties: {
        position: dp.position ?? true, // Almost always needed
        vertex: dp.vertex ?? hasScale, // Only if scale changes
        rotation: dp.rotation ?? hasRotate, // Only if rotation changes
        color: dp.color ?? true, // Always on - needed to hide particles on death (alpha=0)
        uvs: dp.uvs ?? false, // For texture animation (manual enable only)
      },
    });

    // Lazy allocation: particles are created on-demand, not upfront
    // pool, freeIndices, and activeIndices start empty

    // Auto-register with ticker
    this.ticker.add(this.update, this);
  }

  /**
   * Allocate a new particle (lazy allocation).
   * Returns the pool index of the new particle, or -1 if at max capacity.
   */
  private allocateParticle(): number {
    if (this.pool.length >= this.maxParticles) {
      return -1; // At capacity
    }

    const particle = new Particle({
      texture: this.config.texture,
      alpha: 0,
      anchorX: this.anchorX,
      anchorY: this.anchorY,
    });
    this.container.addParticle(particle);

    const index = this.pool.length;
    this.pool.push({
      active: false,
      particle,
      life: 0,
      maxLife: 0,
      delay: 0,
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
      gravityX: 0,
      gravityY: 0,
      alphaStart: 1,
      alphaEnd: 1,
      scaleStart: 1,
      scaleEnd: 1,
      rotationSpeed: 0,
      tintStartR: 255,
      tintStartG: 255,
      tintStartB: 255,
      tintEndR: 255,
      tintEndG: 255,
      tintEndB: 255,
      hasTintInterpolation: false,
      hasAlphaInterpolation: false,
      hasScaleInterpolation: false,
    });

    return index;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /** Start continuous emission */
  start(): this {
    this._emitting = true;
    this.emitTimer = 0;
    return this;
  }

  /** Stop continuous emission */
  stop(): this {
    this._emitting = false;
    return this;
  }

  /** Emit particles once at position */
  explode(count?: number, x?: number, y?: number): this {
    const qty = count ?? resolveSimpleOp(this.config.quantity, this.defaults.quantity);
    const emitX = x ?? this.x;
    const emitY = y ?? this.y;

    for (let i = 0; i < qty; i++) {
      this.emitParticle(emitX, emitY, i);
    }

    return this;
  }

  /** Emit a single particle */
  emitParticle(emitX: number, emitY: number, index = 0): Particle | null {
    let poolIndex: number;

    // First, try to reuse a dead particle from the free list
    if (this.freeIndices.length > 0) {
      // Pop from free list (O(1) - much faster than searching)
      poolIndex = this.particleBringToTop
        ? this.freeIndices.pop()! // Higher indices render on top
        : this.freeIndices.shift()!; // Lower indices render behind
    } else {
      // No free particles - allocate a new one (lazy allocation)
      poolIndex = this.allocateParticle();
      if (poolIndex === -1) return null; // At max capacity
    }

    const data = this.pool[poolIndex];

    const cfg = this.config;
    const def = this.defaults;
    const p = data.particle;

    // Position
    const offsetX = resolveOp(cfg.x, def.x, data, index);
    const offsetY = resolveOp(cfg.y, def.y, data, index);
    p.x = emitX + offsetX;
    p.y = emitY + offsetY;

    // Velocity
    if (cfg.speed !== undefined) {
      const speed = resolveOp(cfg.speed, 0, data, index);
      const angle = degToRad(resolveOp(cfg.angle as EmitterOp<number>, 0, data, index));
      data.vx = Math.cos(angle) * speed;
      data.vy = Math.sin(angle) * speed;
    } else {
      data.vx = resolveOp(cfg.speedX, def.speedX, data, index);
      data.vy = resolveOp(cfg.speedY, def.speedY, data, index);
    }

    // Acceleration & Gravity
    data.ax = resolveOp(cfg.accelerationX, def.accelerationX, data, index);
    data.ay = resolveOp(cfg.accelerationY, def.accelerationY, data, index);
    data.gravityX = resolveOp(cfg.gravityX, def.gravityX, data, index);
    data.gravityY = resolveOp(cfg.gravityY, def.gravityY, data, index);

    // Lifecycle
    data.maxLife = resolveOp(cfg.lifespan, def.lifespan, data, index);
    data.life = data.maxLife;
    data.delay = resolveOp(cfg.delay, def.delay, data, index);

    // Visual - Alpha
    const alpha = cfg.alpha;
    if (alpha && typeof alpha === 'object' && 'start' in alpha) {
      data.alphaStart = resolveOp(alpha.start as EmitterOp<number>, def.alpha, data, index);
      data.alphaEnd = resolveOp(alpha.end as EmitterOp<number>, def.alpha, data, index);
    } else {
      data.alphaStart = data.alphaEnd = resolveOp(alpha as EmitterOp<number>, def.alpha, data, index);
    }
    data.hasAlphaInterpolation = data.alphaStart !== data.alphaEnd;

    // Visual - Scale
    const scale = cfg.scale;
    if (scale && typeof scale === 'object' && 'start' in scale) {
      data.scaleStart = resolveOp(scale.start as EmitterOp<number>, def.scale, data, index);
      data.scaleEnd = resolveOp(scale.end as EmitterOp<number>, def.scale, data, index);
    } else {
      data.scaleStart = data.scaleEnd = resolveOp(scale as EmitterOp<number>, def.scale, data, index);
    }
    data.hasScaleInterpolation = data.scaleStart !== data.scaleEnd;

    // Rotation speed
    data.rotationSpeed = degToRad(resolveOp(cfg.rotate, def.rotate, data, index));

    // Visual - Tint
    const tint = cfg.tint;
    if (tint && typeof tint === 'object' && 'start' in tint) {
      const tintStart = resolveOp(tint.start as EmitterOp<number>, def.tint, data, index);
      const tintEnd = resolveOp(tint.end as EmitterOp<number>, def.tint, data, index);
      [data.tintStartR, data.tintStartG, data.tintStartB] = extractRGB(tintStart);
      [data.tintEndR, data.tintEndG, data.tintEndB] = extractRGB(tintEnd);
      data.hasTintInterpolation = tintStart !== tintEnd;
    } else {
      const tintValue = resolveOp(tint as EmitterOp<number>, def.tint, data, index);
      [data.tintStartR, data.tintStartG, data.tintStartB] = extractRGB(tintValue);
      data.tintEndR = data.tintStartR;
      data.tintEndG = data.tintStartG;
      data.tintEndB = data.tintStartB;
      data.hasTintInterpolation = false;
    }

    // Initial visual state
    p.alpha = data.delay > 0 ? 0 : data.alphaStart;
    p.scaleX = p.scaleY = data.scaleStart;
    p.tint = combineRGB(data.tintStartR, data.tintStartG, data.tintStartB);
    p.rotation = 0;

    data.active = true;

    // Track active particle for fast iteration
    this.activeIndices.push(poolIndex);

    cfg.onEmit?.(p, data);

    return p;
  }

  /** Number of currently active particles */
  get activeCount(): number {
    return this.activeIndices.length;
  }

  /** Number of particles allocated (not max capacity - actual memory used) */
  get allocatedCount(): number {
    return this.pool.length;
  }

  /** Maximum particle capacity */
  get capacity(): number {
    return this.maxParticles;
  }

  /** Is the emitter running? */
  get emitting(): boolean {
    return this._emitting;
  }

  set emitting(value: boolean) {
    this._emitting = value;
  }

  /** Kill all active particles immediately */
  killAll(): this {
    const activeIndices = this.activeIndices;
    const freeIndices = this.freeIndices;
    const pool = this.pool;

    for (let i = 0, len = activeIndices.length; i < len; i++) {
      const poolIdx = activeIndices[i];
      const data = pool[poolIdx];
      data.active = false;
      data.particle.alpha = 0;
      // Return to free list for reuse
      freeIndices.push(poolIdx);
    }
    activeIndices.length = 0;
    return this;
  }

  /** Destroy the emitter and remove from ticker */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this.ticker.remove(this.update, this);
    this.container.destroy({ children: true });
    this.pool.length = 0;
    this.activeIndices.length = 0;
    this.freeIndices.length = 0;
  }

  // ==========================================================================
  // Internal
  // ==========================================================================

  private update = (ticker: Ticker): void => {
    const deltaMS = ticker.deltaMS * this.timeScale;
    const dt = deltaMS / 1000;
    const cfg = this.config;
    const def = this.defaults;

    // Follow target
    if (cfg.follow) {
      const offset = cfg.followOffset ?? { x: 0, y: 0 };
      this.x = cfg.follow.x + offset.x;
      this.y = cfg.follow.y + offset.y;
    }

    // Cached velocity limits
    const maxVx = this.maxVelocityX;
    const maxVy = this.maxVelocityY;

    // Continuous emission
    if (this._emitting) {
      const frequency = resolveSimpleOp(cfg.frequency, def.frequency);
      if (frequency > 0) {
        this.emitTimer += deltaMS;
        while (this.emitTimer >= frequency) {
          this.emitTimer -= frequency;
          const quantity = resolveSimpleOp(cfg.quantity, def.quantity);
          for (let i = 0; i < quantity; i++) {
            this.emitParticle(this.x, this.y, i);
          }
        }
      }
    }

    // Update active particles using index array (only iterates active particles)
    const activeIndices = this.activeIndices;
    const freeIndices = this.freeIndices;
    const pool = this.pool;
    const onDeath = cfg.onDeath;
    let writeIdx = 0;

    for (let i = 0, len = activeIndices.length; i < len; i++) {
      const poolIdx = activeIndices[i];
      const data = pool[poolIdx];

      // Handle delay
      if (data.delay > 0) {
        data.delay -= deltaMS;
        if (data.delay > 0) {
          activeIndices[writeIdx++] = poolIdx;
          continue;
        }
        data.particle.alpha = data.alphaStart;
      }

      const p = data.particle;

      // Apply gravity and acceleration
      let vx = data.vx + (data.ax + data.gravityX) * dt;
      let vy = data.vy + (data.ay + data.gravityY) * dt;

      // Clamp velocity (inlined for performance)
      if (vx > maxVx) vx = maxVx;
      else if (vx < -maxVx) vx = -maxVx;
      if (vy > maxVy) vy = maxVy;
      else if (vy < -maxVy) vy = -maxVy;

      data.vx = vx;
      data.vy = vy;

      // Move
      p.x += vx * dt;
      p.y += vy * dt;

      // Rotate
      if (data.rotationSpeed !== 0) {
        p.rotation += data.rotationSpeed * dt;
      }

      // Lifecycle
      data.life -= deltaMS;

      // Death check first to avoid unnecessary interpolation
      if (data.life <= 0) {
        data.active = false;
        p.alpha = 0;
        if (onDeath) onDeath(p, data);
        // Return to free list for reuse
        freeIndices.push(poolIdx);
        continue;
      }

      // Only compute t if we have interpolations to do
      if (data.hasAlphaInterpolation || data.hasScaleInterpolation || data.hasTintInterpolation) {
        const t = data.life / data.maxLife; // 1 = born, 0 = dead

        // Interpolate only what's needed
        if (data.hasAlphaInterpolation) {
          p.alpha = data.alphaEnd + (data.alphaStart - data.alphaEnd) * t;
        }

        if (data.hasScaleInterpolation) {
          const scale = data.scaleEnd + (data.scaleStart - data.scaleEnd) * t;
          p.scaleX = scale;
          p.scaleY = scale;
        }

        if (data.hasTintInterpolation) {
          // Inline color lerp for performance
          const invT = 1 - t;
          const r = (data.tintStartR * t + data.tintEndR * invT) | 0;
          const g = (data.tintStartG * t + data.tintEndG * invT) | 0;
          const b = (data.tintStartB * t + data.tintEndB * invT) | 0;
          p.tint = (r << 16) | (g << 8) | b;
        }
      }

      // Keep this particle in active list
      activeIndices[writeIdx++] = poolIdx;
    }

    // Trim dead particles from end
    activeIndices.length = writeIdx;
  };
}
