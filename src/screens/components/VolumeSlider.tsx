import type { SignalValue } from '@/core/reactivity/signals/types';
import { Graphics } from 'pixi.js';

export function VolumeSlider({
  value,
  onUpdate,
  onChange,
}: {
  value: SignalValue<number>;
  onUpdate?: (value: number) => void;
  onChange: (value: number) => void;
}) {
  const width = 240;
  const height = 20;
  const radius = 3;
  const border = 2;
  const borderColor = 0x57294b;
  const backgroundColor = 0x1a1a2e;
  const handleColor = 0xffffff;
  const handleBorder = 10;
  const fillColor = 0x3d3d52;

  const bg = new Graphics()
    .roundRect(0, 0, width, height, radius)
    .fill(borderColor)
    .roundRect(border, border, width - border * 2, height - border * 2, radius)
    .fill(backgroundColor);
  const fill = new Graphics()
    .roundRect(0, 0, width, height, radius)
    .fill(borderColor)
    .roundRect(border, border, width - border * 2, height - border * 2, radius)
    .fill(fillColor);
  const slider = new Graphics()
    .circle(0, 0, 10 + handleBorder / 2)
    .fill(borderColor)
    .circle(0, 0, 10 - handleBorder / 2)
    .fill(handleColor);

  return (
    <slider
      onUpdate={onUpdate}
      onChange={onChange}
      bg={bg}
      fill={fill}
      slider={slider}
      value={value}
      min={0}
      max={1}
      step={0.01}
      layout={{
        width: '100%',
        marginTop: 10,
        height: 30,
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
      }}
    />
  );
}
