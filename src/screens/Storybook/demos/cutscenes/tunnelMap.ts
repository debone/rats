import { animate } from 'animejs';
import { Container, Graphics, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

interface MapNode {
  x: number;
  y: number;
  label: string;
  isObjective: boolean;
}

const NODES: MapNode[] = [
  { x: 0.12, y: 0.35, label: 'ENTRY', isObjective: false },
  { x: 0.35, y: 0.25, label: 'PIPE A', isObjective: false },
  { x: 0.35, y: 0.60, label: 'DRAIN', isObjective: false },
  { x: 0.60, y: 0.35, label: 'JUNCTION', isObjective: false },
  { x: 0.82, y: 0.25, label: 'VAULT', isObjective: true },
  { x: 0.82, y: 0.65, label: 'EXIT', isObjective: false },
];

const CONNECTIONS = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [3, 4],
  [3, 5],
];

// Highlighted path: entry → pipe A → junction → vault
const ROUTE = [0, 1, 3, 4];

export function tunnelMap(root: Container, w: number, h: number): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill(0x050a08);
  bg.alpha = 0;
  root.addChild(bg);

  // Scan lines texture effect
  const scan = new Graphics();
  for (let y = 0; y < h; y += 4) {
    scan
      .rect(0, y, w, 1)
      .fill({ color: 0x000000, alpha: 0.15 });
  }
  scan.alpha = 0;
  root.addChild(scan);

  const titleText = new Text({
    text: 'TUNNEL SCAN  //  SECTOR 7',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 7, letterSpacing: 3, fill: 0x3a6a3a },
  });
  titleText.x = 8;
  titleText.y = 7;
  titleText.alpha = 0;
  root.addChild(titleText);

  // Connection lines
  const connLines: Graphics[] = CONNECTIONS.map(() => {
    const g = new Graphics();
    root.addChild(g);
    return g;
  });

  // Route highlight lines
  const routeLines: Graphics[] = [];
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const g = new Graphics();
    root.addChild(g);
    routeLines.push(g);
  }

  // Node dots and labels
  const nodeDots: Graphics[] = [];
  const nodeLabels: Text[] = [];

  NODES.forEach((node) => {
    const nx = node.x * w;
    const ny = node.y * h;

    const dot = new Graphics();
    dot
      .circle(nx, ny, node.isObjective ? 5 : 3)
      .fill(node.isObjective ? 0x2a6a2a : 0x1a3a1a)
      .stroke({ color: node.isObjective ? 0x4aaa4a : 0x2a5a2a, width: 1 });
    dot.alpha = 0;
    root.addChild(dot);
    nodeDots.push(dot);

    const lbl = new Text({
      text: node.label,
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 6, fill: node.isObjective ? 0x6aaa6a : 0x3a5a3a },
    });
    lbl.anchor.set(0.5, 1);
    lbl.x = nx;
    lbl.y = ny - 7;
    lbl.alpha = 0;
    root.addChild(lbl);
    nodeLabels.push(lbl);
  });

  const confirmedText = new Text({
    text: '▶  ROUTE CONFIRMED',
    style: { ...TEXT_STYLE_DEFAULT, fontSize: 8, letterSpacing: 3, fill: 0x44aa44 },
  });
  confirmedText.anchor.set(0.5);
  confirmedText.x = w / 2;
  confirmedText.y = h - 12;
  confirmedText.alpha = 0;
  root.addChild(confirmedText);

  const drawConn = (g: Graphics, fromNode: MapNode, toNode: MapNode, progress: number, color: number, alpha: number) => {
    const x1 = fromNode.x * w;
    const y1 = fromNode.y * h;
    const x2 = toNode.x * w;
    const y2 = toNode.y * h;
    g
      .clear()
      .moveTo(x1, y1)
      .lineTo(x1 + (x2 - x1) * progress, y1 + (y2 - y1) * progress)
      .stroke({ color, width: 1, alpha });
  };

  const play = async () => {
    if (cancelled) return;

    bg.alpha = 0;
    scan.alpha = 0;
    titleText.alpha = 0;
    connLines.forEach((g) => g.clear());
    routeLines.forEach((g) => g.clear());
    nodeDots.forEach((d) => {
      d.alpha = 0;
    });
    nodeLabels.forEach((l) => {
      l.alpha = 0;
    });
    confirmedText.alpha = 0;

    await animate(bg, { alpha: 1, duration: 400 });
    if (cancelled) return;

    await animate(scan, { alpha: 1, duration: 300 });
    if (cancelled) return;

    await animate(titleText, { alpha: 1, duration: 350 });
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 300);
    });
    if (cancelled) return;

    // Draw connection lines one by one
    for (let ci = 0; ci < CONNECTIONS.length; ci++) {
      if (cancelled) return;
      const [fromIdx, toIdx] = CONNECTIONS[ci];
      const from = NODES[fromIdx];
      const to = NODES[toIdx];
      const g = connLines[ci];

      const lp = { p: 0 };
      await animate(lp, {
        p: 1,
        duration: 250,
        ease: 'outQuad',
        onUpdate: () => {
          drawConn(g, from, to, lp.p, 0x1a4a1a, 0.6);
        },
      });

      await new Promise<void>((res) => {
        timer = setTimeout(res, 60);
      });
    }
    if (cancelled) return;

    // Nodes appear
    await Promise.all(
      nodeDots.map((dot, i) =>
        animate(dot, {
          alpha: 1,
          scaleX: [0, 1],
          scaleY: [0, 1],
          duration: 220,
          ease: 'outBack(2)',
          delay: i * 60,
        }),
      ),
    );

    await Promise.all(nodeLabels.map((lbl, i) => animate(lbl, { alpha: 1, duration: 180, delay: i * 60 })));
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 400);
    });
    if (cancelled) return;

    // Route animates in brighter green
    for (let ri = 0; ri < ROUTE.length - 1; ri++) {
      if (cancelled) return;
      const from = NODES[ROUTE[ri]];
      const to = NODES[ROUTE[ri + 1]];
      const g = routeLines[ri];

      const lp = { p: 0 };
      await animate(lp, {
        p: 1,
        duration: 300,
        ease: 'outQuad',
        onUpdate: () => {
          drawConn(g, from, to, lp.p, 0x44aa44, 1);
        },
      });

      // Pulse the destination node
      animate(nodeDots[ROUTE[ri + 1]], { scaleX: [1.5, 1], scaleY: [1.5, 1], duration: 200, ease: 'outBack' });
    }
    if (cancelled) return;

    await animate(confirmedText, { alpha: 1, duration: 350 });
    if (cancelled) return;

    // Pulse the objective node
    const objDot = nodeDots[4];
    animate(objDot, { alpha: [1, 0.3, 1], duration: 600, loop: true });

    await new Promise<void>((res) => {
      timer = setTimeout(res, 2200);
    });
    if (cancelled) return;

    await Promise.all([
      animate(bg, { alpha: 0, duration: 500 }),
      animate(scan, { alpha: 0, duration: 400 }),
      animate(titleText, { alpha: 0, duration: 350 }),
      animate(confirmedText, { alpha: 0, duration: 350 }),
      ...nodeDots.map((d) => animate(d, { alpha: 0, duration: 300 })),
      ...nodeLabels.map((l) => animate(l, { alpha: 0, duration: 300 })),
    ]);
    connLines.forEach((g) => g.clear());
    routeLines.forEach((g) => g.clear());
    if (cancelled) return;

    await new Promise<void>((res) => {
      timer = setTimeout(res, 600);
    });
    if (!cancelled) play();
  };

  play();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    [bg, scan, titleText, confirmedText, ...connLines, ...routeLines, ...nodeDots, ...nodeLabels].forEach((e) =>
      e.destroy(),
    );
  };
}
