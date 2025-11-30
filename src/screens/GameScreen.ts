import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import type { AppScreen } from '@/core/window/types';
import { LayoutContainer } from '@pixi/layout/components';
import { Assets, Container, Graphics, Ticker, TilingSprite } from 'pixi.js';

import {
  b2Body_GetLinearVelocity,
  b2Body_GetTransform,
  b2Body_SetLinearVelocity,
  b2Body_SetTransform,
  b2BodyId,
  b2BodyType,
  b2Circle,
  b2CreateBody,
  b2CreateCircleShape,
  b2CreatePolygonShape,
  b2DefaultBodyDef,
  b2DefaultShapeDef,
  b2DefaultWorldDef,
  b2MakeBox,
  b2MakeOffsetBox,
  b2MulSV,
  b2Normalize,
  b2Vec2,
  b2World_Draw,
  b2World_Step,
  b2WorldId,
  CreateWorld,
  SetWorldScale,
} from 'phaser-box2d';

import { InputDevice } from 'pixijs-input-devices';
import { PhaserDebugDraw } from './PhaserDebugDraw';

export class GameScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'game';
  static readonly assetBundles = ['preload', 'default'];

  private readonly _background: TilingSprite;

  constructor() {
    super();

    this.layout = {
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
    };

    const tilingSprite = new TilingSprite({ texture: Assets.get('tiles').textures.grid, width: 64, height: 64 });
    this._background = tilingSprite;
    this.addChild(this._background);

    const background = new LayoutContainer({
      layout: {
        width: MIN_WIDTH,
        height: MIN_HEIGHT,
        justifyContent: 'center',
        backgroundColor: 'black',
        alignItems: 'center',
      },
    });

    this.addChild(background);

    SetWorldScale(20);

    const worldDef = b2DefaultWorldDef();
    worldDef.gravity = new b2Vec2(0, 0);
    worldDef.restitutionThreshold = 0;

    const worldId = CreateWorld({ worldDef }).worldId;

    const bodyDef = b2DefaultBodyDef();
    bodyDef.type = b2BodyType.b2_dynamicBody;
    bodyDef.position = new b2Vec2(-2.5, -50);

    const dynamicBodyId = b2CreateBody(worldId, bodyDef);
    this._dynamicBodyId = dynamicBodyId;
    //b2Body_SetAngularVelocity(loadedBodies[1], 10);

    const shapeDef = b2DefaultShapeDef();
    shapeDef.density = 10;
    shapeDef.restitution = 1;
    shapeDef.friction = 0;

    const shape = b2MakeBox(4, 1);
    const boxShapeId = b2CreatePolygonShape(dynamicBodyId, shapeDef, shape);

    const wallShapeDef = b2DefaultShapeDef();
    wallShapeDef.density = 10;
    wallShapeDef.restitution = 1;
    wallShapeDef.friction = 0;
    // Create a static body to serve as the parent for the 4 walls
    const wallsBodyDef = b2DefaultBodyDef();
    wallsBodyDef.type = b2BodyType.b2_staticBody;
    wallsBodyDef.position = new b2Vec2(0, 0);
    const staticBodyId = b2CreateBody(worldId, wallsBodyDef);
    this._staticBodyId = staticBodyId;

    // Wall shape properties
    const wallThickness = 1;
    const arenaWidth = 35;
    const arenaHeight = 66;

    // Bottom wall
    let wall = b2MakeOffsetBox(
      arenaWidth * 0.5,
      wallThickness * 0.5,
      new b2Vec2(0, -arenaHeight * 0.5 + wallThickness * 0.5),
      0,
    );
    b2CreatePolygonShape(staticBodyId, wallShapeDef, wall);

    // Top wall
    wall = b2MakeOffsetBox(
      arenaWidth * 0.5,
      wallThickness * 0.5,
      new b2Vec2(0, arenaHeight * 0.5 - wallThickness * 0.5),
      0,
    );
    b2CreatePolygonShape(staticBodyId, wallShapeDef, wall);

    // Left wall
    wall = b2MakeOffsetBox(
      wallThickness * 0.5,
      arenaHeight * 0.5,
      new b2Vec2(-arenaWidth * 0.5 + wallThickness * 0.5, 0),
      0,
    );
    b2CreatePolygonShape(staticBodyId, wallShapeDef, wall);

    // Right wall
    wall = b2MakeOffsetBox(
      wallThickness * 0.5,
      arenaHeight * 0.5,
      new b2Vec2(arenaWidth * 0.5 - wallThickness * 0.5, 0),
      0,
    );
    b2CreatePolygonShape(staticBodyId, wallShapeDef, wall);

    const paddleBodyDef = b2DefaultBodyDef();
    paddleBodyDef.type = b2BodyType.b2_kinematicBody;
    paddleBodyDef.position = new b2Vec2(0, -20);
    paddleBodyDef.enableSleep = false;
    //paddleBodyDef.linearDamping = 0;
    //paddleBodyDef.angularDamping = 0;
    const paddleShape = b2MakeBox(4, 1);
    const paddleShapeDef = b2DefaultShapeDef();
    paddleShapeDef.density = 10;
    paddleShapeDef.restitution = 1;
    paddleShapeDef.friction = 0.5;
    const paddleBodyId = b2CreateBody(worldId, paddleBodyDef);
    this._paddleBodyId = paddleBodyId;
    b2CreatePolygonShape(paddleBodyId, paddleShapeDef, paddleShape);
    //b2Body_SetAngularVelocity(kinematicBodyId, -10);

    const ballShapeDef = b2DefaultShapeDef();
    ballShapeDef.density = 10;
    ballShapeDef.restitution = 1;
    ballShapeDef.friction = 0.5;
    const ballBodyDef = b2DefaultBodyDef();
    ballBodyDef.type = b2BodyType.b2_dynamicBody;
    ballBodyDef.position = new b2Vec2(0, -18);
    ballBodyDef.enableSleep = false; // Prevent ball from sleeping
    //ballBodyDef.linearDamping = 0; // No velocity damping
    //ballBodyDef.angularDamping = 0; // No rotation damping
    //ballBodyDef.fixedRotation = true;
    this.ballBodyId = b2CreateBody(worldId, ballBodyDef);
    //this._dynamicBodyId2 = dynamicBodyId;
    const circle = new b2Circle();
    circle.center = new b2Vec2(0.0, 0.0);
    circle.radius = 0.5;
    b2CreateCircleShape(this.ballBodyId, ballShapeDef, circle);
    b2Body_SetLinearVelocity(this.ballBodyId, new b2Vec2(0, 5));
    const velocity = b2Body_GetLinearVelocity(this.ballBodyId);
    const normalizedVelocity = b2Normalize(velocity);
    const multipliedVelocity = b2MulSV(15, normalizedVelocity);
    b2Body_SetLinearVelocity(this.ballBodyId, multipliedVelocity);

    console.log(velocity);

    const debug = new Graphics();

    debug.x = MIN_WIDTH / 2;
    debug.y = MIN_HEIGHT / 2;

    const worldDraw = new PhaserDebugDraw(debug, MIN_WIDTH, MIN_HEIGHT, 13);

    background.addChild(debug);

    this._worldId = worldId;
    this._worldDraw = worldDraw;
    this._debug = debug;
  }

  private readonly _dynamicBodyId: b2BodyId;
  private readonly _staticBodyId: b2BodyId;
  private readonly _paddleBodyId: b2BodyId;

  private readonly ballBodyId: b2BodyId;

  private readonly _worldId: b2WorldId;
  private readonly _worldDraw: PhaserDebugDraw;

  private readonly _debug: Graphics;

  public update(time: Ticker) {
    this._debug.clear();

    // Set paddle velocity BEFORE physics step
    b2Body_SetLinearVelocity(this._paddleBodyId, new b2Vec2(0, 0));
    const transform = b2Body_GetTransform(this._paddleBodyId);
    transform.q.s = 0;
    b2Body_SetTransform(this._paddleBodyId, transform.p, transform.q);
    if (InputDevice.keyboard.key.ArrowLeft) {
      transform.q.s = -0.1;
      b2Body_SetTransform(this._paddleBodyId, transform.p, transform.q);

      b2Body_SetLinearVelocity(this._paddleBodyId, new b2Vec2(-10, 0));
    }
    if (InputDevice.keyboard.key.ArrowRight) {
      transform.q.s = 0.1;
      b2Body_SetTransform(this._paddleBodyId, transform.p, transform.q);

      b2Body_SetLinearVelocity(this._paddleBodyId, new b2Vec2(10, 0));
    }
    if (InputDevice.keyboard.key.ArrowUp) {
      b2Body_SetLinearVelocity(this._paddleBodyId, new b2Vec2(0, 10));
    }
    if (InputDevice.keyboard.key.ArrowDown) {
      b2Body_SetLinearVelocity(this._paddleBodyId, new b2Vec2(0, -10));
    }

    b2World_Step(this._worldId, 1 / 60, 8);
    b2World_Draw(this._worldId, this._worldDraw);

    const velocity = b2Body_GetLinearVelocity(this.ballBodyId);
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

    // Only normalize and reset if speed is not already at target (within tolerance)
    if (Math.abs(speed - 10) > 0.1) {
      const normalizedVelocity = b2Normalize(velocity);
      const multipliedVelocity = b2MulSV(10, normalizedVelocity);
      b2Body_SetLinearVelocity(this.ballBodyId, multipliedVelocity);
    }
  }

  public resize(w: number, h: number) {
    // Fit background to screen
    this._background.width = w;
    this._background.height = h;
  }
}
