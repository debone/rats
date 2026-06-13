import { describe, expect, it } from 'vitest';
import { collectStandaloneTextureEntries } from './godot-resources';

describe('collectStandaloneTextureEntries', () => {
  it('indexes standalone images under the textures/ alias as Texture2D entries', () => {
    const manifest = {
      bundles: [
        {
          assets: [
            { alias: ['textures/water'], src: ['textures/water.png', 'textures/water@0.5x.png'] },
            { alias: ['textures/foam'], src: ['textures/foam.webp', 'textures/foam.png'] },
          ],
        },
      ],
    };
    const entries = collectStandaloneTextureEntries(manifest);

    expect(entries['textures/water.png']).toMatchObject({
      godotPath: 'res://textures/water.png',
      type: 'Texture2D',
      pixiFrame: 'textures/water',
    });
    // Prefers the full-res (no @Nx) PNG as the copy source.
    expect((entries['textures/water.png'] as { _src?: string })._src).toBe('textures/water.png');
    // Falls back to any PNG when no un-suffixed one exists.
    expect((entries['textures/foam.png'] as { _src?: string })._src).toBe('textures/foam.png');
  });

  it('ignores atlases (json sidecar) and non-textures/ aliases', () => {
    const manifest = {
      bundles: [
        {
          assets: [
            { alias: ['textures/sheet'], src: ['textures/sheet.png', 'textures/sheet.png.json'] },
            { alias: ['ui/background'], src: ['ui/background.png'] },
          ],
        },
      ],
    };
    const entries = collectStandaloneTextureEntries(manifest);
    expect(Object.keys(entries)).toHaveLength(0);
  });

  it('handles scalar alias/src shapes', () => {
    const manifest = {
      bundles: [{ assets: [{ alias: 'textures/rim', src: 'textures/rim.png' }] }],
    };
    const entries = collectStandaloneTextureEntries(manifest);
    expect(entries['textures/rim.png']?.pixiFrame).toBe('textures/rim');
  });
});
