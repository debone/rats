/**
 * Mouse coordinate helper for Storybook demos.
 *
 * Demos run inside demoRoot, whose (0,0) maps to screen position
 * (SIDEBAR_W+1, HEADER_H). Raw window mouse events give clientX/Y in CSS
 * pixels relative to the viewport; we need coordinates in demoRoot space.
 *
 * Correct transform:
 *   canvasX = (clientX - canvasBounds.left) * (renderer.width / bounds.width)
 *   demoX   = canvasX - (SIDEBAR_W + 1)
 *
 * This mirrors the constants in StorybookScreen.ts.
 */
import { app } from '@/main';

const SIDEBAR_W = 170;
const HEADER_H  = 22;

export function demoMouse(e: MouseEvent): { x: number; y: number } {
  const b  = app.canvas.getBoundingClientRect();
  const sx = app.renderer.width  / b.width;
  const sy = app.renderer.height / b.height;
  return {
    x: (e.clientX - b.left) * sx - (SIDEBAR_W + 1),
    y: (e.clientY - b.top)  * sy - HEADER_H,
  };
}
