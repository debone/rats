import { b2AABB, b2Transform, b2Vec2 } from 'phaser-box2d';
import type { Graphics } from 'pixi.js';

export class PhaserDebugDraw {
  scale: number;
  width: number;
  height: number;
  drawingBounds: b2AABB;
  positionOffset: b2Vec2;
  p0: b2Vec2;
  useDrawingBounds: boolean;
  drawShapes: boolean;
  drawJoints: boolean;
  drawAABBs: boolean;
  drawMass: boolean;
  drawContacts: boolean;
  drawGraphColors: boolean;
  drawContactNormals: boolean;
  drawContactImpulses: boolean;
  drawFrictionImpulses: boolean;

  context: any;

  constructor(graphics: Graphics, width: number, height: number, scale: number) {
    // Sorry for the manual changes here
    // I wanted to make the scale to fit the whole graphics in the screen
    // for maps larger than the screen, but not yet.
    //  this.SetPosition(width, 0);
    this.scale = scale / 2;

    this.width = width;
    this.height = height;

    this.drawingBounds = new b2AABB();
    this.positionOffset = new b2Vec2();
    this.p0 = new b2Vec2();

    this.useDrawingBounds = false;

    this.drawShapes = true;
    this.drawJoints = false;
    this.drawAABBs = false;
    this.drawMass = false;
    this.drawContacts = false;
    this.drawGraphColors = false;
    this.drawContactNormals = false;
    this.drawContactImpulses = false;
    this.drawFrictionImpulses = false;

    this.context = graphics;
  }

  b2TransformPointOut(t: b2Transform, p: b2Vec2, out: b2Vec2) {
    out.x = t.q.c * p.x - t.q.s * p.y + t.p.x;
    out.y = t.q.s * p.x + t.q.c * p.y + t.p.y;
  }

  DrawPolygon(xf: b2Transform, vs: b2Vec2[], ps: number, col: number, graphics: Graphics) {
    const p0 = this.p0;
    const scale = this.scale;

    const cX = (this.width >> 1) + this.positionOffset.x;
    const cY = (this.height >> 1) + this.positionOffset.y;

    const points = [];

    for (let i = 0; i < ps; i++) {
      this.b2TransformPointOut(xf, vs[i], p0);

      p0.y = -p0.y;

      const x = scale * p0.x + cX;
      const y = scale * p0.y + cY;

      points.push({ x, y });
    }

    graphics.lineStyle(1, col, 1);

    //graphics.lineStyle(1, col, 1);
    //graphics.strokePoints(points as Phaser.Math.Vector2[], false, true);
  }

  DrawSolidPolygon(xf: b2Transform, vs: b2Vec2[], ps: number, rad: number, col: number, graphics: Graphics) {
    const p0 = this.p0;
    const scale = this.scale;

    const cX = (this.width >> 1) + this.positionOffset.x;
    const cY = (this.height >> 1) + this.positionOffset.y;

    const points = [];

    for (let i = 0; i < ps; i++) {
      this.b2TransformPointOut(xf, vs[i], p0);

      p0.y = -p0.y;

      const x = scale * p0.x + cX;
      const y = scale * p0.y + cY;

      points.push({ x, y });
    }

    //    console.log(points, col);

    graphics.poly(points);
    //graphics.fill(col);
    graphics.stroke({ width: 1, color: col });
  }

  DrawCircle(center: b2Vec2, rad: number, col: number, graphics: Graphics) {
    const scale = this.scale;

    const cX = (this.width >> 1) + this.positionOffset.x;
    const cY = (this.height >> 1) + this.positionOffset.y;

    const transformedCenterX = scale * cX + cX;
    const transformedCenterY = -(scale * cY + cY);

    graphics.circle(transformedCenterX, transformedCenterY, rad * scale);
    //graphics.fill(col);
    graphics.stroke({ width: 1, color: col });
  }

  DrawSolidCircle(xf: b2Transform, rad: number, col: number, graphics: Graphics) {
    const scale = this.scale;

    const cX = (this.width >> 1) + this.positionOffset.x;
    const cY = (this.height >> 1) + this.positionOffset.y;

    const transformedCenterX = scale * xf.p.x + cX;
    const transformedCenterY = -(scale * xf.p.y) + cY;

    const scaledRadius = rad * scale;

    graphics
      .circle(transformedCenterX, transformedCenterY, scaledRadius)
      .fill({ color: col, alpha: 0.5 })
      .stroke({ width: 1, color: col });
  }

  DrawSolidCapsule(p1: b2Vec2, p2: b2Vec2, radius: number, col: number, graphics: Graphics) {
    const scale = this.scale;

    const cX = (this.width >> 1) + this.positionOffset.x;
    const cY = (this.height >> 1) + this.positionOffset.y;

    const transformedP1X = scale * p1.x + cX;
    const transformedP1Y = scale * -p1.y + cY;
    const transformedP2X = scale * p2.x + cX;
    const transformedP2Y = scale * -p2.y + cY;

    const dx = transformedP2X - transformedP1X;
    const dy = transformedP2Y - transformedP1Y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    graphics.save();
    graphics.translateCanvas(transformedP1X, transformedP1Y);
    graphics.rotateCanvas(angle);

    graphics.fillStyle(col, 0.5);
    graphics.lineStyle(1, col, 1);

    graphics.beginPath();

    graphics.arc(0, 0, radius * scale, Math.PI / 2, -Math.PI / 2);
    graphics.lineTo(length, -radius * scale);
    graphics.arc(length, 0, radius * scale, -Math.PI / 2, Math.PI / 2);
    graphics.lineTo(0, radius * scale);

    graphics.closePath();

    graphics.fill();
    graphics.stroke();

    graphics.restore();
  }

  DrawSegment(p1: b2Vec2, p2: b2Vec2, col: number, graphics: Graphics) {
    const scale = this.scale;

    const cX = (this.width >> 1) + this.positionOffset.x;
    const cY = (this.height >> 1) + this.positionOffset.y;

    const v1X = scale * p1.x + cX;
    const v1Y = scale * -p1.y + cY;
    const v2X = scale * p2.x + cX;
    const v2Y = scale * -p2.y + cY;

    graphics.moveTo(v1X, v1Y);
    graphics.lineTo(v2X, v2Y);
    graphics.stroke({ width: scale * 0.1, color: col });
  }

  DrawPoint(x: number, y: number, radius: number, col: number, graphics: Graphics) {
    const transform = {
      p: { x, y },
      q: { c: 1, s: 0 },
    } as b2Transform;

    this.DrawSolidCircle(transform, radius, col, graphics);
  }

  SetPosition(x: number, y: number) {
    // use half width and height to make the virtual 'camera' look at (x, y)
    this.positionOffset.x = x - this.width / 2;
    this.positionOffset.y = this.height / 2 - y;
  }

  DrawImagePolygon(xf: b2Transform, shape: any, ctx: any) {
    //  NOOP
  }

  DrawImageCircle(xf: b2Transform, rad: number, shape: any, ctx: any) {
    //  NOOP
  }

  DrawImageCapsule(p1: b2Vec2, p2: b2Vec2, radius: number, shape: any, ctx: any) {
    //  NOOP
  }
}
