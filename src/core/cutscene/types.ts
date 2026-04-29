/**
 * Runtime types for cutscene data.
 *
 * These mirror the output of devtools/packer/processors/godot-scene.ts --
 * any change to the parser output format should be reflected here.
 */

export interface CutsceneData {
  /** Scene nodes keyed by their Godot node name */
  nodes: Record<string, CutsceneNode>;
  /** Named animations, keyed by animation name (RESET is excluded) */
  animations: Record<string, CutsceneAnimation>;
}

export interface CutsceneNode {
  /** Godot node type: "Sprite2D", "Label", "ColorRect", "CPUParticles2D", "AnimationPlayer", etc. */
  type: string;
  /** Resolved PixiJS frame name (e.g. "rat-boat#0") or animation name ("captain") — Sprite2D only */
  pixiTexture?: string;
  /** Static text content — Label only */
  text?: string;
  /** Font size in pixels from LabelSettings — Label only */
  fontSize?: number;
  /** Width of the label rect in pixels (offset_right − offset_left) — Label only */
  width?: number;
  /** Height of the label rect in pixels (offset_bottom − offset_top) — Label only */
  height?: number;
  /**
   * Fill color (Godot Color, normalized 0–1 per channel) — ColorRect only.
   * Maps to a Graphics rect drawn in this color; animated via modulate/modulate:a tracks.
   */
  color?: { r: number; g: number; b: number; a: number };
  /**
   * Rect dimensions in pixels — ColorRect only.
   * Static at creation time; size animation is not supported.
   */
  size?: { x: number; y: number };
  /**
   * Default burst count — CPUParticles2D only.
   * Used when an "emitting: true" keyframe fires and no explicit count is provided.
   */
  amount?: number;
}

export interface CutsceneAnimation {
  /** Total duration in seconds */
  length: number;
  tracks: CutsceneTrack[];
  /** Sound effects triggered at specific times during this animation */
  audioCues: CutsceneAudioCue[];
}

export interface CutsceneAudioCue {
  /** Asset manifest alias (e.g. "sounds/Cat Meow B.wav") */
  sound: string;
  /** Trigger time in seconds */
  time: number;
}

export interface CutsceneTrack {
  /** Godot node name this track drives */
  node: string;
  /** Godot property name: "position", "rotation", "modulate:a", etc. */
  property: string;
  interpolation: 'nearest' | 'linear' | 'cubic';
  keyframes: CutsceneKeyframe[];
}

export interface CutsceneKeyframe {
  /** Time in seconds */
  time: number;
  /**
   * Parsed value from Godot:
   *  - Vector2 → { x: number, y: number }
   *  - Color   → { r: number, g: number, b: number, a: number }
   *  - number, boolean
   */
  value: unknown;
  /** Godot easing curve value (1 = linear) */
  transition: number;
}
