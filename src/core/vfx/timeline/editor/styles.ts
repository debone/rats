/**
 * Injects the timeline editor's stylesheet once, on first use. The game has no
 * CSS pipeline (it's a canvas app), so rather than add a `.css` import we inline
 * a single scoped `<style>` for the dev-only overlay. All selectors are prefixed
 * `vfx-tl-` so nothing leaks onto the page.
 *
 * Layout (v2): a `--vfx-tl-gutter` (label column width) and `--vfx-tl-lane` (time
 * strip width, = duration × pxPerMs) custom property drive a single horizontally-
 * and vertically-scrollable strip. The ruler is a sticky-top row and each label a
 * sticky-left cell inside that one scroll container, so both axes stay in sync for
 * free. The inspector is a fixed footer (never scrolls); the panel height and the
 * gutter are drag-resizable.
 */
let injected = false;

const CSS = `
.vfx-tl-editor {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 100000;
  --vfx-tl-gutter: 170px; --vfx-tl-lane: 800px;
  height: 320px; display: flex; flex-direction: column;
  font: 11px/1.4 ui-monospace, Menlo, Consolas, monospace;
  color: #d8d8e0; background: rgba(18,18,28,0.96);
  border-top: 1px solid #3a3a55; box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
  user-select: none;
}
.vfx-tl-rhandle { height: 5px; cursor: ns-resize; background: transparent; flex: 0 0 auto; }
.vfx-tl-rhandle:hover { background: #4ad0ff55; }

.vfx-tl-toolbar { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid #2a2a40; flex: 0 0 auto; position: relative; }
.vfx-tl-title { font-weight: bold; color: #ffd23f; margin-right: 4px; }
.vfx-tl-spacer { flex: 1; }
.vfx-tl-sep { width: 1px; align-self: stretch; background: #2a2a40; margin: 0 2px; }
.vfx-tl-btn { background: #2a2a40; color: #d8d8e0; border: 1px solid #3a3a55; border-radius: 4px; padding: 3px 8px; cursor: pointer; font: inherit; }
.vfx-tl-btn:hover { background: #3a3a55; }
.vfx-tl-btn.on { background: #2a4a6a; border-color: #4a7aaa; }
.vfx-tl-save { background: #2a5a3a; border-color: #3a7a4a; }
.vfx-tl-save:hover { background: #3a7a4a; }
.vfx-tl-field { display: inline-flex; align-items: center; gap: 4px; color: #9a9ab0; }
.vfx-tl-num { width: 56px; background: #14141e; color: #d8d8e0; border: 1px solid #3a3a55; border-radius: 3px; padding: 2px 4px; font: inherit; }
.vfx-tl-num.wide { width: 72px; }
.vfx-tl-sel { background: #14141e; color: #d8d8e0; border: 1px solid #3a3a55; border-radius: 3px; padding: 2px; font: inherit; }
.vfx-tl-zoom { color: #7a7a95; min-width: 64px; text-align: center; }

.vfx-tl-bodywrap { position: relative; flex: 1 1 auto; min-height: 0; }
.vfx-tl-scroll { position: absolute; inset: 0; overflow: auto; }
.vfx-tl-content { position: relative; width: calc(var(--vfx-tl-gutter) + var(--vfx-tl-lane)); min-height: 100%; }

.vfx-tl-ruler { position: sticky; top: 0; z-index: 8; display: flex; height: 18px; background: rgba(18,18,28,0.98); border-bottom: 1px solid #2a2a40; }
.vfx-tl-corner { position: sticky; left: 0; z-index: 9; width: var(--vfx-tl-gutter); flex: 0 0 var(--vfx-tl-gutter); background: rgba(18,18,28,0.98); border-right: 1px solid #2a2a40; }
.vfx-tl-rulerlane { position: relative; width: var(--vfx-tl-lane); height: 100%; }
.vfx-tl-tick { position: absolute; top: 0; font-size: 9px; color: #7a7a95; padding-top: 3px; border-left: 1px solid #2a2a40; padding-left: 2px; }

.vfx-tl-rows { position: relative; }
.vfx-tl-row { display: flex; align-items: stretch; height: 24px; border-bottom: 1px solid #20202e; }
.vfx-tl-row.muted .vfx-tl-lane { opacity: 0.35; }
.vfx-tl-cuerow { background: rgba(255,210,63,0.04); }
.vfx-tl-label { position: sticky; left: 0; z-index: 7; width: var(--vfx-tl-gutter); flex: 0 0 var(--vfx-tl-gutter); padding: 2px 4px 2px 6px; display: flex; align-items: center; gap: 4px; color: #b8b8c8; background: rgba(18,18,28,0.98); border-right: 1px solid #2a2a40; box-sizing: border-box; overflow: hidden; }
.vfx-tl-labeltext { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; flex: 1; }
.vfx-tl-actor { color: #e8e8f0; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vfx-tl-prop { color: #8a8aa5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vfx-tl-readout { color: #4ad0ff; font-size: 9px; opacity: 0.85; min-width: 30px; text-align: right; }
.vfx-tl-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.1s; flex: 0 0 auto; }
.vfx-tl-row:hover .vfx-tl-actions, .vfx-tl-row.muted .vfx-tl-actions { opacity: 1; }
.vfx-tl-mini { background: #2a2a40; color: #b8b8c8; border: 1px solid #3a3a55; border-radius: 3px; cursor: pointer; font-size: 10px; line-height: 1; padding: 2px 4px; }
.vfx-tl-mini:hover { background: #3a3a55; }
.vfx-tl-mini:disabled { opacity: 0.4; cursor: default; }
.vfx-tl-mini.eye-off { color: #ff3864; }

.vfx-tl-lane { position: relative; width: var(--vfx-tl-lane); flex: 0 0 var(--vfx-tl-lane); }
.vfx-tl-key { position: absolute; top: 50%; width: 9px; height: 9px; background: #4ad0ff; border: 1px solid #14141e; transform: translate(-50%, -50%) rotate(45deg); cursor: ew-resize; }
.vfx-tl-key:hover { background: #ffd23f; }
.vfx-tl-key.sel { background: #ff3864; outline: 1px solid #fff; z-index: 2; }
.vfx-tl-cue { position: absolute; top: 2px; color: #ffd23f; cursor: ew-resize; transform: translateX(-50%); font-size: 12px; }

.vfx-tl-playhead { position: absolute; top: 18px; bottom: 0; width: 1px; background: #ff3864; pointer-events: none; z-index: 6; }
.vfx-tl-playhandle { position: absolute; top: -18px; left: -5px; width: 11px; height: 18px; pointer-events: auto; cursor: ew-resize; }
.vfx-tl-playhandle::after { content: ''; position: absolute; top: 0; left: 1px; border: 5px solid transparent; border-top-color: #ff3864; }

.vfx-tl-gutterresize { position: absolute; top: 0; bottom: 0; left: var(--vfx-tl-gutter); width: 7px; margin-left: -3px; cursor: col-resize; z-index: 7; }
.vfx-tl-gutterresize:hover { background: #4ad0ff55; }

.vfx-tl-footer { flex: 0 0 auto; border-top: 1px solid #2a2a40; background: #16161f; }
.vfx-tl-addtrack { display: flex; align-items: center; gap: 6px; padding: 5px 8px; color: #9a9ab0; border-bottom: 1px solid #20202e; }
.vfx-tl-inspector { display: flex; align-items: center; gap: 10px; padding: 6px 8px; min-height: 16px; }
.vfx-tl-hint { color: #7a7a95; }

.vfx-tl-help { position: absolute; top: 32px; right: 8px; width: 320px; max-height: 60vh; overflow: auto; z-index: 20; background: #14141e; border: 1px solid #3a3a55; border-radius: 6px; padding: 10px 12px; box-shadow: 0 6px 24px rgba(0,0,0,0.6); color: #c8c8d4; }
.vfx-tl-help h4 { margin: 6px 0 3px; color: #ffd23f; font-size: 11px; }
.vfx-tl-help code { color: #4ad0ff; }
.vfx-tl-help a { color: #4ad0ff; }
.vfx-tl-help ul { margin: 2px 0; padding-left: 16px; }
`;

export function ensureEditorStyles(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.setAttribute('data-vfx-timeline-editor-styles', '');
  style.textContent = CSS;
  document.head.appendChild(style);
}
