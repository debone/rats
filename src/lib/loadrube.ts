/*
 * Author: Chris Campbell - www.iforce2d.net
 *
 * This software is provided 'as-is', without any express or implied
 * warranty.  In no event will the authors be held liable for any damages
 * arising from the use of this software.
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 * 1. The origin of this software must not be misrepresented; you must not
 * claim that you wrote the original software. If you use this software
 * in a product, an acknowledgment in the product documentation would be
 * appreciated but is not required.
 * 2. Altered source versions must be plainly marked as such, and must not be
 * misrepresented as being the original software.
 */

import {
  b2Body_SetUserData,
  b2BodyId,
  b2BodyType,
  b2Circle,
  b2ComputeHull,
  b2CreateBody,
  b2CreateCircleShape,
  b2CreateDistanceJoint,
  b2CreatePolygonShape,
  b2CreatePrismaticJoint,
  b2CreateRevoluteJoint,
  b2CreateSegmentShape,
  b2CreateWeldJoint,
  b2DefaultBodyDef,
  b2DefaultPrismaticJointDef,
  b2DefaultRevoluteJointDef,
  b2DefaultShapeDef,
  b2DefaultWorldDef,
  b2DistanceJointDef,
  b2Joint_SetUserData,
  b2MakePolygon,
  b2MakeRot,
  b2MotorJointDef,
  b2PrismaticJointDef,
  b2RevoluteJointDef,
  b2Segment,
  b2Shape_SetUserData,
  b2ShapeId,
  b2Vec2,
  b2WeldJointDef,
  b2WheelJointDef,
  b2WorldDef,
  b2WorldId,
  CreateWorld,
} from 'phaser-box2d';

function loadBodyFromRUBE(bodyJson: any, world: b2WorldId) {
  //console.log(bodyJso);

  if (!bodyJson.hasOwnProperty('type')) {
    console.log("Body does not have a 'type' property");
    return null;
  }

  const bd = b2DefaultBodyDef();

  if (bodyJson.type == 2) {
    bd.type = b2BodyType.b2_dynamicBody;
  } else if (bodyJson.type == 1) {
    bd.type = b2BodyType.b2_kinematicBody;
  }

  if (bodyJson.hasOwnProperty('angle')) {
    bd.rotation = b2MakeRot(bodyJson.angle);
  } else {
    bd.rotation = b2MakeRot(0);
  }

  if (bodyJson.hasOwnProperty('angularVelocity')) {
    bd.angularVelocity = bodyJson.angularVelocity;
  } else {
    bd.angularVelocity = 0;
  }

  if (bodyJson.hasOwnProperty('active')) {
    bd.isAwake = bodyJson.active;
  } else {
    bd.isAwake = false;
  }

  if (bodyJson.hasOwnProperty('fixedRotation')) {
    bd.fixedRotation = bodyJson.fixedRotation;
  } else {
    bd.fixedRotation = false;
  }

  if (bodyJson.hasOwnProperty('linearVelocity') && bodyJson.linearVelocity instanceof Object) {
    bd.linearVelocity = bodyJson.linearVelocity;
  }

  if (bodyJson.hasOwnProperty('position') && bodyJson.position instanceof Object) {
    bd.position.copy(bodyJson.position);
  }

  if (bodyJson.hasOwnProperty('awake')) {
    bd.isAwake = bodyJson.awake;
  } else {
    bd.isAwake = false;
  }

  if (bodyJson.hasOwnProperty('allowSleep')) {
    bd.enableSleep = bodyJson.allowSleep;
  }

  if (bodyJson.hasOwnProperty('bullet')) {
    bd.isBullet = bodyJson.bullet;
  }

  const bodyId = b2CreateBody(world, bd);

  if (bodyJson.hasOwnProperty('fixture')) {
    for (let k = 0; k < bodyJson['fixture'].length; k++) {
      loadFixtureFromRUBE(bodyId, bodyJson['fixture'][k]);
    }
  }

  if (bodyJson.hasOwnProperty('name')) {
    (bodyId as any).name = bodyJson.name;
  }

  if (bodyJson.hasOwnProperty('customProperties')) {
    b2Body_SetUserData(bodyId, mergeCustomProperties(bodyJson.customProperties));
  }

  return bodyId;
}

export function loadFixtureFromRUBE(bodyId: b2BodyId, fixtureJson: any) {
  console.log(fixtureJson);

  const fd = b2DefaultShapeDef();

  if (fixtureJson.hasOwnProperty('friction')) {
    fd.friction = fixtureJson.friction;
  } else {
    fd.friction = 0;
  }

  if (fixtureJson.hasOwnProperty('density')) {
    fd.density = fixtureJson.density;
  } else {
    fd.density = 0;
  }

  if (fixtureJson.hasOwnProperty('restitution')) {
    fd.restitution = fixtureJson.restitution;
  } else {
    fd.restitution = 0;
  }

  if (fixtureJson.hasOwnProperty('sensor')) {
    fd.isSensor = fixtureJson.sensor;
  } else {
    fd.isSensor = false;
  }

  if (fixtureJson.hasOwnProperty('filter-categoryBits')) {
    fd.filter.categoryBits = fixtureJson['filter-categoryBits'];
  }
  if (fixtureJson.hasOwnProperty('filter-maskBits')) {
    fd.filter.maskBits = fixtureJson['filter-maskBits'];
  }
  if (fixtureJson.hasOwnProperty('filter-groupIndex')) {
    fd.filter.groupIndex = fixtureJson['filter-groupIndex'];
  }

  let fixture: b2ShapeId | null = null;

  if (fixtureJson.hasOwnProperty('circle')) {
    //fd.shape = b2MakeCircle(fixtureJson.circle.radius);
    const circleShape = new b2Circle(
      new b2Vec2(fixtureJson.circle.center.x || 0, fixtureJson.circle.center.y || 0),
      fixtureJson.circle.radius,
    );
    //const circleShape = b2CreateCircleShape(fixtureJson.circle.radius);

    if (fixtureJson.circle.center) {
      //fd.shape.m_p.SetV(fixtureJson.circle.center);
    }

    fixture = b2CreateCircleShape(bodyId, fd, circleShape);

    if (fixtureJson.name) {
      (fixture as any).name = fixtureJson.name;
    }
  } else if (fixtureJson.hasOwnProperty('polygon')) {
    const verts = [];
    for (let v = 0; v < fixtureJson.polygon.vertices.x.length; v++) {
      verts.push(new b2Vec2(fixtureJson.polygon.vertices.x[v], fixtureJson.polygon.vertices.y[v]));
    }
    const hull = b2ComputeHull(verts, verts.length);
    const polygonShape = b2MakePolygon(hull, 0);

    fixture = b2CreatePolygonShape(bodyId, fd, polygonShape);
    if (fixture && fixtureJson.name) {
      (fixture as any).name = fixtureJson.name;
    }
  } else if (fixtureJson.hasOwnProperty('chain')) {
    //fd.shape = new b2PolygonShape();
    let lastVertex = new b2Vec2();
    for (let v = 0; v < fixtureJson.chain.vertices.x.length; v++) {
      let thisVertex = new b2Vec2(fixtureJson.chain.vertices.x[v], fixtureJson.chain.vertices.y[v]);

      if (v > 0) {
        //fd.shape.SetAsEdge(lastVertex, thisVertex);
        //var fixture = body.CreateFixture(fd);

        const segmentShape = new b2Segment(lastVertex, thisVertex);
        fixture = b2CreateSegmentShape(bodyId, fd, segmentShape);
        if (fixtureJson.name) {
          (fixture as any).name = fixtureJson.name;
        }
      }
      lastVertex = thisVertex;
    }
  } else {
    console.log('Could not find shape type for fixture');
  }

  if (fixture && fixtureJson.hasOwnProperty('customProperties')) {
    b2Shape_SetUserData(fixture, mergeCustomProperties(fixtureJson.customProperties));
  }
}

function loadJointCommonProperties(
  jd:
    | b2MotorJointDef
    | b2WeldJointDef
    | b2DistanceJointDef
    | b2PrismaticJointDef
    | b2RevoluteJointDef
    | b2WheelJointDef,
  jointJson: any,
  loadedBodies: b2BodyId[],
) {
  jd.bodyIdA = loadedBodies[jointJson.bodyA];
  jd.bodyIdB = loadedBodies[jointJson.bodyB];

  if (!(jd instanceof b2MotorJointDef)) {
    if (jointJson.hasOwnProperty('anchorA')) {
      jd.localAnchorA = new b2Vec2(jointJson.anchorA.x || 0, jointJson.anchorA.y || 0);
    }
    if (jointJson.hasOwnProperty('anchorB')) {
      jd.localAnchorB = new b2Vec2(jointJson.anchorB.x || 0, jointJson.anchorB.y || 0);
    }
  }

  if (jointJson.collideConnected) {
    jd.collideConnected = jointJson.collideConnected;
  }
}

function loadJointFromRUBE(jointJson: any, world: b2WorldDef, loadedBodies: b2BodyId[]) {
  if (!jointJson.hasOwnProperty('type')) {
    console.log("Joint does not have a 'type' property");
    return null;
  }
  if (jointJson.bodyA >= loadedBodies.length) {
    console.log('Index for bodyA is invalid: ' + jointJson.bodyA);
    return null;
  }
  if (jointJson.bodyB >= loadedBodies.length) {
    console.log('Index for bodyB is invalid: ' + jointJson.bodyB);
    return null;
  }

  var joint = null;
  if (jointJson.type == 'revolute') {
    var jd = b2DefaultRevoluteJointDef();
    loadJointCommonProperties(jd, jointJson, loadedBodies);
    if (jointJson.hasOwnProperty('refAngle')) {
      jd.referenceAngle = jointJson.refAngle;
    }
    if (jointJson.hasOwnProperty('lowerLimit')) {
      jd.lowerAngle = jointJson.lowerLimit;
    }
    if (jointJson.hasOwnProperty('upperLimit')) {
      jd.upperAngle = jointJson.upperLimit;
    }
    if (jointJson.hasOwnProperty('maxMotorTorque')) {
      jd.maxMotorTorque = jointJson.maxMotorTorque;
    }
    if (jointJson.hasOwnProperty('motorSpeed')) {
      jd.motorSpeed = jointJson.motorSpeed;
    }
    if (jointJson.hasOwnProperty('enableLimit')) {
      jd.enableLimit = jointJson.enableLimit;
    }
    if (jointJson.hasOwnProperty('enableMotor')) {
      jd.enableMotor = jointJson.enableMotor;
    }

    joint = b2CreateRevoluteJoint(world, jd);
  } else if (jointJson.type == 'distance' || jointJson.type == 'rope') {
    if (jointJson.type == 'rope') {
      console.log('Replacing unsupported rope joint with distance joint!');
    }
    const jd = new b2DistanceJointDef();
    loadJointCommonProperties(jd, jointJson, loadedBodies);
    if (jointJson.hasOwnProperty('length')) {
      jd.length = jointJson.length;
    }
    if (jointJson.hasOwnProperty('dampingRatio')) {
      jd.dampingRatio = jointJson.dampingRatio;
    }
    if (jointJson.hasOwnProperty('frequency')) {
      jd.hertz = jointJson.frequency;
    }
    joint = b2CreateDistanceJoint(world, jd);
  } else if (jointJson.type == 'prismatic') {
    const jd = b2DefaultPrismaticJointDef();
    loadJointCommonProperties(jd, jointJson, loadedBodies);

    if (jointJson.hasOwnProperty('localAxisA')) {
      jd.localAxisA.copy(jointJson.localAxisA);
    }
    if (jointJson.hasOwnProperty('refAngle')) {
      jd.referenceAngle = jointJson.refAngle;
    }
    if (jointJson.hasOwnProperty('enableLimit')) {
      jd.enableLimit = jointJson.enableLimit;
    }
    if (jointJson.hasOwnProperty('lowerLimit')) {
      jd.lowerTranslation = jointJson.lowerLimit;
    }
    if (jointJson.hasOwnProperty('upperLimit')) {
      jd.upperTranslation = jointJson.upperLimit;
    }
    if (jointJson.hasOwnProperty('enableMotor')) {
      jd.enableMotor = jointJson.enableMotor;
    }
    if (jointJson.hasOwnProperty('maxMotorForce')) {
      jd.maxMotorForce = jointJson.maxMotorForce;
    }
    if (jointJson.hasOwnProperty('motorSpeed')) {
      jd.motorSpeed = jointJson.motorSpeed;
    }

    console.log(JSON.stringify(jointJson, null, 2));
    console.log(jd);

    joint = b2CreatePrismaticJoint(world, jd);
  } else if (jointJson.type == 'wheel') {
    throw new Error('Wheel joint is not supported');
    //Make a fake wheel joint using a line joint and a distance joint.
    //Return the line joint because it has the linear motor controls.
    //Use ApplyTorque on the bodies to spin the wheel...
    /*
    const jd = new b2WheelJointDef();
    loadJointCommonProperties(jd, jointJson, loadedBodies);
    
    jd.length = 0.0;
    if (jointJson.hasOwnProperty("springDampingRatio")) {
      jd.dampingRatio = jointJson.springDampingRatio;
    }
    if (jointJson.hasOwnProperty("springFrequency")) {
      jd.hertz = jointJson.springFrequency;
    }
    joint = b2CreateWheelJoint(world, jd);
    */
  } else if (jointJson.type == 'friction') {
    throw new Error('Friction joint is not supported');
    /*
    var jd = new b2FrictionJointDef();
    
    loadJointCommonProperties(jd, jointJson, loadedBodies);
    if (jointJso.hasOwnProperty("maxForce")) jd.maxForce = jointJso.maxForce;
    if (jointJso.hasOwnProperty("maxTorque")) jd.maxTorque = jointJso.maxTorque;
    joint = world.CreateJoint(jd); */
  } else if (jointJson.type == 'weld') {
    const jd = new b2WeldJointDef();
    loadJointCommonProperties(jd, jointJson, loadedBodies);
    if (jointJson.hasOwnProperty('referenceAngle')) {
      jd.referenceAngle = jointJson.referenceAngle;
    }
    joint = b2CreateWeldJoint(world, jd);
  } else {
    console.log('Unsupported joint type: ' + jointJson.type);
    console.log(jointJson);
  }

  if (joint) {
    if (jointJson.name) {
      (joint as any).name = jointJson.name;
    }
    if (jointJson.hasOwnProperty('customProperties')) {
      b2Joint_SetUserData(joint, mergeCustomProperties(jointJson.customProperties));
    }
  }

  return joint;
}

function makeClone(obj: any) {
  return JSON.parse(JSON.stringify(obj));
}

function loadImageFromRUBE(imageJson: any, loadedBodies: b2BodyId[]) {
  const image = makeClone(imageJson);

  if (image.hasOwnProperty('body') && image.body >= 0) {
    image.body = loadedBodies[image.body]; //change index to the actual body
  } else {
    image.body = null;
  }

  if (!image.hasOwnProperty('aspectScale')) {
    image.aspectScale = 1;
  }
  if (!image.hasOwnProperty('angle')) {
    image.angle = 0;
  }
  if (!image.hasOwnProperty('colorTint')) {
    image.colorTint = [255, 255, 255, 255];
  }

  image.center = new b2Vec2(imageJson.center.x || 0, imageJson.center.y || 0);

  return image;
}

//load the scene into an already existing world variable
export function loadSceneIntoWorld(worldJson: any, world: b2WorldId) {
  let success = true;

  let loadedBodies = [];
  if (worldJson.hasOwnProperty('body')) {
    for (let i = 0; i < worldJson.body.length; i++) {
      let bodyJson = worldJson.body[i];
      let body = loadBodyFromRUBE(bodyJson, world);

      if (body) {
        loadedBodies.push(body);
      } else {
        success = false;
      }
    }
  }

  let loadedJoints = [];
  if (worldJson.hasOwnProperty('joint')) {
    for (let i = 0; i < worldJson.joint.length; i++) {
      let jointJso = worldJson.joint[i];
      let joint = loadJointFromRUBE(jointJso, world, loadedBodies);
      if (joint) {
        loadedJoints.push(joint);
      } else {
        success = false;
      }
    }
  }

  let loadedImages = [];
  if (worldJson.hasOwnProperty('image')) {
    for (let i = 0; i < worldJson.image.length; i++) {
      const imageJson = worldJson.image[i];
      const image = loadImageFromRUBE(imageJson, loadedBodies);
      if (image) {
        loadedImages.push(image);
      } else {
        success = false;
      }
    }
    // TODO: images?
    (world as any).images = loadedImages;
  }

  if (loadedBodies.length === 0 && loadedJoints.length === 0 && loadedImages.length === 0) {
    throw new Error('No bodies, joints, or images found in RUBE file');
  }

  if (!success) {
    throw new Error('Failed to load RUBE file');
  }

  return { loadedBodies, loadedJoints, loadedImages };
}

//create a world variable and return it if loading succeeds
export function loadWorldFromRUBE(worldJson: any) {
  let world = b2DefaultWorldDef();

  let gravity = new b2Vec2(0, 0);
  if (worldJson.hasOwnProperty('gravity') && worldJson.gravity instanceof Object) {
    gravity = worldJson.gravity;
  }

  world.gravity = gravity;

  if (!loadSceneIntoWorld(worldJson, world)) return false;

  (world as any).worldId = CreateWorld({ worldDef: world }).worldId;

  return world;
}

///////////////////
// @ts-ignore
function getNamedBodies(world: b2WorldDef, name: string) {
  var bodies = [];
  // @ts-ignore
  for (let b = world.m_bodyList; b; b = b.m_next) {
    if (b.name == name) bodies.push(b);
  }
  return bodies;
}

// @ts-ignore
function getNamedFixtures(world: b2WorldDef, name: string) {
  var fixtures = [];
  // @ts-ignore
  for (let b = world.m_bodyList; b; b = b.m_next) {
    // @ts-ignore
    for (let f = b.m_fixtureList; f; f = f.m_next) {
      if (f.name == name) fixtures.push(f);
    }
  }
  return fixtures;
}

// @ts-ignore
function getNamedJoints(world: b2WorldDef, name: string) {
  var joints = [];
  // @ts-ignore
  for (let j = world.m_jointList; j; j = j.m_next) {
    if (j.name == name) joints.push(j);
  }
  return joints;
}

// @ts-ignore
function getNamedImages(world: b2WorldDef, name: string) {
  var images = [];
  // @ts-ignore
  for (let i = 0; i < world.images.length; i++) {
    // @ts-ignore
    if (world.images[i].name == name) images.push(world.images[i]);
  }
  return images;
}

////////////////

// @ts-ignore
function getNamedBody(world: b2WorldDef, name: string) {
  // @ts-ignore
  for (let b = world.m_bodyList; b; b = b.m_next) {
    if (b.name == name) return b;
  }
  return null;
}

// @ts-ignore
function getNamedFixture(world: b2WorldDef, name: string) {
  // @ts-ignore
  for (let b = world.m_bodyList; b; b = b.m_next) {
    for (let f = b.m_fixtureList; f; f = f.m_next) {
      if (f.name == name) return f;
    }
  }
  return null;
}

// @ts-ignore
function getNamedJoint(world: b2WorldDef, name: string) {
  // @ts-ignore
  for (let j = world.m_jointList; j; j = j.m_next) {
    if (j.name == name) return j;
  }
  return null;
}

// @ts-ignore
function getNamedImage(world: b2WorldDef, name: string) {
  // @ts-ignore
  for (let i = 0; i < world.images.length; i++) {
    // @ts-ignore
    if (world.images[i].name == name) return world.images[i];
  }
  return null;
}

////////////////

//custom properties
// TODO: this should be user data
// @ts-ignore
function getBodiesByCustomProperty(
  // @ts-ignore
  world,
  // @ts-ignore
  propertyType,
  // @ts-ignore
  propertyName,
  // @ts-ignore
  valueToMatch,
) {
  var bodies = [];
  for (let b = world.m_bodyList; b; b = b.m_next) {
    if (!b.hasOwnProperty('customProperties')) continue;
    for (var i = 0; i < b.customProperties.length; i++) {
      if (!b.customProperties[i].hasOwnProperty('name')) continue;
      if (!b.customProperties[i].hasOwnProperty(propertyType)) continue;
      if (b.customProperties[i].name == propertyName && b.customProperties[i][propertyType] == valueToMatch)
        bodies.push(b);
    }
  }
  return bodies;
}

// TODO: this should be user data
// @ts-ignore
function hasCustomProperty(item, propertyType, propertyName) {
  if (!item.hasOwnProperty('customProperties')) return false;
  for (var i = 0; i < item.customProperties.length; i++) {
    if (!item.customProperties[i].hasOwnProperty('name')) continue;
    if (!item.customProperties[i].hasOwnProperty(propertyType)) continue;
    return true;
  }
  return false;
}

// TODO: this should be user data
// @ts-ignore
function getCustomProperty(item, propertyType, propertyName, defaultValue) {
  if (!item.hasOwnProperty('customProperties')) return defaultValue;
  for (var i = 0; i < item.customProperties.length; i++) {
    if (!item.customProperties[i].hasOwnProperty('name')) continue;
    if (!item.customProperties[i].hasOwnProperty(propertyType)) continue;
    if (item.customProperties[i].name == propertyName) return item.customProperties[i][propertyType];
  }
  return defaultValue;
}

////////////////////////

// @ts-ignore
function arrayUnique(array: any[]) {
  return array.reduce(function (p, c) {
    if (p.indexOf(c) < 0) p.push(c);
    return p;
  }, []);
}

// @ts-ignore
function removeFromArray(array: any[], element: any) {
  const index = array.indexOf(element);
  if (index > -1) {
    array.splice(index, 1);
  }
}

function mergeCustomProperties(customProperties: any[]) {
  return customProperties.reduce((acc: any, curr: any) => {
    Object.keys(curr).forEach((key) => {
      if (key !== 'name') {
        acc[curr.name] = curr[key];
      }
    });
    return acc;
  }, {});
}
