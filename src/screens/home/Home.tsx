import { ASSETS } from '@/assets';
import type { CutsceneAnimationMap, CutsceneNodeMap } from '@/assets/cutscenes';
import { MIN_HEIGHT, MIN_WIDTH, TEXT_STYLE_DEFAULT } from '@/consts';
import { CutscenePlayer } from '@/core/cutscene/CutscenePlayer';
import type { CutsceneData } from '@/core/cutscene/types';
import { execute } from '@/core/game/Command';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { ShowOverlayCommand } from '@/systems/navigation/commands/ShowOverlayCommand';
import { Assets, Container } from 'pixi.js';
import { RatsList } from './RatsList';

export class HomeScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'home-screen';
  static readonly assetBundles = ['default'];

  prepare(): void {
    const navigation = getGameContext().navigation;
    navigation.addToLayer(this, LAYER_NAMES.UI);

    <mount target={this}>
      <centerContainer>
        <panelContainer layout={{ width: MIN_WIDTH, height: MIN_HEIGHT, borderColor: 0x64748b, borderWidth: 1 }}>
          <scrollContainer>
            <vBoxContainer>
              <text text="Hello" style={TEXT_STYLE_DEFAULT} />
            </vBoxContainer>
          </scrollContainer>
        </panelContainer>
      </centerContainer>
    </mount>;

    execute(ShowOverlayCommand, { overlay: RatsList });
  }

  async show(): Promise<void> {
    const data = Assets.get<CutsceneData>(ASSETS.cutscenes_rat_cat);
    const player = new CutscenePlayer<CutsceneNodeMap['rat-cat'], CutsceneAnimationMap['rat-cat']>(data);
    const holder = new Container({ label: 'home-cutscene' });
    getGameContext().navigation.addToLayer(holder, LAYER_NAMES.UI);
    await player.play(
      'intro',
      {
        Label: (
          <vBoxContainer separation={4}>
            <text text="Hello" style={TEXT_STYLE_DEFAULT} />
            <text text="World" style={TEXT_STYLE_DEFAULT} />
          </vBoxContainer>
        ),
      },
      { parent: holder, cleanup: false },
    );
  }

  hide(): Promise<void> {
    return Promise.resolve();
  }
}
