import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import type { AppScreen } from '@/core/window/types';
import { LayoutContainer } from '@pixi/layout/components';
import { Assets, Container, Graphics, Ticker, TilingSprite } from 'pixi.js';

import {
  b2Body_SetAngularVelocity,
  b2Body_SetLinearVelocity,
  b2BodyId,
  b2BodyType,
  b2CreateBody,
  b2CreatePolygonShape,
  b2DefaultBodyDef,
  b2DefaultShapeDef,
  b2DefaultWorldDef,
  b2MakeBox,
  b2MakeRot,
  b2Vec2,
  b2World_Draw,
  b2World_Step,
  b2WorldId,
  CreateWorld,
  SetWorldScale,
} from 'phaser-box2d';

import { PhaserDebugDraw } from './PhaserDebugDraw';
import { InputDevice } from 'pixijs-input-devices';

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
        backgroundColor: 'pink',
        alignItems: 'center',
      },
    });

    this.addChild(background);

    SetWorldScale(20);

    const worldDef = b2DefaultWorldDef();
    worldDef.gravity = new b2Vec2(0, -10);

    const worldId = CreateWorld({ worldDef }).worldId;

    const bodyDef = b2DefaultBodyDef();
    bodyDef.type = b2BodyType.b2_dynamicBody;
    bodyDef.position = new b2Vec2(-2.5, -5);
    bodyDef.rotation = b2MakeRot(0);
    const dynamicBodyId = b2CreateBody(worldId, bodyDef);
    this._dynamicBodyId = dynamicBodyId;
    //b2Body_SetAngularVelocity(loadedBodies[1], 10);

    const shapeDef = b2DefaultShapeDef();
    shapeDef.density = 1;

    const shape = b2MakeBox(3, 1);
    const boxShapeId = b2CreatePolygonShape(dynamicBodyId, shapeDef, shape);

    bodyDef.type = b2BodyType.b2_staticBody;
    bodyDef.position = new b2Vec2(5, 8);
    const staticBodyId = b2CreateBody(worldId, bodyDef);
    this._staticBodyId = staticBodyId;
    b2CreatePolygonShape(staticBodyId, shapeDef, shape);

    bodyDef.type = b2BodyType.b2_kinematicBody;
    bodyDef.position = new b2Vec2(0, -40);
    const kinematicBodyId = b2CreateBody(worldId, bodyDef);
    this._kinematicBodyId = kinematicBodyId;
    b2CreatePolygonShape(kinematicBodyId, shapeDef, shape);
    //b2Body_SetAngularVelocity(kinematicBodyId, -10);

    const debug = new Graphics();

    debug.rect(10, 10, 300, 300).fill(0xff0000);

    debug.x = 200;
    debug.y = 200;

    const worldDraw = new PhaserDebugDraw(debug, MIN_WIDTH, MIN_HEIGHT, 13);

    background.addChild(debug);

    this._worldId = worldId;
    this._worldDraw = worldDraw;
    this._debug = debug;
  }

  private readonly _dynamicBodyId: b2BodyId;
  private readonly _staticBodyId: b2BodyId;
  private readonly _kinematicBodyId: b2BodyId;

  private readonly _worldId: b2WorldId;
  private readonly _worldDraw: PhaserDebugDraw;

  private readonly _debug: Graphics;

  public update(time: Ticker) {
    this._debug.clear();
    b2World_Step(this._worldId, 1 / 60, 8);
    b2World_Draw(this._worldId, this._worldDraw);

    b2Body_SetLinearVelocity(this._kinematicBodyId, new b2Vec2(0, 0));
    if (InputDevice.keyboard.key.ArrowLeft) {
      b2Body_SetLinearVelocity(this._kinematicBodyId, new b2Vec2(-10, 0));
    }
    if (InputDevice.keyboard.key.ArrowRight) {
      b2Body_SetLinearVelocity(this._kinematicBodyId, new b2Vec2(10, 0));
    }
    if (InputDevice.keyboard.key.ArrowUp) {
      b2Body_SetLinearVelocity(this._kinematicBodyId, new b2Vec2(0, 10));
    }
    if (InputDevice.keyboard.key.ArrowDown) {
      b2Body_SetLinearVelocity(this._kinematicBodyId, new b2Vec2(0, -10));
    }
  }

  public resize(w: number, h: number) {
    // Fit background to screen
    this._background.width = w;
    this._background.height = h;
  }
}
