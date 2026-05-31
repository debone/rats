/**
 * Injects the timeline editor's stylesheet once, on first use. The game has no
 * CSS pipeline (it's a canvas app), so rather than add a `.css` import we inline
 * a single scoped `<style>` for the dev-only overlay. All selectors are prefixed
 * `vfx-tl-` so nothing leaks onto the page.
 */
let injected = false;

const CSS = `
.vfx-tl-editor {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 100000;
  height: 320px; display: flex; flex-direction: column;
  font: 11px/1.4 ui-monospace, Menlo, Consolas, monospace;
  color: #d8d8e0; background: rgba(18,18,28,0.96);
  border-top: 1px solid #3a3a55; box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
  user-select: none;
}
.vfx-tl-toolbar { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid #2a2a40; }
.vfx-tl-title { font-weight: bold; color: #ffd23f; margin-right: 8px; }
.vfx-tl-spacer { flex: 1; }
.vfx-tl-btn {
  background: #2a2a40; color: #d8d8e0; border: 1px solid #3a3a55; border-radius: 4px;
  padding: 3px 8px; cursor: pointer; font: inherit;
}
.vfx-tl-btn:hover { background: #3a3a55; }
.vfx-tl-save { background: #2a5a3a; border-color: #3a7a4a; }
.vfx-tl-save:hover { background: #3a7a4a; }
.vfx-tl-field { display: inline-flex; align-items: center; gap: 4px; color: #9a9ab0; }
.vfx-tl-num { width: 56px; background: #14141e; color: #d8d8e0; border: 1px solid #3a3a55; border-radius: 3px; padding: 2px 4px; font: inherit; }
.vfx-tl-sel { background: #14141e; color: #d8d8e0; border: 1px solid #3a3a55; border-radius: 3px; padding: 2px; font: inherit; }
.vfx-tl-ruler { position: relative; height: 18px; border-bottom: 1px solid #2a2a40; }
.vfx-tl-tick { position: absolute; top: 0; font-size: 9px; color: #7a7a95; transform: translateX(-50%); padding-top: 3px; border-left: 1px solid #2a2a40; padding-left: 2px; }
.vfx-tl-body { flex: 1; overflow-y: auto; position: relative; }
.vfx-tl-grid { position: relative; }
.vfx-tl-row { display: flex; align-items: center; height: 22px; border-bottom: 1px solid #20202e; }
.vfx-tl-cuerow { background: rgba(255,210,63,0.04); }
.vfx-tl-label { width: 150px; flex: 0 0 150px; padding: 0 6px; display: flex; align-items: center; gap: 3px; white-space: nowrap; overflow: hidden; color: #b8b8c8; border-right: 1px solid #2a2a40; height: 100%; box-sizing: border-box; }
.vfx-tl-mini { background: #2a2a40; color: #b8b8c8; border: 1px solid #3a3a55; border-radius: 3px; cursor: pointer; font-size: 9px; line-height: 1; padding: 1px 4px; margin-left: auto; }
.vfx-tl-mini:hover { background: #3a3a55; }
.vfx-tl-lane { position: relative; flex: 1; height: 100%; }
.vfx-tl-key {
  position: absolute; top: 50%; width: 9px; height: 9px;
  background: #4ad0ff; border: 1px solid #14141e;
  transform: translate(-50%, -50%) rotate(45deg); cursor: ew-resize;
}
.vfx-tl-key:hover { background: #ffd23f; }
.vfx-tl-key.sel { background: #ff3864; outline: 1px solid #fff; }
.vfx-tl-cue { position: absolute; top: 1px; color: #ffd23f; cursor: ew-resize; transform: translateX(-50%); font-size: 12px; }
.vfx-tl-playhead { position: absolute; top: 0; bottom: 0; width: 1px; background: #ff3864; pointer-events: none; }
.vfx-tl-playhead::before { content: ''; position: absolute; top: 0; left: -4px; border: 4px solid transparent; border-top-color: #ff3864; pointer-events: auto; }
.vfx-tl-addtrack { display: flex; align-items: center; gap: 6px; padding: 6px 8px; color: #9a9ab0; border-top: 1px solid #2a2a40; }
.vfx-tl-inspector { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-top: 1px solid #2a2a40; background: #16161f; }
.vfx-tl-hint { color: #7a7a95; }
`;

export function ensureEditorStyles(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.setAttribute('data-vfx-timeline-editor-styles', '');
  style.textContent = CSS;
  document.head.appendChild(style);
}
