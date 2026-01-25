import { utils, type JSAnimation } from 'animejs';
import { Container } from 'pixi.js';
import type { CameraDebug } from './camera-debug';

/**
 * TODO
 *
 * - trauma shake system
  export interface TraumaShakeOptions {
    // Maximum shake intensity in pixels (default: 10)
    maxOffset?: number;
    // Maximum rotation in radians (default: 0.05)
    maxRotation?: number;
    // How fast trauma decays per second (default: 0.8)
    decayRate?: number;
    // Noise frequency - higher = more jittery (default: 20)
    frequency?: number;
  }

  private trauma = 0;
  
  private traumaOptions: Required<TraumaShakeOptions> = {
    maxOffset: 10,
    maxRotation: 0.05,
    decayRate: 0.8,
    frequency: 20,
  };
 
  private traumaTime = 0;

   * Add trauma to the camera (0-1 range, will be clamped)
   * Multiple calls stack up to a maximum of 1.
   *
   * ```ts
   * // Small hit
   * camera.addTrauma(0.2);
   *
   * // Big explosion
   * camera.addTrauma(0.6);
   *
   * // Multiple rapid hits stack
   * camera.addTrauma(0.15);
   * camera.addTrauma(0.15);
   * camera.addTrauma(0.15); // Total: 0.45
   * ```
  
  public addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }
 
  // Current trauma level (0-1), decays over time 
  private updateTrauma(deltaSeconds: number): void {
    if (this.trauma <= 0) return;
    if (this.detached) return; // Don't shake when detached

    const { maxOffset, maxRotation, decayRate, frequency, layers } = this.traumaOptions;

    // Trauma squared gives a nice falloff curve
    const shake = this.trauma * this.trauma;

    // Use perlin-like noise via sin waves at different frequencies
    this.traumaTime += deltaSeconds * frequency;
    const t = this.traumaTime;

    // Generate pseudo-random offsets using sin waves (in screen pixels)
    const offsetX = maxOffset * shake * (Math.sin(t * 1.1) + Math.sin(t * 2.3) * 0.5);
    const offsetY = maxOffset * shake * (Math.sin(t * 1.7) + Math.sin(t * 2.9) * 0.5);
    const rotationOffset = maxRotation * shake * (Math.sin(t * 1.3) + Math.sin(t * 3.1) * 0.5);

    {{ x: offsetX, y: offsetY, rotation: rotationOffset };

    // Decay trauma
    this.trauma = Math.max(0, this.trauma - decayRate * deltaSeconds);

    if (this.trauma <= 0) {
      // 
    }
  }

  * - detached state (debugging follow options)
 */

/** Easing presets for common camera movements */
export const CameraEasing = {
  /** Smooth in/out - good for pans */
  smooth: 'easeInOutSine',
  /** Quick start, slow end - good for impacts */
  impact: 'easeOutExpo',
  /** Bouncy end - good for landing */
  bounce: 'easeOutBounce',
  /** Linear - good for constant speed */
  linear: 'linear',
  /** Elastic - good for wobbly effects */
  elastic: 'easeOutElastic',
} as const;

export class Camera {
  readonly viewport: Container;
  private activeAnimations: JSAnimation[] = [];

  debug?: CameraDebug;
  // debug only!
  public debugPosition: { x: number; y: number } = { x: 0, y: 0 };
  public debugOffset: { x: number; y: number } = { x: 0, y: 0 };

  private state = {
    x: 0,
    y: 0,
    offsetX: 0,
    offsetY: 0,
    screenOffsetX: 0,
    screenOffsetY: 0,
    scale: 1,
    rotation: 0,
    skewX: 0,
    skewY: 0,
    alpha: 1,
  };

  constructor(
    private screenWidth: number = 0,
    private screenHeight: number = 0,
  ) {
    this.viewport = new Container({ label: '🎥 cameraViewport' });
  }

  resize(width: number, height: number) {
    this.screenWidth = width;
    this.screenHeight = height;

    this.viewport.position.set(this.screenWidth / 2, this.screenHeight / 2);
  }

  /**
   * Track an animation for cleanup
   */
  track(anim: JSAnimation): JSAnimation {
    this.activeAnimations.push(anim);
    return anim;
  }

  update() {
    this.viewport.pivot.set(
      this.state.x + this.state.offsetX + this.state.screenOffsetX,
      this.state.y + this.state.offsetY + this.state.screenOffsetY,
    );
    this.viewport.scale.set(this.state.scale);
    this.viewport.rotation = -this.state.rotation;
    this.viewport.alpha = this.state.alpha;
  }

  /**
   * Reset camera to default state (looking at world origin)
   */
  public async reset(_duration = 300): Promise<void> {
    this.stop();

    // Reset state first
    this.state = {
      x: 0,
      y: 0,
      offsetX: 0,
      offsetY: 0,
      screenOffsetX: 0,
      screenOffsetY: 0,
      scale: 1,
      rotation: 0,
      skewX: 0,
      skewY: 0,
      alpha: 1,
    };

    // FIXME: all looks beautiful below. But if we reset the state above, it will not animate.

    /*
    // Get the container position for world origin
    const containerPos = this.worldToContainer(0, 0);

    // Animate each target's properties separately to avoid animejs issues with PixiJS observables
    const allAnimations: JSAnimation[] = [];

    for (const target of targets) {
      // Main container properties - animate to the converted container position
      allAnimations.push(
        this.track(
          animate(target, {
            x: containerPos.x,
            y: containerPos.y,
            rotation: 0,
            alpha: 1,
            duration,
            easing: CameraEasing.smooth,
          }),
        ),
      );
      // Scale (animate the ObservablePoint directly)
      allAnimations.push(this.track(animate(target.scale, { x: 1, y: 1, duration, easing: CameraEasing.smooth })));
      // Skew
      allAnimations.push(this.track(animate(target.skew, { x: 0, y: 0, duration, easing: CameraEasing.smooth })));
      // Pivot
      allAnimations.push(this.track(animate(target.pivot, { x: 0, y: 0, duration, easing: CameraEasing.smooth })));
    }

    await Promise.all(allAnimations); */
  }

  /**
   * Stop all active camera animations
   */
  public stop(): void {
    for (const anim of this.activeAnimations) {
      utils.remove(anim);
    }
    this.activeAnimations = [];
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setOffset(offsetX: number, offsetY: number) {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  setScale(scale: number) {
    this.scale = scale;
  }

  setRotation(rotation: number) {
    this.rotation = rotation;
  }

  setSkewX(skewX: number) {
    this.skewX = skewX;
  }

  setSkewY(skewY: number) {
    this.skewY = skewY;
  }

  get viewWidth(): number {
    return this.screenWidth;
  }

  get viewHeight(): number {
    return this.screenHeight;
  }

  get position(): { x: number; y: number } {
    return { x: this.state.x, y: this.state.y };
  }

  set x(x: number) {
    this.state.x = x;

    if (import.meta.env.DEV) {
      this.debugPosition.x = x;
    }
  }

  get x() {
    return this.state.x;
  }

  set y(y: number) {
    this.state.y = y;

    if (import.meta.env.DEV) {
      this.debugPosition.y = y;
    }
  }

  get y() {
    return this.state.y;
  }

  set offsetX(offsetX: number) {
    this.state.offsetX = offsetX;

    if (import.meta.env.DEV) {
      this.debugOffset.x = offsetX;
    }
  }

  get offsetX() {
    return this.state.offsetX;
  }

  set offsetY(offsetY: number) {
    this.state.offsetY = offsetY;

    if (import.meta.env.DEV) {
      this.debugOffset.y = offsetY;
    }
  }

  get offsetY() {
    return this.state.offsetY;
  }

  set scale(s: number) {
    this.state.scale = s;
  }

  get scale() {
    return this.state.scale;
  }

  set rotation(r: number) {
    this.state.rotation = r;
  }

  get rotation() {
    return this.state.rotation;
  }

  set skewX(s: number) {
    this.state.skewX = s;
  }

  get skewX() {
    return this.state.skewX;
  }

  set skewY(s: number) {
    this.state.skewY = s;
  }

  get skewY() {
    return this.state.skewY;
  }

  set alpha(a: number) {
    this.state.alpha = a;
  }

  get alpha() {
    return this.state.alpha;
  }
}
