import { ASSETS, type Levels_level_1Textures } from '@/assets';
import { MIN_HEIGHT, MIN_WIDTH, TEXT_STYLE_DEFAULT, TEXT_STYLE_TITLE } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import { navigation } from '@/core/window/navigation';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { EntityCollisionSystem } from '@/systems/physics/EntityCollisionSystem';
import { Assets, Container, Texture, TilingSprite } from 'pixi.js';

export class RatsList extends Container implements AppScreen {
  static readonly SCREEN_ID = 'rats-list-screen';
  static readonly assetBundles = ['default'];

  prepare(): void {
    navigation.addToLayer(this, LAYER_NAMES.OVERLAY);

    const tilingSprite = new TilingSprite({
      texture: typedAssets.get<Levels_level_1Textures>(ASSETS.levels_level_1).textures['level-1_spritesheet_2#0'],
      width: 32,
      height: 32,
    });

    function Rat({
      name,
      active,
      ability,
      texture,
    }: {
      name: string;
      active: string;
      ability: string;
      texture: Texture;
    }) {
      return (
        <vBoxContainer layout={{ width: '31%', height: 'auto' }}>
          <sprite texture={texture} layout={{ objectFit: `contain`, width: `100%`, height: 36 }} />
          <text text={name} style={{ ...TEXT_STYLE_DEFAULT, align: 'center', fontWeight: 'bold' }} />
          <text text={active} style={{ ...TEXT_STYLE_DEFAULT, align: 'center' }} />
          <text text={ability} style={{ ...TEXT_STYLE_DEFAULT, align: 'center', fill: 0x33ee8b }} />
        </vBoxContainer>
      );
    }

    // 10: Balls stick everywhere
    // Ball attractor/control

    // now add these to the rats entities
    // probably make tickets
    // and then start implementing each skill

    const rats: [number, string, string, string][] = [
      [6, 'Nuggets', 'Next ability use is free', 'Slower boat'],
      [7, 'Apprentice', 'Shoots new ball', 'Slower balls'],
      [8, 'Neon', 'Explode balls', 'Faster boat'],
      [9, 'Lacfree', 'Next 5 bricks have cheese', 'Abilities consume rubbles'],
      [3, 'The two ears', 'Destroy random brick', 'Boat can shoot'],
      [4, 'Ratfather', 'Ghost balls (2s)', 'Bricks give more cheese'],
      [5, 'Splitter', 'Double balls', '+2 cheese storage'],
      [10, 'Mysz', 'Recall balls', 'Balls stick to boat'],
      [11, 'Flub', 'Haste balls', 'Balls are attracted to boat'],
      [12, 'Meedas', 'Rubbles become cheese', 'Balls float'],
      [13, 'Panterat', 'Strengthen balls', 'Abilities cost 1 less'],
      [15, 'Little Mi', 'Everything floats (15s)', 'Longer boat'],
      [14, 'Mr. Blu ', 'Next cheese is blue', 'Cheese floats'],
      [16, 'Micesive', 'Next 5 bricks have 5 rubbles', 'Cheese gives +1 ball'],
      [17, 'Ratoulie', 'Drop all cheese', 'Abilities consume balls'],
      [18, 'Pi Rat', 'Adds ball', 'Boat is immobilized'],
      [19, "Yer' Ares Cap", 'Transforms 1 ball into 1 cheese', 'Balls cause 2 damage'],
      [2, 'Aura', 'Doubles all balls', 'Cheese can break bricks'],
    ];

    <mount target={this}>
      <centerContainer>
        <panelContainer layout={{ width: MIN_WIDTH, height: MIN_HEIGHT }} background={tilingSprite}>
          <panelContainer layout={{ height: 16 }} />
          <hBoxContainer>
            <text text="Active" style={TEXT_STYLE_TITLE} />
            <text text="and" style={{ ...TEXT_STYLE_TITLE, fill: 0xaaaaaa }} />
            <text text="passive" style={{ ...TEXT_STYLE_TITLE, fill: 0x33ee8b }} />
            <text text=" abilities" style={{ ...TEXT_STYLE_TITLE, fill: 0xaaaaaa }} />
          </hBoxContainer>
          <panelContainer layout={{ height: 16 }} />
          <hFlowContainer separation={10}>
            {rats.map(([index, name, active, ability]) => (
              <Rat
                name={name}
                active={active}
                ability={ability}
                texture={Assets.get(ASSETS.prototype).textures[`avatars-new_tile_${index}#0`]}
              />
            ))}
          </hFlowContainer>
        </panelContainer>
      </centerContainer>
    </mount>;
  }
}
