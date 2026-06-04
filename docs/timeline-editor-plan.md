# In-Engine Visual Timeline (our own, not Godot)

## Context

Authoring VFX sequences as **imperative anime.js TypeScript** is the pain point: every beat is a
`tl.add(target, props, offsetMs)` with hand-tuned magic-number offsets, you can't restructure
timing without recomputing everything, and "good animation" tuning fights "good code." We
explored using **Godot** as the authoring tool and set it aside: its bridge only handles
Sprite2D/Label, and our worst cases (`doorOpen`, `levelCompleted`) are mostly _system wiring +
procedurally-drawn PixiJS Graphics_, which Godot can't represent. So we build our own.

What exists today (confirmed):

- Sequences are pure imperative TS. **No data model, no serialization** anywhere
  (`src/core/vfx/effects/*.ts`, e.g. `levelCompleted.ts:137`, `doorOpen.ts:71`).
- `ctx.timeline()` (`VFXSystem.ts:269`) makes a tracked anime.js v4 timeline; `tl.add` =
  seekable state, `tl.call` = fire-once beat (`types.ts:128`).
- `SequenceDebugSession` (`src/core/vfx/SequenceDebug.ts`, 207 lines) already does
  play/pause/seek/step/speed with **muted-callback scrubbing** + thenable interception. This is
  the _read half_ — but it's tweakpane (vertical), which we're not using for the timeline view.
- Targets are held by reference inside `build()`; there is **no string-ID registry** (entity
  lookup is Symbol-based, `entity/scope.ts:48`). Camera/physics come from `ctx`.
- Runtime JSON loading + dev write-back is feasible: cutscenes already do `.tscn`→JSON→fetch
  (`devtools/packer/processors/godot-scene.ts`); the dev server (`devtools/config.dev.mjs`) can
  host a save endpoint. Dev-only gating is `import.meta.env.DEV` everywhere.

## Architecture — hybrid (code = actors, data = timing)

A sequence splits into three pieces; the timeline they all share is the existing
`ctx.timeline()` so **both `SequenceDebug` and the new editor drive the same playhead**.

1. **Actor setup (code, in `build()`)** — create/look-up the actors (procedural Graphics,
   Containers, Text, plain position objects) and collect them, plus `camera`/`physics` from
   `ctx`, into a **named stage map**: `{ flash, lines, burst, textGroup, camera, physics }`.
   Also collect **named hooks** — fire-once closures for system beats: `{ clunk: () => sfx…,
dust: () => dustSegments(…), spawnDebris: () => vfx.play(brickBreak,…) }`.
2. **Choreography (data, JSON `assets/timelines/<id>.json`)** — per-actor/per-property numeric
   **keyframe tracks** + **cues** (which hook fires when). This is the magic-number content,
   now editable.
3. **Compiler (code)** — `compileTimeline(doc, stage, hooks, tl)` walks the doc and emits the
   same `tl.add(...)` / `tl.call(...)` calls a human writes today.

Sequence files become:

```ts
export const levelCompleted = defineSequence({
  id: 'levelCompleted',
  async build(params, ctx) {
    const { stage, hooks } = setupActors(params, ctx); // procedural actors + system beats
    await playTimeline('levelCompleted', { stage, hooks, ctx }); // load JSON, compile, await
  },
});
```

### What is data vs. what stays code (the boundary)

| Stays in code (build)                            | Lives in JSON (editable)                                            |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| Creating procedural Graphics / actors            | Position/scale/rotation/alpha/tint keyframes of named actors        |
| Array/loop tweens (e.g. `levelCompleted` shards) | `physics.ramp` 0↔1 freeze (a numeric track on the `physics` actor) |
| Per-body `onUpdate` sync (`doorOpen` slide)      | **Cue times**: when sfx / debris bursts / dust fire                 |
| Camera `shake`/`zoom` helpers (parametric)       | Easing + offset of every keyframe and cue                           |

Procedural and array/onUpdate tweens are added directly to the same `tl` in `build()` and
**coexist** with compiled JSON tracks — the editor edits only the JSON tracks/cues but scrubbing
plays everything. Target resolution = a **name lookup in the stage map** (no global IDs).

## Data model — `src/core/vfx/timeline/types.ts`

```ts
interface TimelineDoc {
  id: string;
  duration: number;
  tracks: Track[];
  cues: Cue[];
}
interface Track {
  actor: string;
  property: string;
  /* 'x'|'alpha'|'tint'|'scale.x'… */ keys: Key[];
}
interface Key {
  time: number;
  value: number | string;
  ease?: string;
} // ease enters this key
interface Cue {
  time: number;
  hook: string;
}
```

Compiler mapping (mirrors current hand-authoring): seed the first key with `duration:1` at its
time, then for each adjacent pair emit `tl.add(target, { [prop]: value, duration: t1−t0, ease },
t0)`; resolve dotted `property` to nested targets (`actor.scale.x`); cues → `tl.call(hooks[c.hook],
c.time)`. `tint` keys carry hex **strings** so anime.js color-interpolates (numbers lerp wrong).

## Components to build

1. **Substrate** — `src/core/vfx/timeline/{types,compile,load}.ts`. `load(id)` fetches
   `assets/timelines/<id>.json` (mirror cutscene fetch). `compile(doc, stage, hooks, tl)` as above.
   `playTimeline(id, {stage, hooks, ctx})` = load → `ctx.timeline()` → compile → `await tl`.
2. **Port one effect as proof** — refactor `levelCompleted.ts`: keep actor creation + shards loop
   - camera punch in code; move the flash/lines/burst/textGroup keyframes and the burst/sfx cues
     into `assets/timelines/levelCompleted.json`. Proves data-driven playback scrubs identically.
3. **Transport core** — extract the seek/step/speed/playhead-sync + muted-scrub + thenable
   interception out of `SequenceDebug.ts` into `timeline/Transport.ts`, reused by the editor
   (SequenceDebug keeps working via the extracted core).
4. **DOM overlay editor** — `src/core/vfx/timeline/editor/` (dev-only, `import.meta.env.DEV`,
   toggle via a key/debug button; absolutely-positioned HTML/CSS layer over the canvas, mounted to
   `document.body` like the canvas itself):
   - left gutter: track rows (`actor.property`) + a Cues row; horizontal time ruler + draggable
     playhead; keyframe diamonds positioned by time.
   - transport (play/pause/seek/step/speed) wired to the Transport core.
   - edit ops: drag key to retime, numeric value field, per-key easing dropdown, add/delete key,
     add track (pick actor from the live stage map + property), drag cues, set duration.
   - **live recompile**: every edit mutates the in-memory `TimelineDoc` and rebuilds the tl, so
     tweaks show instantly against the running game (the payoff over Godot's export round-trip).
5. **Persistence** — add a dev-only Vite middleware in `devtools/config.dev.mjs`:
   `POST /api/save-timeline` → `fs.writeFile('assets/timelines/<id>.json', …)` (committed source).
   Ensure `assets/timelines` is copied to `public/assets/timelines` for runtime (extend the
   assetpack vite plugin's static copy). Editor "Save" button calls it.

## Phasing (each phase independently valuable)

- **A. Substrate + port `levelCompleted`** — data-driven sequences that already scrub via the
  existing `SequenceDebug`. No editor yet. Proves the model end-to-end.
- **B. Editor (read)** — DOM timeline renders the live doc's tracks/keys/cues + scrubs.
- **C. Editor (edit)** — drag/value/easing/add/delete with live recompile.
- **D. Persistence** — save endpoint + static copy; full author→save→reload loop.

## Verification

- After A: `npm test` + `npx tsc --noEmit` clean; play `levelCompleted` in dev, scrub it in the
  debug panel — visuals identical to the old imperative version; the burst/sfx cues fire only on
  real Play, muted on scrub (same contract as `tl.call`).
- After C: open the editor, drag a `textGroup.scale` key earlier → the slam retimes live; change
  a key's easing → curve changes on next scrub.
- After D: Save, hard-reload, confirm `assets/timelines/levelCompleted.json` round-trips and plays
  the edited timing. Run `npm test` and `npx tsc --noEmit`.

---

# v2 — Usability pass (post-first-version feedback)

Phases A–D shipped and the model is proven: data-driven `levelCompleted` scrubs identically,
edits live-recompile, Save round-trips. The first version "worked wonders" but is hard to _use_.
This section plans the evolution. Two themes: **(I) make the timeline editor a real tool to drive**
and **(II) make the workflow legible** (how you open it, what the controls mean, how you'd author a
_new_ sequence). Everything stays dev-only and on the same hybrid model — this is UX + docs, not a
re-architecture.

The findings below are grouped by phase. Each names the **root cause in the current code** so the
work is concrete, not a wishlist.

## Phase E — Timeline editor UX (the panel itself)

Current shape (for reference): `TimelineEditor` renders three stacked regions into one fixed
320px-tall bar — `toolbar`, `ruler`, `body` — and the `body` is a single `overflow-y:auto`
scroller that contains the lanes grid **and** the add-track row **and** the inspector
(`renderBody`, `TimelineEditor.ts:183`). `render()` does a full `replaceChildren()` teardown on
_every_ change (`:116`). `laneWidth` is pinned to the body's pixel width (`:120`), so time always
spans exactly the visible area.

| #   | Symptom (your words)                                                                                                              | Root cause                                                                                                                                                                                                            | Fix                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | "Labels on the left are squeezed"                                                                                                 | `.vfx-tl-label` fixed at `150px`, `white-space:nowrap; overflow:hidden`, and it _also_ hosts the `+`/🗑 buttons (`styles.ts:37`, `renderTrackRow:204`)                                                                | Widen the gutter and make it **resizable** (drag the gutter/lane divider, persist px in `localStorage`). Show `actor` and `property` on two lines or with a tooltip; move the per-row action buttons to a hover affordance so the text owns the width.                                                                              |
| E2  | "No zooming function"                                                                                                             | `laneWidth = body.clientWidth` (`:120`); `timeToX` maps the whole duration onto the visible width with no scale factor (`:101`)                                                                                       | Introduce a **pixels-per-ms zoom** state (`pxPerMs`), make the lanes a horizontally-scrollable strip wider than the viewport, and drive `timeToX`/`xToTime` from it. Controls: `+`/`−` buttons, `Ctrl/⌘ + wheel` to zoom around the cursor, "Fit" to reset. The ruler tick density derives from zoom (nice 50/100/250/500ms steps). |
| E3  | "Value editor isn't fixed like the top toolbar → lots of scrolling" + "when a keyframe is selected, the panel scrolls to the top" | The inspector is the **last child inside the scrolling `body`** (`renderBody:200`), and selecting a key calls `render()` which rebuilds `body`, resetting `scrollTop` to 0 (`:116`, `beginDragKey` up-handler `:368`) | Pull the inspector **out of the scroller** into a fixed footer region (sibling of `body`, like `toolbar` is a fixed header). Then stop the scroll reset: see E6.                                                                                                                                                                    |
| E4  | "Can't vertically grow the panel to see more tracks"                                                                              | `.vfx-tl-editor { height: 320px }` is hard-coded (`styles.ts`)                                                                                                                                                        | Add a **drag handle on the top edge** to resize the panel height (persist in `localStorage`); clamp to `[200px, 90vh]`. Optional: a maximize toggle. With more height the lane scroller (E2/E3) shows more rows.                                                                                                                    |
| E5  | "Can't precisely set time values for the keys"                                                                                    | Time is only editable by dragging diamonds (`beginDragKey`), which is pixel-quantized and worsens at low zoom; the inspector shows `@ {time}ms` as static text (`renderInspector:315`)                                | Add a **numeric time field** to the inspector (next to value/ease), wired to the existing `retimeKey` op. Add **snapping** while dragging (to a configurable grid, e.g. 5/10/25ms, and optionally to other keys/cues) with a modifier to disable.                                                                                   |
| E6  | (enabler for E1–E5) "everything flickers / scroll jumps"                                                                          | `render()` is a full `replaceChildren()` on every edit and every selection (`:116`); drag-retime calls `session.edit` → `onChange` → full re-render _per pointermove_                                                 | Split rendering: structural re-render (tracks added/removed) vs. **cheap updates** (a key moved → reposition that diamond's `style.left`; selection changed → toggle a class + repopulate the fixed inspector). Keep scroll position. This makes E2's wide scroller and E3's fixed inspector behave.                                |

Deliverable: the panel is resizable (height + gutter), zoomable/scrollable in time, the inspector
is always visible, selection never scrolls the lanes, and key time is precisely editable. No data
model change — all of this is `TimelineEditor.ts` + `styles.ts`, plus a tiny `editorPrefs` helper
for the persisted px/zoom values.

## Phase F — How the editor is accessed

Current: the VFX debug panel adds **two buttons per sequence** — `seek ▶` and `edit ✎` —
in a flat tweakpane folder (`VFXSystem.initDebugPanel`, the `case 'sequence'` block). With several
sequences this is a wall of repeated buttons (your "list of repeated buttons").

Plan:

- Replace the per-sequence button pair with **one dropdown** (tweakpane `addBinding` list, or a
  small select in the editor's own toolbar) to pick the sequence, plus a single `seek`/`edit`
  action pair that operates on the selection. Keeps `requestTimelineEdit(id)` → `playSequence`
  plumbing; only the launcher UI changes.
- Distinguish **data-driven** sequences (have an `assets/timelines/<id>.json`, so `edit` is
  meaningful) from purely-imperative ones. Cheapest signal: a static manifest of timeline ids
  (generated by `vite-plugin-timelines` from the folder, mirroring how cutscene ids are surfaced)
  so the dropdown can disable `edit` for sequences without a doc. Avoids a failed fetch + console
  warning as the "discovery" mechanism.
- Optional: a global keybind (dev-only) to toggle the editor for the last-played sequence.

## Phase G — Legibility: make the tool self-explanatory

This is the "left as an exercise for the reader" theme. Two parts: in-tool affordances and a real
authoring doc.

**G1 — In-tool clarity**

- Label the mystery controls. The **`+` on a track row** adds a keyframe at the current playhead
  (`renderTrackRow:207`) — but it's an unlabeled `+` next to a 🗑. Give them tooltips/labels
  ("add key @ playhead", "remove track") and a clearer layout (E1).
- "I lost track of what is what in the level animation." The rows are `actor.property`
  (`flash.alpha`, `textGroup.scale.x`, …) which mean nothing without seeing the actor. Add:
  - **Hover-to-highlight**: hovering a track row flashes/outlines that actor on the canvas (most
    actors are `Container`/`Graphics`; a temporary tint or bounding box). Needs the editor to reach
    the live stage map — it already has it via `EditorSession` (`actorNames()`); extend to expose
    the objects for a highlight helper.
  - **Solo/mute per track** (eye toggle) so you can isolate one actor's contribution while scrubbing.
  - A **value readout at the playhead** per track (the interpolated current value), so a row reads
    as "what is this doing _right now_."
- A small **"?" help popover** in the toolbar summarizing controls and the code-vs-data boundary.

**G2 — Authoring workflow docs ("how do I start adding sequences?")**
Write `docs/timeline-authoring.md` (and link it from the help popover) covering the full loop:

1. **Anatomy of a sequence** — the three pieces (actor setup in `build()`, the JSON doc, the
   compiler) with the `levelCompleted` before/after as the worked example.
2. **Add a track** to an existing sequence: pick an actor from the live stage map + a property,
   key it, scrub. What properties are legal (`x`, `alpha`, `tint` as hex string, `scale.x`, …).
3. **Cues** — what a hook is, how `build()` exposes named fire-once closures, why cues are muted
   on scrub and only fire on real Play.
4. **Authoring a brand-new sequence from scratch**: the `defineSequence` skeleton, building actors,
   collecting the `stage`/`hooks` maps, calling `playTimeline(id, …)`, creating an empty
   `assets/timelines/<id>.json` (or an editor **"New timeline"** action that scaffolds one), and
   registering it in `registry.ts`.
5. The **code-vs-data boundary** table (which tweens stay in `build()` and why), pointing back to
   this plan.

Deliverable: someone who has never seen the system can open the dropdown, pick a sequence, read the
rows, add a track, and know where a brand-new sequence's code and JSON go — without reading source.

## v2 phasing

- **E. Editor UX** — resize (height + gutter), time zoom/scroll, fixed inspector, precise time
  field, incremental render. Highest friction-reduction; do first.
- **F. Access UX** — dropdown launcher + data-driven discovery manifest.
- **G. Legibility** — in-tool labels/hover-highlight/solo + the authoring doc.

## v2 verification

- After E: open `levelCompleted`, drag the panel taller and the gutter wider (persists across
  reload); `Ctrl+wheel` zooms the time axis and the ruler relabels; select keys rapidly — the lane
  scroll position holds and the inspector stays put; type a time into the inspector and the diamond
  jumps exactly. `npm test` + `tsc` clean.
- After F: the VFX panel shows one sequence dropdown, not N button pairs; picking a sequence with
  no JSON disables `edit`.
- After G: a new contributor follows `docs/timeline-authoring.md` to add a track and scaffold a new
  sequence; hovering a row highlights its actor on the canvas.
