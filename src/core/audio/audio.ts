import { Filter, type PlayOptions, Sound, sound } from '@pixi/sound';
import { animate, utils } from 'animejs';
import type { ToneAudioNode } from 'tone';
import * as Tone from 'tone';

/**
 * A class to handle background music within the game.
 * It automatically loops audio and fades between tracks.
 */
class BGM {
  /** The alias so it doesn't swap audio to the same one. */
  public currentAlias?: string;
  /** The current sound instance. */
  public current?: Sound;

  /** A global volume that affects all bgm sounds. */
  private _globalVolume = 0.15;
  /** An instance volume that affects the current sound. */
  private _instanceVolume = 0.15;

  /**
   * Play background music.
   * @param alias - Name of the audio file.
   * @param options - Options to be passed to the sound instance.
   */
  public async play(alias: string, options?: PlayOptions) {
    // Do nothing if the requested music is already being played
    if (this.currentAlias === alias) return;

    // Fade out then stop current music
    if (this.current) {
      const current = this.current;

      utils.remove(current);
      animate(current, { volume: 0, duration: 1 }).then(() => {
        current.stop();
      });
    }

    // Find out the new instance to be played
    this.current = sound.find(alias);

    // Play and fade in the new music
    this.currentAlias = alias;
    this.current.play({ loop: true, ...options });
    this.current.volume = 0;

    /*sound.filtersAll = [
      new ToneFilter(new Tone.Reverb({ decay: 4, wet: 0.4 })),
      new ToneFilter(new Tone.FeedbackDelay('8n', 0.5)),
    ];*/
    //this.current.filters = [new ToneFilter(new Tone.PitchShift(-0.1))];

    // Store the instance volume just in case global volume is changed
    this._instanceVolume = options?.volume ?? 1;

    utils.remove(this.current);
    animate(this.current, {
      volume: this._globalVolume * this._instanceVolume,
      duration: 1,
    });
  }

  /**
   * Set the global volume.
   * @param v - Target volume.
   */
  public setVolume(v: number) {
    this._globalVolume = v;
    if (this.current) this.current.volume = this._globalVolume * this._instanceVolume;
  }

  /**
   * Get the global volume.
   */
  public getVolume() {
    return this._globalVolume;
  }
}

// ============================================================================
// Tone.js Integration
// ============================================================================

let _toneInitialized = false;

/**
 * Initialize Tone.js to share the same AudioContext as Pixi.Sound.
 * Call this before using any ToneFilter effects.
 */
export async function initTone() {
  if (_toneInitialized) return;

  // Share Pixi.Sound's AudioContext with Tone.js
  const audioContext = sound.context.audioContext;
  Tone.setContext(new Tone.Context(audioContext));

  // Resume audio context (required after user interaction)
  Tone.start();
  _toneInitialized = true;
}

/**
 * Wraps any Tone.js effect as a Pixi.Sound Filter.
 * This allows using Tone.js's rich effect library within Pixi.Sound's filter chain.
 *
 * Audio flow: Pixi source -> inputGain -> Tone effect -> outputGain -> Pixi destination
 */
export class ToneFilter<T extends ToneAudioNode> extends Filter {
  /** The underlying Tone.js effect */
  public readonly effect: T;
  /** Entry point GainNode for the filter chain */
  private _inputGain: GainNode;
  /** Exit point GainNode for the filter chain */
  private _outputGain: GainNode;

  constructor(effect: T) {
    const { audioContext } = sound.context;

    // Create Web Audio GainNodes as bridge points
    // These are real AudioNodes that Pixi.Sound can connect to
    const inputGain = audioContext.createGain();
    const outputGain = audioContext.createGain();

    // Wire up: inputGain -> Tone.js effect -> outputGain
    // Use Tone.connect for inputGain -> effect (handles Tone's node wrapping)
    Tone.connect(inputGain, effect);
    // Use effect.connect for effect -> outputGain
    effect.connect(outputGain);

    // Pass to Pixi Filter: destination=input (where audio enters), source=output (where audio exits)
    super(inputGain, outputGain);

    this.effect = effect;
    this._inputGain = inputGain;
    this._outputGain = outputGain;
  }

  public destroy(): void {
    // Disconnect the bridge nodes
    this._inputGain.disconnect();
    this._outputGain.disconnect();
    // Dispose Tone.js effect
    this.effect.dispose();
    super.destroy();
  }
}

/**
 * Phaser effect filter using Tone.js.
 * Creates a sweeping, psychedelic sound by modulating filter frequencies.
 */
export class TonePhaserFilter extends ToneFilter<Tone.Phaser> {
  constructor(frequency = 0.5, octaves = 3, baseFrequency = 350) {
    const phaser = new Tone.Phaser({
      frequency,
      octaves,
      baseFrequency,
    });
    super(phaser);
  }

  /** The speed of the phasing effect in Hz */
  set frequency(value: number) {
    this.effect.frequency.value = value;
  }

  get frequency(): number {
    return this.effect.frequency.value as number;
  }

  /** The number of octaves the effect covers */
  set octaves(value: number) {
    this.effect.octaves = value;
  }

  get octaves(): number {
    return this.effect.octaves;
  }

  /** The base frequency of the filters */
  set baseFrequency(value: number) {
    this.effect.baseFrequency = value;
  }

  get baseFrequency(): number {
    return this.effect.baseFrequency as number;
  }

  /** The wet/dry mix (0-1) */
  set wet(value: number) {
    this.effect.wet.value = value;
  }

  get wet(): number {
    return this.effect.wet.value;
  }
}

// ============================================================================

/**
 * A class to handle sound effects within the game.
 */
class SFX {
  /** A global volume that affects all sfx sounds. */
  private _volume = 0.5;

  /** A map of last played time for each sound effect. */
  private lastPlayed: Map<string, number> = new Map();

  private playSound(alias: string, volume: number, options?: PlayOptions) {
    const now = Date.now();
    const lastPlayed = this.lastPlayed.get(alias) ?? 0;
    if (now - lastPlayed < 16) return;
    this.lastPlayed.set(alias, now);

    sound.play(alias, { ...options, volume });
  }

  /**
   * Play sound effects.
   * @param alias - Name of the audio file.
   * @param options - Options to be passed to the sound instance.
   */
  public play(alias: string, options?: PlayOptions) {
    const volume = this._volume * (options?.volume ?? 1);
    //this.playSound(alias, volume, options);
  }

  public playPitched(alias: string, options?: PlayOptions) {
    const volume = this._volume * (options?.volume ?? 1);
    const randomPitch = Math.random() * 0.6 - 0.2;
    //this.playSound(alias, volume, { ...options, filters: [new ToneFilter(new Tone.PitchShift(randomPitch))] });
  }

  /**
   * Set the global volume.
   * @param v - Target volume.
   */
  public setVolume(v: number) {
    this._volume = v;
  }

  /**
   * Get the global volume.
   */
  public getVolume() {
    return this._volume;
  }
}

/**
 * A object to hold methods that handle certain features on the global sound instance
 */
export const audio = {
  /**
   * Mute the global sound instance.
   * @param value - The audio mute state.
   */
  muted(value: boolean) {
    if (value) sound.muteAll();
    else sound.unmuteAll();
  },
  /** Get the volume of the global sound instance. */
  getMasterVolume() {
    return sound.volumeAll;
  },
  /** Set the volume of the global sound instance.
   * @param v - The target global volume.
   */
  setMasterVolume(v: number) {
    sound.volumeAll = v;
    if (!v) {
      sound.muteAll();
    } else {
      sound.unmuteAll();
    }
  },
};

/**
 * A class to handle background music within the game.
 * It automatically loops audio and fades between tracks.
 */
export const bgm = new BGM();
/**
 * A class to handle sound effects within the game.
 */
export const sfx = new SFX();
