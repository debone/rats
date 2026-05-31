import type { EditorSession } from './EditorSession';
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

/** anime.js eases offered in the per-key dropdown; '' means "no ease" (linear default). */
const EASES = ['', 'linear', 'in', 'out', 'inOut', 'inQuad', 'outQuad', 'inOutQuad', 'outBack', 'inBack', 'outElastic'];

/** Common animatable properties offered when adding a track. */
const PROPERTIES = ['x', 'y', 'alpha', 'rotation', 'tint', 'scale.x', 'scale.y'];

const LANE_LABEL_W = 150; // px — left gutter width

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

/**
 * The DOM timeline editor: an absolutely-positioned HTML/CSS overlay mounted to
 * `document.body` (like the pixi canvas itself), dev-only. It renders the live
 * `EditorSession.doc` — track rows, a Cues row, a time ruler, a draggable
 * playhead, and keyframe diamonds — and wires every edit through the pure ops,
 * then `session.edit(...)`, which recompiles the timeline so tweaks show
 * instantly against the running game.
 *
 * The view is fully re-rendered from the doc on every change (`session.onChange`);
 * it holds no derived state beyond the current selection and the lane pixel width.
 */
export class TimelineEditor {
  private root: El;
  private lanes!: El;
  private playhead!: El;
  private speedInput!: HTMLInputElement;
  private durationInput!: HTMLInputElement;
  private laneWidth = 800;
  /** Currently-selected key, for the inspector. */
  private selected: { track: number; key: number } | null = null;

  constructor(
    private readonly session: EditorSession,
    /** Persist the current doc to disk (Phase D). Absent → no Save button. */
    private readonly onSave?: () => void,
    /** Close the editor — resolves the sequence and tears down. Absent → finish() directly. */
    private readonly onClose?: () => void,
  ) {
    this.root = el('div', { class: 'vfx-tl-editor', 'data-vfx-timeline-editor': '' });
    document.body.appendChild(this.root);

    session.onChange = () => this.render();
    session.transport.onProgress = () => this.positionPlayhead();

    this.render();
    window.addEventListener('keydown', this.onKey);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }

  private onKey = (e: KeyboardEvent): void => {
    // Space toggles play/pause; Delete removes the selected key. Ignore while a
    // text/number field is focused so typing isn't hijacked.
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      this.session.transport.isPlaying ? this.session.transport.pause() : this.session.transport.play();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) {
      const { track, key } = this.selected;
      this.selected = null;
      this.session.edit((d) => deleteKey(d, track, key));
    }
  };

  // ---- layout ------------------------------------------------------------

  private timeToX(time: number): number {
    return (time / this.session.doc.duration) * this.laneWidth;
  }

  private xToTime(x: number): number {
    return (x / this.laneWidth) * this.session.doc.duration;
  }

  private positionPlayhead(): void {
    if (!this.playhead) return;
    this.playhead.style.left = `${LANE_LABEL_W + this.timeToX(this.session.transport.progress * this.session.doc.duration)}px`;
  }

  // ---- render ------------------------------------------------------------

  private render(): void {
    this.root.replaceChildren();
    this.root.append(this.renderToolbar(), this.renderRuler(), this.renderBody());
    // Lane pixel width = body width minus the label gutter (measured post-mount).
    requestAnimationFrame(() => {
      const bodyW = this.lanes?.clientWidth ?? 800;
      this.laneWidth = Math.max(200, bodyW);
      this.positionPlayhead();
    });
  }

  private renderToolbar(): El {
    const t = this.session.transport;

    const play = el('button', { class: 'vfx-tl-btn', title: 'Play/Pause (Space)' }, [t.isPlaying ? '⏸' : '▶']);
    play.onclick = () => (t.isPlaying ? t.pause() : t.play());
    const step1 = el('button', { class: 'vfx-tl-btn', title: 'Step -1 frame' }, ['⏮']);
    step1.onclick = () => t.step(-1);
    const step2 = el('button', { class: 'vfx-tl-btn', title: 'Step +1 frame' }, ['⏭']);
    step2.onclick = () => t.step(+1);
    const restart = el('button', { class: 'vfx-tl-btn', title: 'Restart' }, ['↺']);
    restart.onclick = () => t.restart();

    this.speedInput = el('input', { class: 'vfx-tl-num', type: 'number', step: '0.05', min: '0.05', max: '2' }) as HTMLInputElement;
    this.speedInput.value = String(t.speed);
    this.speedInput.onchange = () => t.setSpeed(Number(this.speedInput.value) || 1);

    this.durationInput = el('input', { class: 'vfx-tl-num', type: 'number', step: '10', min: '1' }) as HTMLInputElement;
    this.durationInput.value = String(this.session.doc.duration);
    this.durationInput.onchange = () => this.session.edit((d) => setDuration(d, Number(this.durationInput.value) || d.duration));

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
      play, step1, step2, restart,
      el('label', { class: 'vfx-tl-field' }, ['speed', this.speedInput]),
      el('label', { class: 'vfx-tl-field' }, ['dur', this.durationInput]),
      el('span', { class: 'vfx-tl-spacer' }),
      ...right,
    ]);
  }

  private renderRuler(): El {
    const ruler = el('div', { class: 'vfx-tl-ruler' });
    ruler.style.marginLeft = `${LANE_LABEL_W}px`;
    // Tick marks every ~10% of the duration.
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const time = (i / steps) * this.session.doc.duration;
      const tick = el('span', { class: 'vfx-tl-tick' }, [`${Math.round(time)}`]);
      tick.style.left = `${(i / steps) * 100}%`;
      ruler.append(tick);
    }
    // Click-to-scrub on the ruler.
    ruler.onpointerdown = (e) => this.beginScrub(e, ruler);
    return ruler;
  }

  private renderBody(): El {
    const body = el('div', { class: 'vfx-tl-body' });

    // Lanes container (the right-hand, time-mapped area). The playhead lives here.
    const grid = el('div', { class: 'vfx-tl-grid' });
    this.lanes = grid;

    for (let ti = 0; ti < this.session.doc.tracks.length; ti++) {
      grid.append(this.renderTrackRow(ti));
    }
    grid.append(this.renderCuesRow());

    // Draggable playhead spanning all lanes.
    this.playhead = el('div', { class: 'vfx-tl-playhead' });
    this.playhead.onpointerdown = (e) => this.beginScrub(e, grid);
    grid.append(this.playhead);

    body.append(grid, this.renderAddTrack(), this.renderInspector());
    return body;
  }

  private renderTrackRow(ti: number): El {
    const track = this.session.doc.tracks[ti];
    const label = el('div', { class: 'vfx-tl-label' }, [`${track.actor}.${track.property}`]);
    const addK = el('button', { class: 'vfx-tl-mini', title: 'Add key at playhead' }, ['+']);
    addK.onclick = () => {
      const time = this.session.transport.progress * this.session.doc.duration;
      this.session.edit((d) => {
        const ki = addKey(d, ti, time);
        this.selected = { track: ti, key: ki };
      });
    };
    const del = el('button', { class: 'vfx-tl-mini', title: 'Remove track' }, ['🗑']);
    del.onclick = () => this.session.edit((d) => removeTrack(d, ti));
    label.append(addK, del);

    const lane = el('div', { class: 'vfx-tl-lane' });
    for (let ki = 0; ki < track.keys.length; ki++) {
      lane.append(this.renderKey(ti, ki));
    }
    const row = el('div', { class: 'vfx-tl-row' }, [label, lane]);
    return row;
  }

  private renderKey(ti: number, ki: number): El {
    const key = this.session.doc.tracks[ti].keys[ki];
    const isSel = this.selected?.track === ti && this.selected?.key === ki;
    const diamond = el('div', { class: `vfx-tl-key${isSel ? ' sel' : ''}`, title: `t=${key.time} v=${key.value}` });
    diamond.style.left = `${this.timeToX(key.time)}px`;
    diamond.onpointerdown = (e) => this.beginDragKey(e, ti, ki, diamond);
    return diamond;
  }

  private renderCuesRow(): El {
    const label = el('div', { class: 'vfx-tl-label' }, ['Cues']);
    const hooks = this.session.hookNames();
    if (hooks.length) {
      const addC = el('button', { class: 'vfx-tl-mini', title: 'Add cue at playhead' }, ['+']);
      addC.onclick = () => {
        const time = this.session.transport.progress * this.session.doc.duration;
        this.session.edit((d) => addCue(d, hooks[0], time));
      };
      label.append(addC);
    }

    const lane = el('div', { class: 'vfx-tl-lane vfx-tl-cuelane' });
    for (let ci = 0; ci < this.session.doc.cues.length; ci++) {
      const cue = this.session.doc.cues[ci];
      const marker = el('div', { class: 'vfx-tl-cue', title: cue.hook }, ['▼']);
      marker.style.left = `${this.timeToX(cue.time)}px`;
      marker.onpointerdown = (e) => this.beginDragCue(e, ci, marker);
      marker.ondblclick = () => this.session.edit((d) => deleteCue(d, ci));
      lane.append(marker);
    }
    return el('div', { class: 'vfx-tl-row vfx-tl-cuerow' }, [label, lane]);
  }

  private renderAddTrack(): El {
    const actorSel = el('select', { class: 'vfx-tl-sel' }) as HTMLSelectElement;
    for (const name of this.session.actorNames()) actorSel.append(el('option', { value: name }, [name]));
    const propSel = el('select', { class: 'vfx-tl-sel' }) as HTMLSelectElement;
    for (const p of PROPERTIES) propSel.append(el('option', { value: p }, [p]));
    const add = el('button', { class: 'vfx-tl-btn' }, ['+ track']);
    add.onclick = () =>
      this.session.edit((d) => {
        const ti = addTrack(d, actorSel.value, propSel.value);
        this.selected = { track: ti, key: 0 };
      });
    return el('div', { class: 'vfx-tl-addtrack' }, ['Add track:', actorSel, propSel, add]);
  }

  private renderInspector(): El {
    const box = el('div', { class: 'vfx-tl-inspector' });
    if (!this.selected) {
      box.append(el('span', { class: 'vfx-tl-hint' }, ['Select a key to edit its value & easing']));
      return box;
    }
    const { track: ti, key: ki } = this.selected;
    const key = this.session.doc.tracks[ti]?.keys[ki];
    if (!key) {
      this.selected = null;
      return box;
    }

    // Value field: number input for numerics, text/color for tint strings.
    const isString = typeof key.value === 'string';
    const valInput = el('input', {
      class: 'vfx-tl-num',
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

    const del = el('button', { class: 'vfx-tl-btn' }, ['Delete key']);
    del.onclick = () => {
      this.selected = null;
      this.session.edit((d) => deleteKey(d, ti, ki));
    };

    box.append(
      el('span', { class: 'vfx-tl-hint' }, [`${this.session.doc.tracks[ti].actor}.${this.session.doc.tracks[ti].property} @ ${key.time}ms`]),
      el('label', { class: 'vfx-tl-field' }, ['value', valInput]),
      el('label', { class: 'vfx-tl-field' }, ['ease', easeSel]),
      del,
    );
    return box;
  }

  // ---- interactions ------------------------------------------------------

  /** Pointer drag on the ruler/lane background → scrub the playhead. */
  private beginScrub(e: PointerEvent, surface: El): void {
    e.preventDefault();
    const rect = surface.getBoundingClientRect();
    const isGrid = surface === this.lanes;
    const offset = isGrid ? LANE_LABEL_W : 0;
    const move = (ev: PointerEvent) => {
      const x = ev.clientX - rect.left - offset;
      const progress = Math.max(0, Math.min(1, x / this.laneWidth));
      this.session.transport.seek(progress);
    };
    move(e);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Drag a diamond horizontally → retime the key live; click (no move) selects. */
  private beginDragKey(e: PointerEvent, ti: number, ki: number, diamond: El): void {
    e.preventDefault();
    e.stopPropagation();
    this.selected = { track: ti, key: ki };
    const laneRect = (diamond.parentElement as El).getBoundingClientRect();
    let moved = false;
    let currentKi = ki;
    const move = (ev: PointerEvent) => {
      moved = true;
      const x = ev.clientX - laneRect.left;
      const time = Math.max(0, Math.min(this.session.doc.duration, this.xToTime(x)));
      // Retiming can re-sort keys; track the moved key's new index by identity.
      const keyRef = this.session.doc.tracks[ti].keys[currentKi];
      this.session.edit((d) => {
        retimeKey(d, ti, currentKi, time);
        currentKi = d.tracks[ti].keys.indexOf(keyRef);
        this.selected = { track: ti, key: currentKi };
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!moved) this.render(); // pure click → just refresh selection/inspector
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Drag a cue marker horizontally → move the cue live. */
  private beginDragCue(e: PointerEvent, ci: number, marker: El): void {
    e.preventDefault();
    e.stopPropagation();
    const laneRect = (marker.parentElement as El).getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const x = ev.clientX - laneRect.left;
      const time = Math.max(0, Math.min(this.session.doc.duration, this.xToTime(x)));
      this.session.edit((d) => moveCue(d, ci, time));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
}
