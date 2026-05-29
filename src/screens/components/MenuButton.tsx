import { TEXT_STYLE_DEFAULT } from '@/consts';
import type { ButtonEvent } from '@/core/jsx/types';
import type { LayoutStyles } from '@pixi/layout';
import type { LayoutContainer } from '@pixi/layout/components';
import type { Button } from '@pixi/ui';

export function MenuButton({
  label,
  fontSize = 18,
  onPress,
}: {
  label: string;
  fontSize?: number;
  onPress?: ButtonEvent;
}) {
  const bg: Partial<LayoutStyles> = {
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 28,
    paddingRight: 28,
    backgroundColor: 0x1a0d1e,
    borderColor: 0x9944bb,
    borderWidth: 2,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
  };

  const onHover = (btn?: Button) => {
    if (btn?.view) (btn.view as LayoutContainer).background.tint = 0xcc88ff;
  };
  const onOut: ButtonEvent = (btn?: Button) => {
    if (btn?.view) (btn.view as LayoutContainer).background.tint = 0xffffff;
  };

  return (
    <>
      <button layout={bg} onHover={onHover} onOut={onOut} onPress={onPress}>
        <text text={label} style={{ ...TEXT_STYLE_DEFAULT, fontSize }} layout={true} />
      </button>
    </>
  );
}
