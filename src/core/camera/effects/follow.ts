import { app } from '@/main';
import type { Camera } from '../camera';

export interface FollowOptions {
  /** How quickly camera catches up (0-1, default: 0.1) */
  lerp?: number;
  /** Offset from the target position */
  offset?: { x: number; y: number };
  /** Dead zone - camera won't move if target is within this radius */
  deadZone?: number;
  /** Bounds to clamp camera position within */
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
}

/** Target that can be followed by the camera */
export interface FollowTarget {
  x: number;
  y: number;
}

export interface FollowResult {
  stop: () => void;
}

const clampX = (minX: number, maxX: number, value: number) => Math.max(minX, Math.min(maxX, value));
const clampY = (minY: number, maxY: number, value: number) => Math.max(minY, Math.min(maxY, value));

/**
 * Start following a target
 *
 * @example
 * ```ts
 * // Follow the player with default smoothing
 * camera.follow(player);
 *
 * // Follow with offset (look-ahead)
 * camera.follow(player, { offset: { x: 50, y: 0 }, lerp: 0.05 });
 *
 * // Follow with bounds (world coordinates - where camera can look)
 * // Example: Camera can look at world positions from (0,0) to (levelWidth, levelHeight)
 * camera.follow(player, {
 *   bounds: { minX: 0, maxX: levelWidth, minY: 0, maxY: levelHeight }
 * });
 * ```
 */
export function follow(camera: Camera, target: FollowTarget, options: FollowOptions = {}): FollowResult {
  const followTarget = target;
  const followOptions = {
    lerp: options.lerp ?? 0.1,
    offset: options.offset ?? { x: 0, y: 0 },
    deadZone: options.deadZone ?? 0,
    bounds: options.bounds ?? { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity },
  };

  const boundMinX = followOptions.bounds.minX;
  const boundMaxX = followOptions.bounds.maxX;
  const boundMinY = followOptions.bounds.minY;
  const boundMaxY = followOptions.bounds.maxY;

  const updateFollow = (): void => {
    // if (this.detached) return; // Don't follow when detached
    // if (this.manualOverride) return; // Don't follow when manually controlling

    // Target position in WORLD coordinates (where we want to look)
    const targetX = followTarget.x + followOptions.offset.x;
    const targetY = followTarget.y + followOptions.offset.y;

    // Check dead zone
    const dx = targetX - camera.x;
    const dy = targetY - camera.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= followOptions.deadZone) {
      return; // Within dead zone, don't move
    }

    // Lerp toward target
    const lerp = followOptions.lerp;
    const newX = camera.x + dx * lerp;
    const newY = camera.y + dy * lerp;

    // Clamp to bounds (bounds are in WORLD coordinates)
    camera.x = clampX(boundMinX, boundMaxX, newX);
    camera.y = clampY(boundMinY, boundMaxY, newY);
  };

  app.ticker.add(updateFollow);

  return {
    stop: () => {
      app.ticker.remove(updateFollow);
    },
  };
}
