import { ASSETS } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import { assert } from '@/core/common/assert';
import { CREW_DEFS, getCrewTexture, type CrewMemberDefKey } from '@/entities/crew/Crew';
import { Graphics } from 'pixi.js';

export function RatTag(ratKey: CrewMemberDefKey) {
  const rat = CREW_DEFS[ratKey];

  assert(rat, `Rat ${ratKey} not found`);

  const background = new Graphics();
  background.beginFill(0x272736);
  background.drawRect(0, 0, 10, 10);
  background.endFill();

  return (
    <box
      layout={{
        borderColor: 0x57294b,
        borderWidth: 1,
        borderRadius: 3,
        backgroundColor: 0x272736,
        padding: 5,
        width: 320,
      }}
    >
      <vBoxContainer>
        <hBoxContainer>
          <sprite texture={getCrewTexture(ratKey)} layout={{ height: 48, width: 48 }} />
          <text text={rat.name} style={{ ...TEXT_STYLE_DEFAULT, fontSize: 24 }} />
        </hBoxContainer>
        <vBoxContainer layout={{ height: 90 }}>
          <hBoxContainer>
            <vBoxContainer
              layout={{
                backgroundColor: 0x422445,
                borderColor: 0x57294b,
                borderWidth: 1,
                borderRadius: 3,
                width: 36,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <text text={rat.activeAbility.cost.toString()} style={{ ...TEXT_STYLE_DEFAULT, fontSize: 18 }} />
              <sprite
                texture={typedAssets.get(ASSETS.prototype).textures['cheese_tile_1#0']}
                layout={{ height: 20, width: 20 }}
              />
            </vBoxContainer>
            <vBoxContainer
              layout={{
                backgroundColor: 0x422445,
                borderColor: 0x57294b,
                borderWidth: 1,
                borderRadius: 3,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <text text={rat.activeAbility.name} style={{ ...TEXT_STYLE_DEFAULT, fontSize: 14 }} />
            </vBoxContainer>
          </hBoxContainer>
          <hBoxContainer>
            <vBoxContainer
              layout={{
                borderColor: 0x80366b,
                backgroundColor: 0x57294b,
                borderWidth: 1,
                borderRadius: 3,
                alignItems: 'center',
                justifyContent: 'center',
                height: 40,
              }}
            >
              <text text={`Passive: ${rat.passiveAbility.name}`} style={{ ...TEXT_STYLE_DEFAULT, fontSize: 14 }} />
            </vBoxContainer>
          </hBoxContainer>
        </vBoxContainer>
      </vBoxContainer>
    </box>
  );
}
