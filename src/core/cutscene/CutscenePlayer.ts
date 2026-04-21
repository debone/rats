import { createTimeline } from 'animejs';
import { Assets, Container, Sprite, Text, Texture } from 'pixi.js';

import { sfx } from '@/core/audio/audio';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import type { CutsceneAnimation, CutsceneData, CutsceneNode } from './types';

export interface CutscenePlayOptions<TNodes> {
  /**
   * Every node in the merged map is parented here before `onSetup` and before
   * the animation runs. Pixi reparents automatically if a node was already elsewhere.
   *
   * Typical pattern: a `Container` you’ve already added to a layer, or the screen root.
   */
  parent?: Container;
  /**
   * Called after optional `parent` reparenting, before the animation starts.
   * Use when you need more than parenting (e.g. per-layer placement, one-off tweaks).
   */
  onSetup?: (nodes: TNodes) => void;
}

/**
 * Drives animejs animations on PixiJS containers using pre-loaded CutsceneData.
 *
 * Type parameters lock in the node and animation names for a specific cutscene:
 *
 *   import type { CutsceneNodeMap, CutsceneAnimationMap } from '@/assets/cutscenes';
 *   const player = new CutscenePlayer<CutsceneNodeMap['rat-cat'], CutsceneAnimationMap['rat-cat']>(data);
 *
 * Nodes present in the map passed to play() are animated directly.
 * Nodes absent from the map are created (Sprite2D → Sprite, Label → Text).
 *
 * Pass `parent` to attach all nodes under one container without writing `onSetup`.
 *
 * Two overloads of play():
 *   cleanup: true  (default) → returns void.   Player-created nodes destroyed after play.
 *   cleanup: false           → returns TNodes.  All nodes survive for the caller to reuse.
 */
export class CutscenePlayer<
  TNodes extends Record<string, Container> = Record<string, Container>,
  TAnimation extends string = string,
> {
  constructor(private data: CutsceneData) {}

  // Overload: cleanup:true (default) — fire and forget
  play(
    animationName: TAnimation,
    nodes?: Partial<TNodes>,
    options?: CutscenePlayOptions<TNodes> & { cleanup?: true },
  ): Promise<void>;

  // Overload: cleanup:false — returns the full node map for reuse
  play(
    animationName: TAnimation,
    nodes?: Partial<TNodes>,
    options?: CutscenePlayOptions<TNodes> & { cleanup: false },
  ): Promise<TNodes>;

  // Implementation
  async play(
    animationName: TAnimation,
    nodes: Partial<TNodes> = {} as Partial<TNodes>,
    options: CutscenePlayOptions<TNodes> & { cleanup?: boolean } = {},
  ): Promise<TNodes | void> {
    const { cleanup = true, parent, onSetup } = options;

    const animation = this.data.animations[animationName as string];
    if (!animation) {
      throw new Error(`[CutscenePlayer] Animation "${animationName}" not found`);
    }

    // Build missing nodes from the cutscene definition
    const created = new Set<string>();
    const allNodes = { ...(nodes as Record<string, Container>) };

    for (const [name, nodeDef] of Object.entries(this.data.nodes)) {
      if (allNodes[name]) continue;
      const node = buildSpriteNode(name, nodeDef);
      if (node) {
        allNodes[name] = node;
        created.add(name);
      }
    }

    if (parent) {
      for (const node of Object.values(allNodes)) parent.addChild(node);
    }

    onSetup?.(allNodes as TNodes);

    applyInitialState(animation, allNodes);
    await runAnimation(animation, allNodes);

    if (cleanup) {
      for (const name of created) allNodes[name]?.destroy();
      return;
    }

    return allNodes as TNodes;
  }
}

// ---------------------------------------------------------------------------
// Node creation
// ---------------------------------------------------------------------------

function buildSpriteNode(name: string, nodeDef: CutsceneNode): Container | null {
  if (nodeDef.type === 'Sprite2D') {
    const texture = resolveTexture(nodeDef.pixiTexture);
    const sprite = new Sprite({ texture, label: name });
    sprite.anchor.set(0.5); // Godot Sprite2D.position is the center
    return sprite;
  }

  if (nodeDef.type === 'Label') {
    return new Text({
      text: nodeDef.text ?? '',
      style: {
        ...TEXT_STYLE_DEFAULT,
        fontSize: nodeDef.fontSize ?? TEXT_STYLE_DEFAULT.fontSize,
        ...(nodeDef.width !== undefined ? { wordWrap: true, wordWrapWidth: nodeDef.width } : {}),
      },
      label: name,
    });
    // Text anchor defaults to (0,0) — top-left, matching Godot Label position semantics
  }

  return null;
}

function resolveTexture(pixiTexture: string | undefined): Texture {
  if (!pixiTexture) return Texture.EMPTY;
  try {
    return Assets.get<Texture>(pixiTexture) ?? Texture.from(pixiTexture);
  } catch {
    console.warn(`[CutscenePlayer] Texture not found in cache: "${pixiTexture}"`);
    return Texture.EMPTY;
  }
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

function applyInitialState(animation: CutsceneAnimation, nodes: Record<string, Container>): void {
  for (const track of animation.tracks) {
    const first = track.keyframes[0];
    if (!first) continue;
    const node = nodes[track.node];
    if (!node) continue;
    const { animTarget, props } = buildAnimProps(node, track.property, first.value);
    if (!animTarget) continue;
    for (const [key, val] of Object.entries(props)) {
      (animTarget as Record<string, unknown>)[key] = val;
    }
  }
}

async function runAnimation(animation: CutsceneAnimation, nodes: Record<string, Container>): Promise<void> {
  const tl = createTimeline();

  for (const track of animation.tracks) {
    const node = nodes[track.node];
    if (!node) continue;

    for (let i = 0; i < track.keyframes.length - 1; i++) {
      const from = track.keyframes[i];
      const to = track.keyframes[i + 1];
      const { animTarget, props } = buildAnimProps(node, track.property, to.value);
      if (!animTarget) continue;

      tl.add(
        animTarget,
        { ...props, duration: (to.time - from.time) * 1000, ease: buildEasing(track.interpolation, from.transition) },
        from.time * 1000,
      );
    }
  }

  for (const cue of animation.audioCues) {
    tl.call(() => sfx.play(cue.sound), cue.time * 1000);
  }

  await tl;
}

// ---------------------------------------------------------------------------
// Property mapping
// ---------------------------------------------------------------------------

interface AnimProps {
  animTarget: object | null;
  props: Record<string, unknown>;
}

function isGodotColor(v: unknown): v is { r: number; g: number; b: number; a: number } {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.r === 'number' &&
    typeof o.g === 'number' &&
    typeof o.b === 'number' &&
    typeof o.a === 'number'
  );
}

/** Godot CanvasItem.modulate (linear 0–1) → Pixi tint (0xRRGGBB) + alpha. */
function godotColorToPixiModulate(c: { r: number; g: number; b: number; a: number }): { tint: number; alpha: number } {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const r = Math.round(clamp01(c.r) * 255);
  const g = Math.round(clamp01(c.g) * 255);
  const b = Math.round(clamp01(c.b) * 255);
  return {
    tint: (r << 16) | (g << 8) | b,
    alpha: clamp01(c.a),
  };
}

/**
 * Map a Godot property + value to the animejs target object and property keys.
 *
 *   position   → container.{x, y}
 *   scale      → container.scale.{x, y}   (ObservablePoint)
 *   rotation   → container.rotation       (radians)
 *   modulate   → container.{ tint, alpha }  (Godot Color → Pixi multiply tint + opacity)
 *   modulate:a → container.alpha
 *   visible    → container.visible
 *   z_index    → container.zIndex
 */
function buildAnimProps(node: Container, property: string, value: unknown): AnimProps {
  const v2 = value as { x: number; y: number } | null;

  switch (property) {
    case 'position':  return { animTarget: node, props: { x: v2?.x ?? 0, y: v2?.y ?? 0 } };
    case 'scale':     return { animTarget: node.scale, props: { x: v2?.x ?? 1, y: v2?.y ?? 1 } };
    case 'rotation':  return { animTarget: node, props: { rotation: Number(value) || 0 } };
    case 'modulate': {
      if (!isGodotColor(value)) return { animTarget: null, props: {} };
      return { animTarget: node, props: godotColorToPixiModulate(value) };
    }
    case 'modulate:a':return { animTarget: node, props: { alpha: value as number } };
    case 'visible':   return { animTarget: node, props: { visible: value as boolean } };
    case 'z_index':   return { animTarget: node, props: { zIndex: value as number } };
    default:          return { animTarget: node, props: { [property]: value } };
  }
}

/**
 * Build an animejs easing from a Godot interpolation mode + per-keyframe transition value.
 *
 * The `transition` is Godot's ease curve exponent (stored in the `transitions` array):
 *   c = 1        → linear
 *   c > 1        → ease in  (pow(t, c) — the higher, the more aggressive)
 *   0 < c < 1    → ease out (1 - pow(1-t, 1/c))
 *   c < 0        → ease in/out using |c| as the exponent
 */
function buildEasing(
  interp: 'nearest' | 'linear' | 'cubic',
  transition: number,
): string | ((t: number) => number) {
  if (interp === 'nearest') return 'steps(1)';
  if (transition === 1) return interp === 'cubic' ? 'inOutCubic' : 'linear';
  return (t: number) => godotEase(t, transition);
}

/** Godot's ease() function — matches the AnimationPlayer's curve exactly. */
function godotEase(t: number, c: number): number {
  if (c === 0) return 0;
  if (c > 0) {
    return c < 1
      ? 1 - Math.pow(1 - t, 1 / c)   // ease out
      : Math.pow(t, c);               // ease in
  }
  // c < 0 → ease in/out
  const e = -c;
  return t < 0.5
    ? Math.pow(t * 2, e) * 0.5
    : (1 - Math.pow((1 - t) * 2, e)) * 0.5 + 0.5;
}
