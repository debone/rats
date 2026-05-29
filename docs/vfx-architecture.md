# VFX Architecture: Scene Graph & Timing Model

> Status: proposal. Captures two structural problems the VFX system has hit in
> practice, and a target design. Written after the off-center-particles bug and
> the "Play is too fast / external effects ignore the timeline clock" findings.

## The two problems

### 1. VFX borrows its render surface from whatever screen is mounted

Today a VFX picks where to draw at the moment it runs:

- bursts/continuous render into `ctx.container` (the `GameScreen`, offset by
  `+MIN_WIDTH/2`) — *after* we discovered the dedicated `effects` layer was in a
  different coordinate space and shifted everything half a screen left;
- `levelCompleted` had to escape to `app.stage` to survive a screen transition;
- screen filters attach to `camera.viewport`.

So there are **three coordinate spaces** an author can land in (stage, container,
camera viewport), all chosen implicitly, none of them owned by the VFX system.
Every one is created and destroyed by the navigation/screen lifecycle, which the
VFX system doesn't control. The off-center bug, the stage-escape hack, and the
"continuous effects now follow UI nodes that don't belong to the gameplay screen"
pressure are all the same root cause: **VFX has no render home of its own.**

### 2. There are two clocks, and only one is controllable

A sequence composes two kinds of motion:

- **timeline tweens** (`tl.add`) — driven by the anime.js engine clock. Seekable,
  speed-controllable, the thing the debug panel scrubs.
- **imperative effects** (`tl.call` → `shake`, `punch`, `emitter.explode`) — each
  runs its *own* `performance.now()` / `app.ticker` loop, with no knowledge of any
  timeline.

This is why the debug panel can scrub/seek/step the tweens but the camera shake
and particles can't follow; why "Play" looks too fast (the tweens honor a speed
control but the external effects always run at wall-clock); and why there's no
single place to globally slow, pause, or scrub a whole effect.

## Target design

### A. A VFX scene graph owned by the system

Introduce a persistent VFX root the system owns, independent of screens, with
explicit sub-roots per coordinate space:

```
VFXSystem.scene (created once, lives for the system's lifetime)
├── world   — camera-relative, tracks the camera transform (debris, trails, auras)
├── screen  — screen-fixed, full-viewport (impact flashes, vignettes, "LEVEL UP")
└── filters — post-processing host (CRT, reflection, bloom)
```

- **`world`** is parented under `camera.viewport` and carries the same world→screen
  offset the gameplay container uses, so `BodyToScreen` coords land correctly *by
  construction* — no more borrowing `ctx.container`, no coordinate guessing.
- **`screen`** is parented under `app.stage` above all gameplay layers, so a
  full-screen flourish needs no stage-escape hack and survives screen transitions
  by default.
- The system reparents/repositions these on `resize` and on screen change; effects
  never touch the screen lifecycle directly. An effect declares the *space* it wants
  (`space: 'world' | 'screen'`) and gets the right root handed to it.

This turns "where do I draw and will it survive?" from a per-effect decision into a
system guarantee. Continuous effects following UI nodes use `screen`; gameplay
trails use `world`; neither cares what screen is mounted.

Migration is incremental: `ctx.layer` keeps working (it just resolves to
`scene.world`), `levelCompleted`'s `ctx.stage` usage becomes `ctx.screen`.

### B. One clock per effect: the timeline drives everything

Make the timeline the single clock for a sequence by routing imperative effects
through it instead of letting them self-run on wall-clock.

The mechanism: effects that currently spin their own `app.ticker`/`performance.now`
loop (camera `shake`/`punch`, and particle stepping) gain a form that advances by an
**injected delta** rather than reading the wall clock. A sequence's timeline then
owns a "driver" that, each engine tick, advances those effects by the timeline's
*scaled* delta. Because the timeline's `speed` (anime.js `Clock.speed`, already
verified to work with our manually-driven engine) and `seek` change that delta, the
external effects inherit slow-mo, pause, and — for anything expressed as a sampled
function of time rather than a fire-and-forget — scrub.

Concretely, three tiers, cheapest first:

1. **Speed (this PR):** expose `timeline.speed` as a debug "speed" control. Tweens
   honor it immediately. Camera/particles still wall-clock, but the dominant visual
   (the tweened choreography) is now adjustable — enough to *watch* an effect.
2. **Timeline-clocked camera fx:** add `shake`/`punch` variants that take their time
   from a passed clock (the sequence's timeline) instead of `performance.now()`.
   Then slow-mo and pause reach the camera too. Low risk, self-contained per effect.
3. **Sampled effects (full seek):** for an effect to be *scrubbable* (not just
   speed-adjustable) it must be a pure function of timeline time — e.g. a shake
   expressed as `offset = f(t, intensity)` sampled at `tl.currentTime`, and particle
   bursts modeled as deterministic spawns keyed to timeline time. This is the
   "rearrange external stuff to use an animation clock" path. It's the most work and
   only worth doing per-effect where seek-fidelity matters (hero moments, the
   `levelCompleted` flash).

The honest boundary: **fire-once side-effects (a sound, a one-shot particle pop)
can be sped up and paused, but not run backwards.** True bidirectional scrub only
exists for state expressed as `f(t)`. The tiering lets us buy exactly as much of
that as each effect deserves, instead of forcing all effects into a sampled model.

## What this PR does (down payment)

- Adds a **speed control** to the sequence debug panel (`timeline.speed`), so
  effects can be slowed to watch them. (Tier 1.)
- Fixes the debug panel disposing itself when the animation completes — it now
  persists until **Close**, so you can replay/scrub after a run.
- Leaves the scene-graph (A) and clocked-camera/sampled effects (B tiers 2–3) as
  follow-up work, scoped above.

## Open questions

- Should `world`/`screen`/`filters` roots be a thin `VfxScene` class the system
  owns, or folded into the existing layer system with VFX-reserved layers? (Leaning
  thin class — the layer system is screen-scoped, which is exactly what we're trying
  to escape.)
- For Tier 3, is a shared "sampled effect" base worth it, or do we hand-roll `f(t)`
  per hero effect? Probably hand-roll until a second one wants it.
