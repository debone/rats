import { app } from '@/main';

/**
 * "Hover a track row → outline its actor on the canvas" (G1). The rows read as
 * `actor.property`, which means nothing without seeing which on-screen object the
 * actor *is*; this draws a CSS box over the canvas at the actor's screen bounds.
 *
 * Best-effort and fully guarded: actors that aren't display objects (`camera`,
 * `physics`) or any failure to read bounds just hide the box. The box maps pixi's
 * renderer-space bounds to CSS px via the canvas's on-screen rect vs the
 * renderer's logical size.
 */
let box: HTMLElement | null = null;

function ensureBox(): HTMLElement {
  if (box) return box;
  box = document.createElement('div');
  box.setAttribute('data-vfx-timeline-highlight', '');
  box.style.cssText =
    'position:fixed;pointer-events:none;z-index:99999;border:2px solid #4ad0ff;' +
    'border-radius:2px;box-shadow:0 0 0 9999px rgba(0,0,0,0.18);display:none;';
  document.body.appendChild(box);
  return box;
}

interface BoundsLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Outline `actor` on the canvas if it's a display object with readable bounds. */
export function showActorHighlight(actor: unknown): void {
  const b = ensureBox();
  const obj = actor as { getBounds?: () => BoundsLike } | null;
  const canvas = app?.canvas as HTMLCanvasElement | undefined;
  const renderer = app?.renderer as { width?: number; height?: number } | undefined;
  if (!obj || typeof obj.getBounds !== 'function' || !canvas || !renderer) {
    b.style.display = 'none';
    return;
  }
  try {
    const bounds = obj.getBounds();
    const rect = canvas.getBoundingClientRect();
    const rw = renderer.width || rect.width || 1;
    const rh = renderer.height || rect.height || 1;
    const sx = rect.width / rw;
    const sy = rect.height / rh;
    if (!(bounds.width > 0) || !(bounds.height > 0)) {
      b.style.display = 'none';
      return;
    }
    b.style.display = 'block';
    b.style.left = `${rect.left + bounds.x * sx}px`;
    b.style.top = `${rect.top + bounds.y * sy}px`;
    b.style.width = `${Math.max(2, bounds.width * sx)}px`;
    b.style.height = `${Math.max(2, bounds.height * sy)}px`;
  } catch {
    b.style.display = 'none';
  }
}

export function hideActorHighlight(): void {
  if (box) box.style.display = 'none';
}

/** Remove the box entirely (editor teardown). */
export function disposeActorHighlight(): void {
  box?.remove();
  box = null;
}
