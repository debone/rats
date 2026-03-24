import { MIN_HEIGHT, MIN_WIDTH, TEXT_STYLE_DEFAULT } from '@/consts';
import { execute } from '@/core/game/Command';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { getRunState } from '@/data/game-state';
import { CREW_DEFS, CrewMemberInstance, type CrewMemberDef } from '@/entities/crew/Crew';
import { LevelSelectedCommand } from '@/systems/app/commands/LevelSelectedCommand';
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

  selectCrewMember(crewMember: CrewMemberDef) {
    const crewMemberInstance = new CrewMemberInstance(
      crewMember.type,
      `crew-${crewMember.type}-${Math.random().toString(36).substring(2, 6)}`,
    );
    getRunState().firstMember.set(crewMemberInstance);
    execute(LevelSelectedCommand, { levelId: 'level-1' });
  }

  async prepare() {
    const navigation = getGameContext().navigation;
    navigation.addToLayer(this, LAYER_NAMES.UI);

    <mount target={this}>
      <text text="Pick your first crew member" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 24 }} layout={true} />
      <button
        layout={{ ...buttonLayout, backgroundColor: 0x57294b }}
        onPress={() => this.selectCrewMember(CREW_DEFS.captain)}
      >
        <text text="Captain" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 16 }} layout={true} />
      </button>
      <button
        layout={{ ...buttonLayout, backgroundColor: 0x57294b }}
        onPress={() => this.selectCrewMember(CREW_DEFS.faster)}
      >
        <text text="Faster" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 16 }} layout={true} />
      </button>
    </mount>;

    execute(LevelSelectedCommand, { levelId: 'level-0' });
  }

  gameContainer?: LayoutContainer;

  async show(): Promise<void> {
    // INSERT_YOUR_CODE
    // Fade in the gameContainer when the screen is shown using animejs
    this.alpha = 0;
    await animate(this, { alpha: 1, duration: 250, easing: 'easeOutQuad' });
  }

  resize(_w: number, _h: number) {
    // TODO: Implement resize
  }

  reset() {
    console.log('[MapScreen] Resetting...');
    this.children.forEach((child) => child.destroy());
  }
}
