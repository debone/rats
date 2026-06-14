import { MIN_HEIGHT, MIN_WIDTH, TEXT_STYLE_DEFAULT } from '@/consts';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { onboardCrewMember } from '@/data/game-state';
import { type CrewMemberDefKey } from '@/entities/crew/Crew';
import { LayoutContainer } from '@pixi/layout/components';
import { animate } from 'animejs';
import { Container } from 'pixi.js';
import { buttonLayout } from './CrewPickerOverlay/styles';

export class FirstCrewSelector extends Container implements AppScreen {
  static readonly SCREEN_ID = 'first-crew-selector';
  static readonly assetBundles = ['default'];

  constructor() {
    super({
      layout: {
        width: MIN_WIDTH,
        height: MIN_HEIGHT,
        justifyContent: 'center',
        backgroundColor: 'black',
        alignItems: 'center',
        flexDirection: 'column',
        padding: 20,
        gap: 20,
      },
    });
  }

  selectCrewMember(crewMember: CrewMemberDefKey) {
    onboardCrewMember(crewMember);
    getGameContext().events.emit(GameEvent.START_NEW_RUN);
  }

  async prepare() {
    const navigation = getGameContext().navigation;
    navigation.addToLayer(this, LAYER_NAMES.UI);

    <mount target={this}>
      <text text="Pick your first crew member" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 24 }} layout={true} />
      <button layout={{ ...buttonLayout, backgroundColor: 0x57294b }} onPress={() => this.selectCrewMember('nuggets')}>
        <text text="Nuggets" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 16 }} layout={true} />
      </button>
      <button
        layout={{ ...buttonLayout, backgroundColor: 0x57294b }}
        onPress={() => this.selectCrewMember('apprentice')}
      >
        <text text="Apprentice" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 16 }} layout={true} />
      </button>
    </mount>;

    // Screens are now children of scenes, we talk events
    // execute(LevelSelectedCommand, { levelId: 'level-1' });
    getGameContext().events.emit(GameEvent.START_NEW_RUN);
  }

  gameContainer?: LayoutContainer;

  async show(): Promise<void> {
    this.alpha = 0;
    await animate(this, { alpha: 1, duration: 250, ease: 'outQuad' });
  }

  resize(_w: number, _h: number) {
    // TODO: Implement resize
  }

  reset() {
    console.log('[MapScreen] Resetting...');
    this.children.forEach((child) => child.destroy());
  }
}
