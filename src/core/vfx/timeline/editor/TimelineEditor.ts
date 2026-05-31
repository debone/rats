import type { Track } from '../types';
import type { EditorSession } from './EditorSession';
import { GUTTER_MAX, GUTTER_MIN, loadPrefs, PANEL_MIN, savePrefs } from './editorPrefs';
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
import { fitPxPerMs, snapTime, tickTimes, valueAtTime } from './scale';

/** anime.js eases offered in the per-key dropdown; '' means "no ease" (linear default). */
const EASES = ['', 'linear', 'in', 'out', 'inOut', 'inQuad', 'outQuad', 'inOutQuad', 'outBack', 'inBack', 'outElastic'];

/** Common animatable properties offered when adding a track. */
const PROPERTIES = ['x', 'y', 'alpha', 'rotation', 'tint', 'scale.x', 'scale.y'];

/** Default drag snap grid (ms); hold Alt while dragging to disable snapping. */
const SNAP_GRID = 10;
/** Within this many ms a key/cue snaps onto another key/cue while dragging. */
const SNAP_THRESHOLD = 8;
/** Zoom (pxPerMs) limits and step. */
const ZOOM_MIN = 0.01;
const ZOOM_MAX = 50;
const ZOOM_STEP = 1.25;

type El = HTMLElement;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<Record<string, string>> = {},
  children: (El | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
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

/**
 * The DOM timeline editor: an absolutely-positioned HTML/CSS overlay mounted to
 * `document.body` (like the pixi canvas itself), dev-only. It renders the live
 * `EditorSession.doc` and wires every edit through the pure ops → `session.edit`,
 * which recompiles the timeline so tweaks show instantly against the running game.
 *
 * v2 (Phase E): one scroll container holds a sticky ruler + sticky labels, so the
 * time axis is zoomable (`pxPerMs`) and scrollable; the panel height and label
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

  /** Time-axis zoom in px per ms; reset to "fit" after the first layout. */
  private pxPerMs = 1;
  private gutterW: number;
  private panelH: number;
  /** Per-track value readout spans, refreshed as the playhead moves (G1). */
  private readouts = new Map<Track, El>();
  /** Suppress the structural refresh during a drag so the dragged node survives. */
  private dragging = false;
  /** Currently-selected key, for the inspector. */
  private selected: { track: number; key: number } | null = null;

  constructor(
    private readonly session: EditorSession,
    /** Persist the current doc to disk (Phase D). Absent → no Save button. */
    private readonly onSave?: () => void,
    /** Close the editor — resolves the sequence and tears down. Absent → finish() directly. */
    private readonly onClose?: () => void,
  ) {
    const prefs = loadPrefs();
    this.gutterW = prefs.gutterW;
    this.panelH = prefs.panelH;

    this.root = el('div', { class: 'vfx-tl-editor', 'data-vfx-timeline-editor': '' });
    this.applyVars();
    document.body.appendChild(this.root);

    this.buildShell();

    session.onChange = () => {
      if (!this.dragging) this.refresh();
    };
    session.transport.onProgress = () => this.onProgress();

    this.refresh();
    // Fit the duration to the viewport once layout has measured the scroller.
    requestAnimationFrame(() => this.fitZoom());
    window.addEventListener('keydown', this.onKey);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    disposeActorHighlight();
    this.root.remove();
  }

  // ---- shell (built once) ------------------------------------------------

  private applyVars(): void {
    this.root.style.height = `${this.panelH}px`;
    this.root.style.setProperty('--vfx-tl-gutter', `${this.gutterW}px`);
    this.root.style.setProperty('--vfx-tl-lane', `${this.laneW()}px`);
  }

  private buildShell(): void {
    // Top edge: drag to resize panel height (E4).
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

    // Footer: add-track row + the fixed inspector (E3 — out of the scroller).
    this.inspectorEl = el('div', { class: 'vfx-tl-inspector' });
    const footer = el('div', { class: 'vfx-tl-footer' }, [this.buildAddTrack(), this.inspectorEl]);

    this.root.append(rhandle, toolbar, bodywrap, footer);
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

    this.speedInput = el('input', {
      class: 'vfx-tl-num',
      type: 'number',
      step: '0.05',
      min: '0.05',
      max: '2',
    }) as HTMLInputElement;
    this.speedInput.onchange = () => t.setSpeed(Number(this.speedInput.value) || 1);

    this.durationInput = el('input', { class: 'vfx-tl-num', type: 'number', step: '10', min: '1' }) as HTMLInputElement;
    this.durationInput.onchange = () =>
      this.session.edit((d) => setDuration(d, Number(this.durationInput.value) || d.duration));

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
      const save = el('button', { class: 'vfx-tl-btn vfx-tl-save', title: 'Save to assets/timelines' }, ['💾 Save']);
      save.onclick = () => this.onSave?.();
      right.push(save);
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
      el('label', { class: 'vfx-tl-field' }, ['speed', this.speedInput]),
      el('label', { class: 'vfx-tl-field' }, ['dur', this.durationInput]),
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
    return Math.max(1, this.duration * this.pxPerMs);
  }

  private timeToX(time: number): number {
    return time * this.pxPerMs;
  }

  /** Clamp & apply a new zoom, keeping the timeline content laid out. */
  private setZoom(pxPerMs: number): void {
    this.pxPerMs = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pxPerMs));
    this.applyVars();
    this.refresh();
  }

  /** Zoom around the horizontal center of the viewport. */
  private zoomBy(factor: number): void {
    const sRect = this.scrollEl.getBoundingClientRect();
    const centerClientX = sRect.left + (this.gutterW + this.scrollEl.clientWidth) / 2;
    this.zoomAround(this.pxPerMs * factor, centerClientX);
  }

  /** Zoom so the time under `clientX` stays put (used by wheel + buttons). */
  private zoomAround(pxPerMs: number, clientX: number): void {
    const sRect = this.scrollEl.getBoundingClientRect();
    const cursorContentX = clientX - sRect.left + this.scrollEl.scrollLeft;
    const timeAtCursor = (cursorContentX - this.gutterW) / this.pxPerMs;
    this.setZoom(pxPerMs);
    const newContentX = this.gutterW + timeAtCursor * this.pxPerMs;
    this.scrollEl.scrollLeft = newContentX - (clientX - sRect.left);
  }

  private fitZoom(): void {
    const viewport = this.scrollEl.clientWidth - this.gutterW;
    this.setZoom(fitPxPerMs(viewport, this.duration));
    this.scrollEl.scrollLeft = 0;
  }

  private onWheel = (e: WheelEvent): void => {
    if (!(e.ctrlKey || e.metaKey)) return; // let normal scroll through
    e.preventDefault();
    this.zoomAround(this.pxPerMs * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP), e.clientX);
  };

  // ---- refresh (structural) ----------------------------------------------

  private refresh(): void {
    this.applyVars();
    this.speedInput.value = String(this.session.transport.speed);
    this.durationInput.value = String(this.duration);
    this.zoomLabel.textContent = `${Math.round(this.pxPerMs * 1000)} px/s`;
    this.renderRuler();
    this.renderLanes();
    this.renderInspector();
    this.positionPlayhead();
  }

  private renderRuler(): void {
    this.rulerLane.replaceChildren();
    for (const time of tickTimes(this.duration, this.pxPerMs)) {
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

    const readout = el('span', { class: 'vfx-tl-readout' });
    this.readouts.set(track, readout);

    const labelText = el('div', { class: 'vfx-tl-labeltext' }, [
      el('span', { class: 'vfx-tl-actor', title: track.actor }, [track.actor]),
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
      this.session.edit((d) => {
        const ki = addKey(d, ti, time);
        this.selected = { track: ti, key: ki };
      });
    };
    const del = el('button', { class: 'vfx-tl-mini', title: 'Remove track' }, ['🗑']);
    del.onclick = () => this.session.edit((d) => removeTrack(d, ti));

    const label = el('div', { class: 'vfx-tl-label' }, [
      labelText,
      readout,
      el('div', { class: 'vfx-tl-actions' }, [eye, addK, del]),
    ]);
    // Hover the label → outline the actor on the canvas (G1).
    label.onmouseenter = () => showActorHighlight(this.session.actor(track.actor));
    label.onmouseleave = () => hideActorHighlight();

    const lane = el('div', { class: 'vfx-tl-lane' });
    for (let ki = 0; ki < track.keys.length; ki++) lane.append(this.renderKey(ti, ki));

    return el('div', { class: `vfx-tl-row${muted ? ' muted' : ''}` }, [label, lane]);
  }

  private renderKey(ti: number, ki: number): El {
    const key = this.session.doc.tracks[ti].keys[ki];
    const isSel = this.selected?.track === ti && this.selected?.key === ki;
    const diamond = el('div', { class: `vfx-tl-key${isSel ? ' sel' : ''}`, title: `t=${key.time}ms  v=${key.value}` });
    diamond.style.left = `${this.timeToX(key.time)}px`;
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

    // Precise time field (E5).
    const timeInput = el('input', {
      class: 'vfx-tl-num',
      type: 'number',
      step: '1',
      min: '0',
      max: String(this.duration),
    }) as HTMLInputElement;
    timeInput.value = String(key.time);
    timeInput.onchange = () => {
      const keyRef = this.session.doc.tracks[ti].keys[ki];
      this.session.edit((d) => {
        retimeKey(d, ti, ki, Number(timeInput.value));
        const idx = d.tracks[ti].keys.indexOf(keyRef);
        if (idx >= 0) this.selected = { track: ti, key: idx };
      });
    };
    this.timeInput = timeInput;

    // Value field: number input for numerics, text for tint strings.
    const isString = typeof key.value === 'string';
    const valInput = el('input', {
      class: 'vfx-tl-num wide',
      type: isString ? 'text' : 'number',
      step: 'any',
    }) as HTMLInputElement;
    valInput.value = String(key.value);
    valInput.onchange = () => {
      const v = isString ? valInput.value : Number(valInput.value);
      this.session.edit((d) => setKeyValue(d, ti, ki, v));
    };

    const easeSel = el('select', { class: 'vfx-tl-sel' }) as HTMLSelectElement;
    for (const e of EASES) {
      const opt = el('option', { value: e }, [e || '(none)']) as HTMLOptionElement;
      if ((key.ease ?? '') === e) opt.selected = true;
      easeSel.append(opt);
    }
    easeSel.onchange = () => this.session.edit((d) => setKeyEase(d, ti, ki, easeSel.value || undefined));

    const del = el('button', { class: 'vfx-tl-btn', title: 'Delete key (Del)' }, ['Delete key']);
    del.onclick = () => {
      this.selected = null;
      this.session.edit((d) => deleteKey(d, ti, ki));
    };

    this.inspectorEl.append(
      el('span', { class: 'vfx-tl-hint' }, [`${track.actor}.${track.property}`]),
      el('label', { class: 'vfx-tl-field' }, ['time', timeInput]),
      el('label', { class: 'vfx-tl-field' }, ['value', valInput]),
      el('label', { class: 'vfx-tl-field' }, ['ease', easeSel]),
      del,
    );
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
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      const t = this.session.transport;
      t.isPlaying ? t.pause() : t.play();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) {
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
      const time = (ev.clientX - rect.left) / this.pxPerMs;
      this.session.transport.seek(Math.max(0, Math.min(1, this.duration > 0 ? time / this.duration : 0)));
    };
    move(e);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
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
      const raw = (ev.clientX - laneRect.left) / this.pxPerMs;
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
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.dragging = false;
      this.refresh(); // resync indices / inspector / readouts
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Drag a cue marker → move live (snapped, Alt disables). */
  private beginDragCue(e: PointerEvent, ci: number, marker: El): void {
    e.preventDefault();
    e.stopPropagation();
    this.dragging = true;
    const laneRect = (marker.parentElement as El).getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const raw = (ev.clientX - laneRect.left) / this.pxPerMs;
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
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.dragging = false;
      this.refresh();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
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
    const maxH = Math.min(2000, window.innerHeight * 0.9);
    const move = (ev: PointerEvent) => {
      this.panelH = Math.max(PANEL_MIN, Math.min(maxH, startH + (startY - ev.clientY)));
      this.root.style.height = `${this.panelH}px`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      savePrefs({ panelH: this.panelH });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
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
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      savePrefs({ gutterW: this.gutterW });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
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
      <ul>
        <li><b>Space</b> play/pause · <b>Del</b> delete selected key</li>
        <li><b>Ctrl/⌘ + wheel</b> zoom · <b>Fit</b> resets · drag the ruler/▼ to scrub</li>
        <li>Drag a ◆ to retime (snaps to ${SNAP_GRID}ms / other keys; hold <b>Alt</b> for free)</li>
        <li>Drag the top edge to grow the panel; drag the label divider to widen it</li>
        <li>Row <b>👁</b> mutes a track to isolate others; <b>+</b> adds a key at the playhead</li>
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
