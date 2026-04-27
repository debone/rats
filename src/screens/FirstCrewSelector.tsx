import { MIN_HEIGHT, MIN_WIDTH, TEXT_STYLE_DEFAULT } from '@/consts';
import { execute } from '@/core/game/Command';
import { KeyboardNav } from '@/core/ui/KeyboardNav';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { onboardCrewMember } from '@/data/game-state';
import { type CrewMemberDefKey } from '@/entities/crew/Crew';
import { LevelSelectedCommand } from '@/systems/app/commands/LevelSelectedCommand';
import { LayoutContainer } from '@pixi/layout/components';
import { animate } from 'animejs';
import { DropShadowFilter } from 'pixi-filters';
import { Container, Ticker } from 'pixi.js';
import { buttonLayout } from './CrewPickerOverlay/styles';

export class FirstCrewSelector extends Container implements AppScreen {
  static readonly SCREEN_ID = 'first-crew-selector';
  static readonly assetBundles = ['default'];

  private _nav = new KeyboardNav({ direction: 'vertical', wrap: false });

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
    execute(LevelSelectedCommand, { levelId: 'level-1' });
  }

  async prepare() {
    const navigation = getGameContext().navigation;
    navigation.addToLayer(this, LAYER_NAMES.UI);

    let nuggetsBtnRef: LayoutContainer | undefined;
    let apprenticeBtnRef: LayoutContainer | undefined;

    <mount target={this}>
      <text text="Pick your first crew member" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 24 }} layout={true} />
      <button
        layout={{ ...buttonLayout, backgroundColor: 0x57294b }}
        onPress={() => this.selectCrewMember('nuggets')}
        ref={(el) => (nuggetsBtnRef = el)}
      >
        <text text="Nuggets" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 16 }} layout={true} />
      </button>
      <button
        layout={{ ...buttonLayout, backgroundColor: 0x57294b }}
        onPress={() => this.selectCrewMember('apprentice')}
        ref={(el) => (apprenticeBtnRef = el)}
      >
        <text text="Apprentice" style={{ ...TEXT_STYLE_DEFAULT, fontSize: 16 }} layout={true} />
      </button>
    </mount>;

    const focusGlow = new DropShadowFilter({ color: 0xffffff, blur: 8, alpha: 0.5, offset: { x: 0, y: 0 } });
    this._nav.add({
      onFocus: () => { nuggetsBtnRef!.filters = [focusGlow]; },
      onBlur:  () => { nuggetsBtnRef!.filters = []; },
      onPress: () => this.selectCrewMember('nuggets'),
    });
    this._nav.add({
      onFocus: () => { apprenticeBtnRef!.filters = [focusGlow]; },
      onBlur:  () => { apprenticeBtnRef!.filters = []; },
      onPress: () => this.selectCrewMember('apprentice'),
    });

    execute(LevelSelectedCommand, { levelId: 'level-3' });
  }

  gameContainer?: LayoutContainer;

  async show(): Promise<void> {
    this.alpha = 0;
    await animate(this, { alpha: 1, duration: 250, ease: 'outQuad' });
    this._nav.enable();
  }

  update(_time: Ticker) {
    this._nav.update();
  }

  resize(_w: number, _h: number) {
    // TODO: Implement resize
  }

  reset() {
    this._nav.reset();
    this.children.forEach((child) => child.destroy());
  }
}
