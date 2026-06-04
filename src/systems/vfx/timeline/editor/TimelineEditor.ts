import type { Key, Track } from '../types';
import { EditorSession } from './EditorSession';
import { GUTTER_MAX, GUTTER_MIN, loadPrefs, PANEL_MIN, ROW_MAX, ROW_MIN, savePrefs } from './editorPrefs';
import { clearDraft, type Draft, draftDiffers, loadDraft, saveDraft } from './draft';
import { disposeActorHighlight, hideActorHighlight, showActorHighlight } from './highlight';
import {
  addCue,
  addKey,
  addTrack,
  deleteCue,
  deleteKey,
  moveCue,
  removeTrack,
  retimeKey,
  setDuration,
  setKeyEase,
  setKeyValue,
} from './ops';
import { chooseTickStep, easeFn, fitScale, snapTime, tickTimes, valueAtTime } from './scale';
import { ensureEditorStyles } from './styles';

/** anime.js eases offered in the per-key dropdown; '' means "no ease" (linear default). */
const EASES = ['', 'linear', 'in', 'out', 'inOut', 'inQuad', 'outQuad', 'inOutQuad', 'outBack', 'inBack', 'outElastic'];

/** Common animatable properties offered when adding a track. */
const PROPERTIES = ['x', 'y', 'alpha', 'rotation', 'tint', 'scale.x', 'scale.y'];

/** Drag snaps to whole frames; hold Alt to disable snapping. */
const SNAP_GRID = 1;
/** Within this many frames a key/cue snaps onto another key/cue while dragging. */
const SNAP_THRESHOLD = 2;
/** Shift multiplies the time-field nudge (1 frame → this many). */
const COARSE_STEP = 10;
/** Speed presets offered as one-click buttons. */
const SPEED_PRESETS = [0.1, 0.5, 1, 2];
/** Zoom (pxPerFrame) limits and step. */
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 200;
const ZOOM_STEP = 1.25;

type El = HTMLElement;

/**
 * Document the `el()` factory creates nodes in. Defaults to the host page, but is
 * pointed at the popup window's document while an editor lives there (single active
 * editor, so a module-level handle is enough).
 */
let uiDoc: Document = document;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<Record<string, string>> = {},
  children: (El | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = uiDoc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

/** Trim a numeric readout to at most 2 decimals; pass strings/null through. */
function fmtValue(v: number | string | null): string {
  if (v == null) return '–';
  if (typeof v === 'string') return v;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = uiDoc.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** A track's numeric value range, for normalizing the lane's value graph; null if none. */
function numericRange(values: (number | string)[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  let any = false;
  for (const v of values) {
    if (typeof v === 'number') {
      any = true;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return any ? { min, max } : null;
}

/** Vertical inset (percent) the value graph occupies in a lane — high value near the top. */
const GRAPH_TOP = 24;
const GRAPH_BOTTOM = 78;

/** Map a value to a lane Y (percent): max → top, min → bottom, flat → middle. */
function valueY(v: number, range: { min: number; max: number }): number {
  const norm = range.max === range.min ? 0.5 : (v - range.min) / (range.max - range.min);
  return GRAPH_BOTTOM - norm * (GRAPH_BOTTOM - GRAPH_TOP);
}

/** Whether a string looks like a hex color (so a tint diamond can wear its value). */
function isHexColor(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}

/** A stable hue per track so adjacent lanes are easy to tell apart. */
function trackHue(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * The DOM timeline editor: an absolutely-positioned HTML/CSS overlay mounted to
 * `document.body` (like the pixi canvas itself), dev-only. It renders the live
 * `EditorSession.doc` and wires every edit through the pure ops → `session.edit`,
 * which recompiles the timeline so tweaks show instantly against the running game.
 *
 * v2 (Phase E): one scroll container holds a sticky ruler + sticky labels, so the
 * time axis is zoomable (`pxPerFrame`) and scrollable; the panel height and label
 * gutter are drag-resizable and persisted; the inspector is a fixed footer that
 * never scrolls. Rendering is split — the persistent shell is built once, and
 * `refresh()` only rebuilds the scroll *contents* (so scroll position holds) and
 * the footer, while a key drag updates just the dragged diamond (no full rebuild).
 */
export class TimelineEditor {
  private readonly root: El;
  // Persistent shell elements (built once).
  private scrollEl!: El;
  private content!: El;
  private rulerLane!: El;
  private rowsEl!: El;
  private playhead!: El;
  private inspectorEl!: El;
  private speedInput!: HTMLInputElement;
  private durationInput!: HTMLInputElement;
  private zoomLabel!: El;
  private timeInput: HTMLInputElement | null = null;
  private helpEl: El | null = null;
  /** Speed preset buttons, highlighted to reflect the live transport speed. */
  private speedButtons: { speed: number; el: HTMLButtonElement }[] = [];
  private saveBtn: HTMLButtonElement | null = null;
  private loopBtn!: HTMLButtonElement;
  private undoBtn!: HTMLButtonElement;
  private redoBtn!: HTMLButtonElement;
  /** Body wrapper, so the restore banner can be inserted above it. */
  private bodywrap!: El;
  /** Debounce timer for autosaving the working doc as a draft. */
  private draftTimer = 0;

  /** Time-axis zoom in px per frame; reset to "fit" after the first layout. */
  private pxPerFrame = 1;
  private gutterW: number;
  private panelH: number;
  /** Vertical (value) zoom: lane row height in px. */
  private rowH: number;
  /** Per-track value readout spans, refreshed as the playhead moves (G1). */
  private readouts = new Map<Track, El>();
  /** Suppress the structural refresh during a drag so the dragged node survives. */
  private dragging = false;
  /** Currently-selected key, for the inspector. */
  private selected: { track: number; key: number } | null = null;

  /** The window/document the UI lives in — a popup when one could be opened, else the host page. */
  private readonly win: Window;
  private readonly doc: Document;
  /** True when hosted in a real popup window (fills it; OS chrome handles move/resize). */
  private readonly popup: boolean;

  constructor(
    private readonly session: EditorSession,
    /** Persist the current doc to disk (Phase D); resolve truthy on success for Save feedback. Absent → no Save button. */
    private readonly onSave?: () => Promise<boolean | void> | void,
    /** Close the editor — resolves the sequence and tears down. Absent → finish() directly. */
    private readonly onClose?: () => void,
    /** Host the editor in this window (a popup); defaults to the host page (docked overlay). */
    targetWindow: Window = window,
  ) {
    this.win = targetWindow;
    this.doc = targetWindow.document;
    this.popup = targetWindow !== window;
    uiDoc = this.doc; // route el() at this document for the lifetime of this editor
    ensureEditorStyles(this.doc);

    const prefs = loadPrefs();
    this.gutterW = prefs.gutterW;
    this.panelH = prefs.panelH;
    this.rowH = prefs.rowH;

    this.root = el('div', {
      class: `vfx-tl-editor${this.popup ? ' vfx-tl-popup' : ''}`,
      'data-vfx-timeline-editor': '',
    });
    this.applyVars();
    this.doc.body.appendChild(this.root);

    this.buildShell();

    session.onChange = () => {
      this.scheduleDraftSave();
      if (!this.dragging) this.refresh();
    };
    session.transport.onProgress = () => this.onProgress();

    this.refresh();
    // Offer to restore an unsaved draft from a previous session (e.g. before a
    // game reload) — never auto-applied, so the on-disk JSON isn't clobbered.
    const draft = loadDraft(session.doc.id);
    if (draft && draftDiffers(draft, session.doc)) this.showRestoreBanner(draft);
    // Fit the duration to the viewport once layout has measured the scroller.
    this.win.requestAnimationFrame(() => this.fitZoom());
    // Editor shortcuts. In a popup these keys go to the popup window, so the game
    // never sees them; capture phase is the best-effort guard for the docked case.
    this.win.addEventListener('keydown', this.onKey, true);
  }

  destroy(): void {
    this.win.removeEventListener('keydown', this.onKey, true);
    if (this.draftTimer) this.win.clearTimeout(this.draftTimer);
    disposeActorHighlight();
    this.root.remove();
    if (uiDoc === this.doc) uiDoc = document; // restore default for any later docked editor
  }

  // ---- shell (built once) ------------------------------------------------

  private applyVars(): void {
    // In a popup the OS window sets the size; docked, we drive the bar height.
    if (!this.popup) this.root.style.height = `${this.panelH}px`;
    this.root.style.setProperty('--vfx-tl-gutter', `${this.gutterW}px`);
    this.root.style.setProperty('--vfx-tl-lane', `${this.laneW()}px`);
    this.root.style.setProperty('--vfx-tl-row', `${this.rowH}px`);
    // Vertical gridline spacing = the ruler tick interval, so lanes line up with it.
    this.root.style.setProperty('--vfx-tl-grid', `${chooseTickStep(this.pxPerFrame) * this.pxPerFrame}px`);
  }

  private buildShell(): void {
    // Top edge: drag to resize panel height (docked only; a popup resizes via OS chrome).
    const rhandle = el('div', { class: 'vfx-tl-rhandle', title: 'Drag to resize panel height' });
    rhandle.onpointerdown = (e) => this.beginResizeHeight(e);

    const toolbar = this.buildToolbar();

    // Body: a single scroll container (sticky ruler + sticky labels) plus the
    // gutter resize handle overlaid at the divider.
    this.rowsEl = el('div', { class: 'vfx-tl-rows' });
    this.rulerLane = el('div', { class: 'vfx-tl-rulerlane' });
    this.rulerLane.onpointerdown = (e) => this.beginScrub(e);

    const ruler = el('div', { class: 'vfx-tl-ruler' }, [el('div', { class: 'vfx-tl-corner' }), this.rulerLane]);

    this.playhead = el('div', { class: 'vfx-tl-playhead' });
    const playHandle = el('div', { class: 'vfx-tl-playhandle', title: 'Drag to scrub' });
    playHandle.onpointerdown = (e) => this.beginScrub(e);
    this.playhead.append(playHandle);

    this.content = el('div', { class: 'vfx-tl-content' }, [ruler, this.rowsEl, this.playhead]);
    this.scrollEl = el('div', { class: 'vfx-tl-scroll' }, [this.content]);
    this.scrollEl.addEventListener('wheel', this.onWheel, { passive: false });
    this.scrollEl.addEventListener('scroll', () => this.positionPlayhead());

    const gutterResize = el('div', { class: 'vfx-tl-gutterresize', title: 'Drag to resize label column' });
    gutterResize.onpointerdown = (e) => this.beginResizeGutter(e);

    const bodywrap = el('div', { class: 'vfx-tl-bodywrap' }, [this.scrollEl, gutterResize]);
    this.bodywrap = bodywrap;

    // Footer: add-track row + the fixed inspector (E3 — out of the scroller).
    this.inspectorEl = el('div', { class: 'vfx-tl-inspector' });
    const footer = el('div', { class: 'vfx-tl-footer' }, [this.buildAddTrack(), this.inspectorEl]);

    // The height handle is meaningless in a popup (the window resizes instead).
    if (this.popup) this.root.append(toolbar, bodywrap, footer);
    else this.root.append(rhandle, toolbar, bodywrap, footer);
  }

  private buildToolbar(): El {
    const t = this.session.transport;

    const play = el('button', { class: 'vfx-tl-btn', title: 'Play / Pause (Space)' }, [t.isPlaying ? '⏸' : '▶']);
    play.onclick = () => (t.isPlaying ? t.pause() : t.play());
    const step1 = el('button', { class: 'vfx-tl-btn', title: 'Step -1 frame' }, ['⏮']);
    step1.onclick = () => t.step(-1);
    const step2 = el('button', { class: 'vfx-tl-btn', title: 'Step +1 frame' }, ['⏭']);
    step2.onclick = () => t.step(+1);
    const restart = el('button', { class: 'vfx-tl-btn', title: 'Restart' }, ['↺']);
    restart.onclick = () => t.restart();
    this.loopBtn = el('button', { class: 'vfx-tl-btn', title: 'Loop playback' }, ['🔁']) as HTMLButtonElement;
    this.loopBtn.onclick = () => {
      t.setLoop(!t.isLooping);
      this.loopBtn.classList.toggle('on', t.isLooping);
      if (t.isLooping && !t.isPlaying) t.play();
    };

    // Undo / redo (history is the doc-snapshot stack in EditorSession).
    this.undoBtn = el('button', { class: 'vfx-tl-btn', title: 'Undo (Ctrl/⌘+Z)' }, ['↶']) as HTMLButtonElement;
    this.undoBtn.onclick = () => this.session.undo();
    this.redoBtn = el('button', { class: 'vfx-tl-btn', title: 'Redo (Ctrl/⌘+Shift+Z)' }, ['↷']) as HTMLButtonElement;
    this.redoBtn.onclick = () => this.session.redo();

    // Speed preset buttons + a fine numeric control.
    this.speedButtons = SPEED_PRESETS.map((speed) => {
      const btn = el('button', { class: 'vfx-tl-btn vfx-tl-speed', title: `Speed ×${speed}` }, [
        `${speed}×`,
      ]) as HTMLButtonElement;
      btn.onclick = () => {
        t.setSpeed(speed);
        this.syncSpeedButtons();
        this.speedInput.value = String(speed);
      };
      return { speed, el: btn };
    });
    this.speedInput = el('input', {
      class: 'vfx-tl-num',
      type: 'number',
      step: '0.05',
      min: '0.05',
      max: '4',
    }) as HTMLInputElement;
    this.speedInput.onchange = () => {
      t.setSpeed(Number(this.speedInput.value) || 1);
      this.syncSpeedButtons();
    };
    this.blurOnEnter(this.speedInput);

    this.durationInput = el('input', { class: 'vfx-tl-num', type: 'number', step: '1', min: '1' }) as HTMLInputElement;
    this.durationInput.onchange = () =>
      this.session.edit((d) => setDuration(d, Number(this.durationInput.value) || d.duration));
    this.blurOnEnter(this.durationInput);

    // Zoom controls (E2).
    const zoomOut = el('button', { class: 'vfx-tl-btn', title: 'Zoom out (Ctrl/⌘ + wheel)' }, ['−']);
    zoomOut.onclick = () => this.zoomBy(1 / ZOOM_STEP);
    const zoomIn = el('button', { class: 'vfx-tl-btn', title: 'Zoom in (Ctrl/⌘ + wheel)' }, ['+']);
    zoomIn.onclick = () => this.zoomBy(ZOOM_STEP);
    const fit = el('button', { class: 'vfx-tl-btn', title: 'Fit timeline to view' }, ['Fit']);
    fit.onclick = () => this.fitZoom();
    this.zoomLabel = el('span', { class: 'vfx-tl-zoom' });

    const help = el('button', { class: 'vfx-tl-btn', title: 'Help' }, ['?']);
    help.onclick = () => this.toggleHelp();

    const right: (El | string)[] = [];
    if (this.onSave) {
      this.saveBtn = el('button', { class: 'vfx-tl-btn vfx-tl-save', title: 'Save to assets/timelines' }, [
        '💾 Save',
      ]) as HTMLButtonElement;
      this.saveBtn.onclick = () => void this.doSave();
      right.push(this.saveBtn);
    }
    const close = el('button', { class: 'vfx-tl-btn', title: 'Close (resolve sequence)' }, ['✕']);
    close.onclick = () => (this.onClose ? this.onClose() : this.session.finish());
    right.push(close);

    return el('div', { class: 'vfx-tl-toolbar' }, [
      el('span', { class: 'vfx-tl-title' }, [`▶ ${this.session.doc.id}`]),
      play,
      step1,
      step2,
      restart,
      this.loopBtn,
      el('span', { class: 'vfx-tl-sep' }),
      this.undoBtn,
      this.redoBtn,
      el('span', { class: 'vfx-tl-sep' }),
      ...this.speedButtons.map((b) => b.el),
      el('label', { class: 'vfx-tl-field' }, ['×', this.speedInput]),
      el('label', { class: 'vfx-tl-field' }, ['dur(f)', this.durationInput]),
      el('span', { class: 'vfx-tl-sep' }),
      zoomOut,
      this.zoomLabel,
      zoomIn,
      fit,
      el('span', { class: 'vfx-tl-spacer' }),
      help,
      el('span', { class: 'vfx-tl-sep' }),
      ...right,
    ]);
  }

  /** Highlight the speed preset matching the live transport speed (if any). */
  private syncSpeedButtons(): void {
    const speed = this.session.transport.speed;
    for (const b of this.speedButtons) b.el.classList.toggle('on', Math.abs(b.speed - speed) < 1e-6);
  }

  /** Run the injected save and flash the button with the outcome (Phase F feedback). */
  private async doSave(): Promise<void> {
    const btn = this.saveBtn;
    if (!btn || !this.onSave) return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '… Saving';
    let ok = true;
    try {
      const result = await this.onSave();
      ok = result !== false;
    } catch {
      ok = false;
    }
    btn.disabled = false;
    btn.textContent = ok ? '✓ Saved' : '✕ Failed';
    btn.classList.toggle('vfx-tl-saveok', ok);
    btn.classList.toggle('vfx-tl-savefail', !ok);
    this.win.setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('vfx-tl-saveok', 'vfx-tl-savefail');
    }, 1400);
    // Saved to disk → the in-memory draft is now redundant.
    if (ok) {
      clearDraft(this.session.doc.id);
      this.removeRestoreBanner();
    }
  }

  // ---- draft autosave / restore ------------------------------------------

  /** Debounced autosave of the working doc to localStorage (crash/reload safety). */
  private scheduleDraftSave(): void {
    if (this.draftTimer) this.win.clearTimeout(this.draftTimer);
    this.draftTimer = this.win.setTimeout(() => {
      this.draftTimer = 0;
      saveDraft(this.session.doc);
    }, 400);
  }

  /** A dismissible bar offering to restore an unsaved draft; never auto-applies. */
  private showRestoreBanner(draft: Draft): void {
    this.removeRestoreBanner();
    const ago = Math.max(0, Math.round((Date.now() - draft.savedAt) / 1000));
    const when = ago < 60 ? `${ago}s ago` : `${Math.round(ago / 60)}m ago`;
    const restore = el('button', { class: 'vfx-tl-btn' }, ['Restore']);
    restore.onclick = () => {
      this.selected = null;
      this.session.replaceDoc(draft.doc);
      this.removeRestoreBanner();
    };
    const discard = el('button', { class: 'vfx-tl-btn' }, ['Discard']);
    discard.onclick = () => {
      clearDraft(this.session.doc.id);
      this.removeRestoreBanner();
    };
    const banner = el('div', { class: 'vfx-tl-banner', 'data-vfx-tl-banner': '' }, [
      el('span', {}, [`⟳ Unsaved draft from ${when} — restore it?`]),
      el('span', { class: 'vfx-tl-spacer' }),
      restore,
      discard,
    ]);
    this.root.insertBefore(banner, this.bodywrap);
  }

  private removeRestoreBanner(): void {
    this.root.querySelector('[data-vfx-tl-banner]')?.remove();
  }

  private buildAddTrack(): El {
    const actorSel = el('select', { class: 'vfx-tl-sel', title: 'Actor (live stage map)' }) as HTMLSelectElement;
    for (const name of this.session.actorNames()) actorSel.append(el('option', { value: name }, [name]));
    const propSel = el('select', { class: 'vfx-tl-sel', title: 'Property to animate' }) as HTMLSelectElement;
    for (const p of PROPERTIES) propSel.append(el('option', { value: p }, [p]));
    const add = el('button', { class: 'vfx-tl-btn', title: 'Add an empty track for actor.property' }, ['+ track']);
    add.onclick = () =>
      this.session.edit((d) => {
        const ti = addTrack(d, actorSel.value, propSel.value);
        this.selected = { track: ti, key: 0 };
      });
    return el('div', { class: 'vfx-tl-addtrack' }, ['Add track:', actorSel, propSel, add]);
  }

  // ---- layout / scale ----------------------------------------------------

  private get duration(): number {
    return this.session.doc.duration;
  }

  private laneW(): number {
    return Math.max(1, this.duration * this.pxPerFrame);
  }

  private timeToX(time: number): number {
    return time * this.pxPerFrame;
  }

  /** Clamp & apply a new zoom, keeping the timeline content laid out. */
  private setZoom(pxPerFrame: number): void {
    this.pxPerFrame = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pxPerFrame));
    this.applyVars();
    this.refresh();
  }

  /** Zoom around the horizontal center of the viewport. */
  private zoomBy(factor: number): void {
    const sRect = this.scrollEl.getBoundingClientRect();
    const centerClientX = sRect.left + (this.gutterW + this.scrollEl.clientWidth) / 2;
    this.zoomAround(this.pxPerFrame * factor, centerClientX);
  }

  /** Zoom so the time under `clientX` stays put (used by wheel + buttons). */
  private zoomAround(pxPerFrame: number, clientX: number): void {
    const sRect = this.scrollEl.getBoundingClientRect();
    const cursorContentX = clientX - sRect.left + this.scrollEl.scrollLeft;
    const timeAtCursor = (cursorContentX - this.gutterW) / this.pxPerFrame;
    this.setZoom(pxPerFrame);
    const newContentX = this.gutterW + timeAtCursor * this.pxPerFrame;
    this.scrollEl.scrollLeft = newContentX - (clientX - sRect.left);
  }

  private fitZoom(): void {
    const viewport = this.scrollEl.clientWidth - this.gutterW;
    this.setZoom(fitScale(viewport, this.duration));
    this.scrollEl.scrollLeft = 0;
  }

  /** Vertical (value) zoom: grow/shrink lane height so curves show finer detail. */
  private zoomRows(factor: number): void {
    this.rowH = Math.max(ROW_MIN, Math.min(ROW_MAX, this.rowH * factor));
    this.root.style.setProperty('--vfx-tl-row', `${this.rowH}px`);
    savePrefs({ rowH: this.rowH });
  }

  private onWheel = (e: WheelEvent): void => {
    const delta = e.deltaY || e.deltaX; // Shift+wheel reports on deltaX on some platforms
    const step = delta < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    if (e.ctrlKey || e.metaKey) {
      // Horizontal (time) zoom around the cursor.
      e.preventDefault();
      this.zoomAround(this.pxPerFrame * step, e.clientX);
    } else if (e.shiftKey || e.clientX - this.scrollEl.getBoundingClientRect().left < this.gutterW) {
      // Vertical (value) zoom: Shift+wheel, or wheel over the track-name gutter.
      e.preventDefault();
      this.zoomRows(step);
    }
    // else: native scroll
  };

  // ---- refresh (structural) ----------------------------------------------

  private refresh(): void {
    this.applyVars();
    this.speedInput.value = String(this.session.transport.speed);
    this.durationInput.value = String(this.duration);
    this.zoomLabel.textContent = `${this.pxPerFrame.toFixed(1)} px/f`;
    this.syncSpeedButtons();
    this.loopBtn.classList.toggle('on', this.session.transport.isLooping);
    this.undoBtn.disabled = !this.session.canUndo;
    this.redoBtn.disabled = !this.session.canRedo;
    this.renderRuler();
    this.renderLanes();
    // Keep an in-progress inspector edit alive: if a field there is focused (e.g.
    // arrow-nudging the time/value), don't rebuild it — the lanes already moved.
    if (!this.inspectorEl.contains(this.doc.activeElement)) this.renderInspector();
    this.positionPlayhead();
  }

  private renderRuler(): void {
    this.rulerLane.replaceChildren();
    for (const time of tickTimes(this.duration, this.pxPerFrame)) {
      const tick = el('span', { class: 'vfx-tl-tick' }, [`${time}`]);
      tick.style.left = `${this.timeToX(time)}px`;
      this.rulerLane.append(tick);
    }
  }

  private renderLanes(): void {
    this.rowsEl.replaceChildren();
    this.readouts.clear();
    const tracks = this.session.doc.tracks;
    for (let ti = 0; ti < tracks.length; ti++) this.rowsEl.append(this.renderTrackRow(ti));
    this.rowsEl.append(this.renderCuesRow());
    this.updateReadouts();
  }

  private renderTrackRow(ti: number): El {
    const track = this.session.doc.tracks[ti];
    const muted = this.session.isMuted(track);
    // A track whose actor isn't in the live stage map (e.g. a restored draft after
    // the sequence's actors changed) won't animate — the compiler skips it. Flag it
    // so it's visibly orphaned rather than mysteriously dead.
    const actorObj = this.session.actor(track.actor);
    const missing = actorObj == null || typeof actorObj !== 'object';

    const range = numericRange(track.keys.map((k) => k.value));

    const readout = el('span', { class: 'vfx-tl-readout' });
    this.readouts.set(track, readout);
    // Per-lane vertical scale: this lane normalizes to its own range, so show its
    // max (top) and min (bottom) flanking the live value, aligned with the band.
    const scaleCol = el('div', { class: 'vfx-tl-scalecol' });
    if (range) {
      scaleCol.append(
        el('span', { class: 'vfx-tl-scaleedge' }, [fmtValue(range.max)]),
        readout,
        el('span', { class: 'vfx-tl-scaleedge' }, [fmtValue(range.min)]),
      );
    } else {
      scaleCol.append(readout);
    }

    const labelText = el('div', { class: 'vfx-tl-labeltext' }, [
      el(
        'span',
        { class: 'vfx-tl-actor', title: missing ? `${track.actor} — not in stage (won't animate)` : track.actor },
        [missing ? `⚠ ${track.actor}` : track.actor],
      ),
      el('span', { class: 'vfx-tl-prop', title: track.property }, [track.property]),
    ]);

    const eye = el(
      'button',
      {
        class: `vfx-tl-mini${muted ? ' eye-off' : ''}`,
        title: muted ? 'Un-mute track' : 'Mute track (isolate others)',
      },
      [muted ? '⊘' : '👁'],
    );
    eye.onclick = () => this.session.toggleMute(track);
    const addK = el('button', { class: 'vfx-tl-mini', title: 'Add key at playhead' }, ['+']);
    addK.onclick = () => {
      const time = this.session.transport.progress * this.duration;
      // Seed with the value the curve actually has at this time (eased
      // interpolation), so inserting a key on a ramp doesn't snap the animation.
      const onCurve = valueAtTime(track, time);
      this.session.edit((d) => {
        const ki = addKey(d, ti, time, onCurve == null ? undefined : onCurve);
        this.selected = { track: ti, key: ki };
      });
    };
    const del = el('button', { class: 'vfx-tl-mini', title: 'Remove track' }, ['🗑']);
    del.onclick = () => this.session.edit((d) => removeTrack(d, ti));

    const label = el('div', { class: 'vfx-tl-label' }, [
      labelText,
      scaleCol,
      el('div', { class: 'vfx-tl-actions' }, [eye, addK, del]),
    ]);
    // Hover the label → outline the actor on the canvas (G1).
    label.onmouseenter = () => showActorHighlight(this.session.actor(track.actor));
    label.onmouseleave = () => hideActorHighlight();

    const lane = el('div', { class: 'vfx-tl-lane' });
    // Value graph: position each numeric key vertically by value (high = top,
    // low = bottom), join them along their easing curves, and fill below — so a
    // track reads at a glance (e.g. alpha's visible vs invisible keys).
    if (range) lane.append(this.renderEnvelope(track.keys, range, trackHue(`${track.actor}.${track.property}`)));
    for (let ki = 0; ki < track.keys.length; ki++) lane.append(this.renderKey(ti, ki, range));

    return el('div', { class: `vfx-tl-row${muted ? ' muted' : ''}${missing ? ' missing' : ''}` }, [label, lane]);
  }

  /**
   * The track's value envelope: a filled area + line through its numeric keys.
   * Ramps follow each key's easing (sampled), the value is held flat out to both
   * lane edges (it extends indefinitely before the first / after the last key), and
   * the area is filled to a floor so each lane reads as a distinct coloured band.
   */
  private renderEnvelope(keys: Key[], range: { min: number; max: number }, hue: number): SVGElement {
    const w = this.laneW();
    const nk = keys
      .filter((k): k is Key & { value: number } => typeof k.value === 'number')
      .sort((a, b) => a.time - b.time);

    const pts: Array<[number, number]> = [];
    if (nk.length > 0) {
      pts.push([0, valueY(nk[0].value, range)]); // held lead-in from the left edge
      pts.push([this.timeToX(nk[0].time), valueY(nk[0].value, range)]);
      const STEPS = 16;
      for (let i = 0; i < nk.length - 1; i++) {
        const a = nk[i];
        const b = nk[i + 1];
        const fn = easeFn(b.ease); // ease enters the later key
        for (let s = 1; s <= STEPS; s++) {
          const p = s / STEPS;
          const v = a.value + (b.value - a.value) * fn(p);
          pts.push([this.timeToX(a.time + (b.time - a.time) * p), valueY(v, range)]);
        }
      }
      pts.push([w, valueY(nk[nk.length - 1].value, range)]); // held tail-out to the right edge
    }

    const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
    const s = svg('svg', { class: 'vfx-tl-env', viewBox: `0 0 ${w} 100`, preserveAspectRatio: 'none' });
    // Faint max/min reference lines (the vertical scale's gridlines for this lane).
    s.append(svg('line', { x1: 0, y1: GRAPH_TOP, x2: w, y2: GRAPH_TOP, class: 'vfx-tl-envaxis' }));
    s.append(svg('line', { x1: 0, y1: GRAPH_BOTTOM, x2: w, y2: GRAPH_BOTTOM, class: 'vfx-tl-envaxis' }));
    const fill = svg('polygon', { points: `${line} ${w},${GRAPH_BOTTOM} 0,${GRAPH_BOTTOM}`, class: 'vfx-tl-envfill' });
    fill.style.fill = `hsl(${hue} 70% 55%)`;
    const stroke = svg('polyline', { points: line, class: 'vfx-tl-envline' });
    stroke.style.stroke = `hsl(${hue} 80% 72%)`;
    s.append(fill, stroke);
    return s;
  }

  private renderKey(ti: number, ki: number, range: { min: number; max: number } | null): El {
    const key = this.session.doc.tracks[ti].keys[ki];
    const isSel = this.selected?.track === ti && this.selected?.key === ki;
    const diamond = el('div', { class: `vfx-tl-key${isSel ? ' sel' : ''}`, title: `f=${key.time}  v=${key.value}` });
    diamond.style.left = `${this.timeToX(key.time)}px`;
    if (typeof key.value === 'number' && range) {
      // Position by value so the diamond's height encodes it.
      diamond.style.top = `${valueY(key.value, range)}%`;
    } else if (typeof key.value === 'string' && isHexColor(key.value)) {
      // Tint key: wear the color so it's recognizable without opening it.
      diamond.classList.add('swatch');
      diamond.style.background = key.value;
    }
    diamond.onpointerdown = (e) => this.beginDragKey(e, ti, ki, diamond);
    return diamond;
  }

  private renderCuesRow(): El {
    const hooks = this.session.hookNames();
    const addC = el('button', { class: 'vfx-tl-mini', title: 'Add cue at playhead' }, ['+']);
    if (hooks.length) {
      addC.onclick = () => {
        const time = this.session.transport.progress * this.duration;
        this.session.edit((d) => addCue(d, hooks[0], time));
      };
    } else {
      addC.disabled = true;
    }
    const label = el('div', { class: 'vfx-tl-label' }, [
      el('div', { class: 'vfx-tl-labeltext' }, [
        el('span', { class: 'vfx-tl-actor' }, ['Cues']),
        el('span', { class: 'vfx-tl-prop' }, ['fire-once']),
      ]),
      el('div', { class: 'vfx-tl-actions' }, [addC]),
    ]);

    const lane = el('div', { class: 'vfx-tl-lane vfx-tl-cuelane' });
    for (let ci = 0; ci < this.session.doc.cues.length; ci++) {
      const cue = this.session.doc.cues[ci];
      const marker = el('div', { class: 'vfx-tl-cue', title: `${cue.hook} @ ${cue.time}ms (double-click to delete)` }, [
        '▼',
      ]);
      marker.style.left = `${this.timeToX(cue.time)}px`;
      marker.onpointerdown = (e) => this.beginDragCue(e, ci, marker);
      marker.ondblclick = () => this.session.edit((d) => deleteCue(d, ci));
      lane.append(marker);
    }
    return el('div', { class: 'vfx-tl-row vfx-tl-cuerow' }, [label, lane]);
  }

  private renderInspector(): void {
    this.inspectorEl.replaceChildren();
    this.timeInput = null;
    if (!this.selected) {
      this.inspectorEl.append(
        el('span', { class: 'vfx-tl-hint' }, [
          'Select a key to edit its time, value & easing — hover a row to find its actor on screen.',
        ]),
      );
      return;
    }
    const { track: ti, key: ki } = this.selected;
    const track = this.session.doc.tracks[ti];
    const key = track?.keys[ki];
    if (!key) {
      this.selected = null;
      this.inspectorEl.append(el('span', { class: 'vfx-tl-hint' }, ['Select a key to edit it.']));
      return;
    }

    // Precise time field, in frames (E5). Arrows nudge ±1 frame; Shift+arrow ±10.
    const timeInput = el('input', {
      class: 'vfx-tl-num',
      type: 'number',
      step: '1',
      min: '0',
      max: String(this.duration),
    }) as HTMLInputElement;
    timeInput.value = String(key.time);
    timeInput.onchange = () => this.commitKeyTime(Number(timeInput.value));
    timeInput.onkeydown = (ev) => {
      if (ev.key === 'Enter') {
        timeInput.blur(); // commit and hand focus back so shortcuts resume
      } else if ((ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && ev.shiftKey) {
        ev.preventDefault();
        const dir = ev.key === 'ArrowUp' ? 1 : -1;
        timeInput.value = String((Number(timeInput.value) || 0) + dir * COARSE_STEP);
        this.commitKeyTime(Number(timeInput.value));
      }
    };
    this.timeInput = timeInput;

    // Value field: number input (step 0.1 — most values are 0..1) or text for tint.
    const isString = typeof key.value === 'string';
    const valInput = el('input', {
      class: 'vfx-tl-num wide',
      type: isString ? 'text' : 'number',
      step: isString ? undefined : '0.1',
    }) as HTMLInputElement;
    valInput.value = String(key.value);
    valInput.onchange = () => {
      const sel = this.selected;
      if (!sel) return;
      const v = isString ? valInput.value : Number(valInput.value);
      this.session.edit((d) => setKeyValue(d, sel.track, sel.key, v));
    };
    this.blurOnEnter(valInput);

    const easeSel = el('select', { class: 'vfx-tl-sel' }) as HTMLSelectElement;
    for (const e of EASES) {
      const opt = el('option', { value: e }, [e || '(none)']) as HTMLOptionElement;
      if ((key.ease ?? '') === e) opt.selected = true;
      easeSel.append(opt);
    }
    easeSel.onchange = () => {
      this.session.edit((d) => setKeyEase(d, ti, ki, easeSel.value || undefined));
      easeSel.blur(); // picking an ease commits — hand focus back for shortcuts
    };

    const del = el('button', { class: 'vfx-tl-btn', title: 'Delete key (Del)' }, ['Delete key']);
    del.onclick = () => {
      this.selected = null;
      this.session.edit((d) => deleteKey(d, ti, ki));
    };

    this.inspectorEl.append(
      el('span', { class: 'vfx-tl-hint' }, [`${track.actor}.${track.property}`]),
      el('label', { class: 'vfx-tl-field' }, ['time(f)', timeInput]),
      el('label', { class: 'vfx-tl-field' }, ['value', valInput]),
      el('label', { class: 'vfx-tl-field' }, ['ease', easeSel]),
      del,
    );
  }

  /** Enter in a field commits it and returns focus to the window so shortcuts resume. */
  private blurOnEnter(input: HTMLElement): void {
    input.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') input.blur();
    });
  }

  /** Retime the selected key (resolved by identity, so re-sorts keep the selection). */
  private commitKeyTime(time: number): void {
    const sel = this.selected;
    if (!sel) return;
    const keyRef = this.session.doc.tracks[sel.track]?.keys[sel.key];
    if (!keyRef) return;
    this.session.edit((d) => {
      const idx0 = d.tracks[sel.track].keys.indexOf(keyRef);
      retimeKey(d, sel.track, idx0, time);
      const idx1 = d.tracks[sel.track].keys.indexOf(keyRef);
      if (idx1 >= 0) this.selected = { track: sel.track, key: idx1 };
    });
  }

  // ---- playhead / readouts (cheap updates) -------------------------------

  private positionPlayhead(): void {
    if (!this.playhead) return;
    const x = this.gutterW + this.timeToX(this.session.transport.progress * this.duration);
    this.playhead.style.left = `${x}px`;
  }

  private onProgress(): void {
    this.positionPlayhead();
    this.updateReadouts();
  }

  private updateReadouts(): void {
    const time = this.session.transport.progress * this.duration;
    for (const [track, span] of this.readouts) span.textContent = fmtValue(valueAtTime(track, time));
  }

  // ---- keyboard ----------------------------------------------------------

  private onKey = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    // Let inputs handle their own keys (incl. native text undo in a field).
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.shiftKey ? this.session.redo() : this.session.undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.session.redo();
    } else if (e.code === 'Space') {
      // stopImmediatePropagation so the game's window keydown listener never fires.
      e.preventDefault();
      e.stopImmediatePropagation();
      const t = this.session.transport;
      t.isPlaying ? t.pause() : t.play();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const { track, key } = this.selected;
      this.selected = null;
      this.session.edit((d) => deleteKey(d, track, key));
    }
  };

  // ---- interactions ------------------------------------------------------

  /** Pointer drag on the ruler / playhead handle → scrub. Measured against the ruler lane. */
  private beginScrub(e: PointerEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      const rect = this.rulerLane.getBoundingClientRect();
      const time = (ev.clientX - rect.left) / this.pxPerFrame;
      this.session.transport.seek(Math.max(0, Math.min(1, this.duration > 0 ? time / this.duration : 0)));
    };
    move(e);
    const up = () => {
      this.win.removeEventListener('pointermove', move);
      this.win.removeEventListener('pointerup', up);
    };
    this.win.addEventListener('pointermove', move);
    this.win.addEventListener('pointerup', up);
  }

  /** Drag a diamond → retime live (snapped, Alt disables); click selects. */
  private beginDragKey(e: PointerEvent, ti: number, ki: number, diamond: El): void {
    e.preventDefault();
    e.stopPropagation();
    this.selected = { track: ti, key: ki };
    this.dragging = true;
    const laneRect = (diamond.parentElement as El).getBoundingClientRect();
    let currentKi = ki;
    const move = (ev: PointerEvent) => {
      const raw = (ev.clientX - laneRect.left) / this.pxPerFrame;
      const time = Math.max(
        0,
        Math.min(
          this.duration,
          ev.altKey
            ? Math.round(raw)
            : snapTime(raw, { grid: SNAP_GRID, targets: this.snapTargets(ti, currentKi), thresholdMs: SNAP_THRESHOLD }),
        ),
      );
      const keyRef = this.session.doc.tracks[ti].keys[currentKi];
      this.session.edit((d) => {
        retimeKey(d, ti, currentKi, time);
        currentKi = d.tracks[ti].keys.indexOf(keyRef);
        this.selected = { track: ti, key: currentKi };
      });
      diamond.style.left = `${this.timeToX(time)}px`;
      if (this.timeInput) this.timeInput.value = String(Math.round(time));
    };
    const up = () => {
      this.win.removeEventListener('pointermove', move);
      this.win.removeEventListener('pointerup', up);
      this.dragging = false;
      this.refresh(); // resync indices / inspector / readouts
    };
    this.win.addEventListener('pointermove', move);
    this.win.addEventListener('pointerup', up);
  }

  /** Drag a cue marker → move live (snapped, Alt disables). */
  private beginDragCue(e: PointerEvent, ci: number, marker: El): void {
    e.preventDefault();
    e.stopPropagation();
    this.dragging = true;
    const laneRect = (marker.parentElement as El).getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const raw = (ev.clientX - laneRect.left) / this.pxPerFrame;
      const time = Math.max(
        0,
        Math.min(
          this.duration,
          ev.altKey
            ? Math.round(raw)
            : snapTime(raw, { grid: SNAP_GRID, targets: this.snapTargets(-1, -1), thresholdMs: SNAP_THRESHOLD }),
        ),
      );
      this.session.edit((d) => moveCue(d, ci, time));
      marker.style.left = `${this.timeToX(time)}px`;
    };
    const up = () => {
      this.win.removeEventListener('pointermove', move);
      this.win.removeEventListener('pointerup', up);
      this.dragging = false;
      this.refresh();
    };
    this.win.addEventListener('pointermove', move);
    this.win.addEventListener('pointerup', up);
  }

  /** Times of other keys (excluding the dragged one) and all cues, for snap-to. */
  private snapTargets(exclTrack: number, exclKey: number): number[] {
    const out: number[] = [];
    const tracks = this.session.doc.tracks;
    for (let ti = 0; ti < tracks.length; ti++) {
      for (let ki = 0; ki < tracks[ti].keys.length; ki++) {
        if (ti === exclTrack && ki === exclKey) continue;
        out.push(tracks[ti].keys[ki].time);
      }
    }
    for (const c of this.session.doc.cues) out.push(c.time);
    return out;
  }

  // ---- resize handles ----------------------------------------------------

  private beginResizeHeight(e: PointerEvent): void {
    e.preventDefault();
    const startY = e.clientY;
    const startH = this.panelH;
    const maxH = Math.min(2000, this.win.innerHeight * 0.9);
    const move = (ev: PointerEvent) => {
      this.panelH = Math.max(PANEL_MIN, Math.min(maxH, startH + (startY - ev.clientY)));
      this.root.style.height = `${this.panelH}px`;
    };
    const up = () => {
      this.win.removeEventListener('pointermove', move);
      this.win.removeEventListener('pointerup', up);
      savePrefs({ panelH: this.panelH });
    };
    this.win.addEventListener('pointermove', move);
    this.win.addEventListener('pointerup', up);
  }

  private beginResizeGutter(e: PointerEvent): void {
    e.preventDefault();
    const startX = e.clientX;
    const startW = this.gutterW;
    const move = (ev: PointerEvent) => {
      this.gutterW = Math.max(GUTTER_MIN, Math.min(GUTTER_MAX, startW + (ev.clientX - startX)));
      this.root.style.setProperty('--vfx-tl-gutter', `${this.gutterW}px`);
      this.positionPlayhead();
    };
    const up = () => {
      this.win.removeEventListener('pointermove', move);
      this.win.removeEventListener('pointerup', up);
      savePrefs({ gutterW: this.gutterW });
    };
    this.win.addEventListener('pointermove', move);
    this.win.addEventListener('pointerup', up);
  }

  // ---- help popover ------------------------------------------------------

  private toggleHelp(): void {
    if (this.helpEl) {
      this.helpEl.remove();
      this.helpEl = null;
      return;
    }
    this.helpEl = el('div', { class: 'vfx-tl-help' });
    this.helpEl.innerHTML = `
      <h4>Timeline editor</h4>
      <p>Times are in <b>frames</b> (60fps reference); playback is the same speed on any display.</p>
      <ul>
        <li><b>Space</b> play/pause · <b>Del</b> delete key · <b>Ctrl/⌘+Z</b> undo · <b>Shift</b> to redo</li>
        <li>Pausing returns to where Play started; <b>🔁</b> loops that span continuously</li>
        <li>Speed presets (0.1–2×) or the <b>×</b> field; <b>Ctrl/⌘ + wheel</b> zooms time, <b>Fit</b> resets</li>
        <li><b>Shift + wheel</b> (or wheel over the track names) zooms the lanes taller for finer value detail</li>
        <li>Drag the ruler/▼ to scrub; drag a ◆ to retime (snaps to frames/other keys; <b>Alt</b> = free)</li>
        <li>Inspector: <b>time</b> nudges ±1 frame (<b>Shift</b> ±${COARSE_STEP}); <b>value</b> nudges ±0.1</li>
        <li>Drag the top edge to grow the panel; drag the label divider to widen it</li>
        <li>Row <b>👁</b> mutes a track to isolate others; <b>+</b> adds a key at the playhead</li>
        <li>Keys sit at their value (high=top, low=bottom); the filled curve follows the easing and holds flat past the ends. Tint keys show their colour</li>
        <li>Vertical gridlines mark the ruler ticks for alignment</li>
        <li>Hover a row label to outline its actor on the canvas</li>
      </ul>
      <h4>Code vs. data</h4>
      <p>Actors (Graphics/Containers) and array/camera tweens stay in <code>build()</code>;
      this editor edits the JSON <b>tracks</b> (keyframes) and <b>cues</b> (fire-once beats).
      Cues are muted while scrubbing and fire only on real Play.</p>
      <p>See <code>docs/timeline-authoring.md</code> to add a track or a brand-new sequence.</p>`;
    this.root.append(this.helpEl);
  }
}
