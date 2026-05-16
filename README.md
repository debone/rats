# ratz

A breakout-style game with more standard physics and "run-based".

## How to run

```
npm install
npm run start
```

## Overall architecture

This game is written with TypeScript, uses Pixi.js to render stuff and has box2d as the physics engine.

The archictecture is more or less adding systems `src/systems` and having screens `src/screens` show the visual outcomes of systems. Overall "single shot" stuff that happens are coordinated through commands. These are found all around the game and are all extending the base class Command `src/core/game/Command.ts`

## How to do things

### Assets

All files that are not code should be at `/assets`. They will be copied to the public folder according to the `assetpack` [configurations](https://pixijs.io/assetpack/docs/guide/pipes/overview/).

### Levels

Since May 2026, all level geometry and art is organized inside Godot
