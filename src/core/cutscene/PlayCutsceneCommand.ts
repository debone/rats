import { Assets, Container } from 'pixi.js';
import { Command } from '@/core/game/Command';
import type { Coroutine } from '@/core/game/Coroutine';
import { CutscenePlayer } from './CutscenePlayer';
import type { CutsceneData } from './types';
interface PlayCutscenePayload {
  /**
   * Cutscene filename without extension, e.g. "rat-cat".
   * The JSON must be loaded before this command runs — add it to an asset bundle
   * or call Assets.load('cutscenes/rat-cat.json') in your screen's show/prepare.
   */
  name: string;
  /** Animation to play. Defaults to the first animation found. */
  animation?: string;
  /** Layer to render sprites on. Defaults to 'overlay'. */
  layer?: 'overlay' | 'ui' | 'effects';
}
/**
 * Self-contained, fire-and-forget cutscene.
 * Creates all needed sprites, adds them to a layer, plays the animation,
 * then destroys everything on completion.
 *
 * For cutscenes where you need to persist or reuse objects, use CutscenePlayer directly.
 *
 * @example
 * yield* execute(PlayCutsceneCommand, { name: 'rat-cat' });
 * yield* execute(PlayCutsceneCommand, { name: 'rat-cat', animation: 'intro', layer: 'overlay' });
 */
export class PlayCutsceneCommand extends Command<PlayCutscenePayload> {
  *execute({ name, animation, layer = 'overlay' }: PlayCutscenePayload): Coroutine {
    const data: CutsceneData = yield Assets.load(`cutscenes/${name}.json`);
    const animName = animation ?? Object.keys(data.animations)[0];
    if (!animName) {
      console.warn(`[PlayCutsceneCommand] No animations found in "${name}"`);
      return;
    }
    const container = new Container({ label: `cutscene-${name}` });
    this.context.navigation.addToLayer(container, layer);

    const player = new CutscenePlayer(data);
    yield player.play(animName, {}, { parent: container });

    container.destroy();
  }
}
