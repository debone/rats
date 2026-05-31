# In-Engine Visual Timeline (our own, not Godot)

## Context

Authoring VFX sequences as **imperative anime.js TypeScript** is the pain point: every beat is a
`tl.add(target, props, offsetMs)` with hand-tuned magic-number offsets, you can't restructure
timing without recomputing everything, and "good animation" tuning fights "good code." We
explored using **Godot** as the authoring tool and set it aside: its bridge only handles
Sprite2D/Label, and our worst cases (`doorOpen`, `levelCompleted`) are mostly *system wiring +
procedurally-drawn PixiJS Graphics*, which Godot can't represent. So we build our own.

What exists today (confirmed):
- Sequences are pure imperative TS. **No data model, no serialization** anywhere
  (`src/core/vfx/effects/*.ts`, e.g. `levelCompleted.ts:137`, `doorOpen.ts:71`).
- `ctx.timeline()` (`VFXSystem.ts:269`) makes a tracked anime.js v4 timeline; `tl.add` =
  seekable state, `tl.call` = fire-once beat (`types.ts:128`).
- `SequenceDebugSession` (`src/core/vfx/SequenceDebug.ts`, 207 lines) already does
  play/pause/seek/step/speed with **muted-callback scrubbing** + thenable interception. This is
  the *read half* — but it's tweakpane (vertical), which we're not using for the timeline view.
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

| Stays in code (build) | Lives in JSON (editable) |
|---|---|
| Creating procedural Graphics / actors | Position/scale/rotation/alpha/tint keyframes of named actors |
| Array/loop tweens (e.g. `levelCompleted` shards) | `physics.ramp` 0↔1 freeze (a numeric track on the `physics` actor) |
| Per-body `onUpdate` sync (`doorOpen` slide) | **Cue times**: when sfx / debris bursts / dust fire |
| Camera `shake`/`zoom` helpers (parametric) | Easing + offset of every keyframe and cue |

Procedural and array/onUpdate tweens are added directly to the same `tl` in `build()` and
**coexist** with compiled JSON tracks — the editor edits only the JSON tracks/cues but scrubbing
plays everything. Target resolution = a **name lookup in the stage map** (no global IDs).

## Data model — `src/core/vfx/timeline/types.ts`
```ts
interface TimelineDoc { id: string; duration: number; tracks: Track[]; cues: Cue[]; }
interface Track { actor: string; property: string; /* 'x'|'alpha'|'tint'|'scale.x'… */ keys: Key[]; }
interface Key  { time: number; value: number | string; ease?: string; } // ease enters this key
interface Cue  { time: number; hook: string; }
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
   + camera punch in code; move the flash/lines/burst/textGroup keyframes and the burst/sfx cues
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
