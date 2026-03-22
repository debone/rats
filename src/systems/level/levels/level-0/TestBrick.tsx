const mountEffect = (effect: () => void) => {
  effect();
};

const Brick = ({
  bodyId,
  powerup,
  onHit,
  onBreak,
}: {
  bodyId: string;
  powerup: 'blue' | 'yellow' | 'green';
  onHit: () => void;
  onBreak: () => void;
}) => {
  // const systems = context.Systems();
  // useEffect = mountSprites/mountCollision + registrations array.
  // The return value IS the cleanup — same as registrations.push(() => ...)
  mountEffect(() => {
    // const sprite = new Sprite(bg['bricks_tile_1#0']);
    // systems.renderer.add(sprite, bodyId);
    // return () => systems.renderer.remove(sprite);
  });

  mountEffect(() => {
    //systems.collision.add(bodyId, { tag: 'brick', handlers: { ball: hit } });
    //return () => systems.collision.remove(bodyId);
  });

  let destroyed = false;

  function hit() {
    if (destroyed) return;
    // def.onHit?.(context);
    // debrisEmitter.explode(8, ...BodyToScreen(bodyId));
    // def.onBreak?.(/* self */);
    destroyed = true; // triggers all useEffect cleanups = registrations.forEach(cleanup)
  }

  // The return value is the "render" — not JSX, but the entity API
  return { bodyId, hit };
};

const BlueBrick = ({ bodyId }: { bodyId: string }) => <Brick bodyId={bodyId} powerup="blue" />;

export function Spawn(bodyId: string, ...props: any[]) {
  // ...
  return <BlueBrick bodyId={bodyId} {...props} />;
}

/*
<Spawn>
  <BlueBrick onHit={()=>{badam();}}/>
  <BlueBrick onHit={()=>{badam();}} onBreak={()=>{tssss();}}/>
</Spawn>
*/
