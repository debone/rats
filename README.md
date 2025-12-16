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

Levels geometry so far are done in [R.U.B.E.](https://www.iforce2d.net/rube/) (.rube files) and backgrounds in [Tiled](https://www.mapeditor.org/) (.tmx files).

I added a copy of R.U.B.E. in the repo. It works quite similar to Blender. Overall to understand it you probably need to understand [box2d](https://www.iforce2d.net/b2dtut/) concepts.

For Tiled, right now is only about backgrounds art.
