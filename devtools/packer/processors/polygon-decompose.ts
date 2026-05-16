/**
 * Concave-to-convex polygon decomposition.
 *
 * Box2D's b2CreatePolygonShape only accepts convex polygons (with at most
 * b2_maxPolygonVertices = 8 vertices). Godot's CollisionPolygon2D in SOLIDS
 * mode lets authors draw arbitrary simple polygons; we decompose at export
 * time so the runtime stays simple.
 *
 * Implements Bayazit's hertel-mehlhorn variant: pick a reflex vertex, find
 * the best vertex to draw a diagonal to, split the polygon along that
 * diagonal, recurse. Produces O(n) convex pieces for a simple polygon.
 */

type V2 = { x: number; y: number };

const MAX_B2_VERTS = 8;

function cross(a: V2, b: V2, c: V2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function isReflex(prev: V2, curr: V2, next: V2, ccw: boolean): boolean {
  const c = cross(prev, curr, next);
  return ccw ? c < 0 : c > 0;
}

function polygonArea(poly: V2[]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function isConvex(poly: V2[]): boolean {
  if (poly.length <= 3) return true;
  const ccw = polygonArea(poly) > 0;
  for (let i = 0; i < poly.length; i++) {
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const curr = poly[i];
    const next = poly[(i + 1) % poly.length];
    if (isReflex(prev, curr, next, ccw)) return false;
  }
  return true;
}

/**
 * Decompose a simple polygon into convex pieces, each with ≤ MAX_B2_VERTS
 * vertices. Input polygon must be simple (non-self-intersecting); winding
 * direction is detected automatically.
 */
export function decomposePolygon(poly: V2[]): V2[][] {
  if (poly.length < 3) return [];
  // Normalize to CCW for the algorithm
  const ccw = polygonArea(poly) > 0;
  const work = ccw ? poly.slice() : poly.slice().reverse();

  const pieces = isConvex(work) ? [work] : bayazitDecompose(work);

  // Cap each piece at MAX_B2_VERTS by fan-splitting if needed.
  const out: V2[][] = [];
  for (const piece of pieces) {
    if (piece.length <= MAX_B2_VERTS) {
      out.push(piece);
    } else {
      // Fan-split from vertex 0
      for (let i = 1; i + 1 < piece.length; i += MAX_B2_VERTS - 2) {
        const slice: V2[] = [piece[0]];
        for (let k = 0; k < MAX_B2_VERTS - 1 && i + k < piece.length; k++) {
          slice.push(piece[i + k]);
        }
        if (slice.length >= 3) out.push(slice);
      }
    }
  }
  return out;
}

function at<T>(arr: T[], i: number): T {
  const n = arr.length;
  return arr[((i % n) + n) % n];
}

function bayazitDecompose(poly: V2[]): V2[][] {
  if (poly.length < 4) return [poly];

  // Find a reflex vertex (CCW input, reflex means cross < 0)
  for (let i = 0; i < poly.length; i++) {
    const prev = at(poly, i - 1);
    const curr = poly[i];
    const next = at(poly, i + 1);
    if (cross(prev, curr, next) >= 0) continue;

    // Reflex at i — find the best vertex j to draw a diagonal to.
    let bestJ = -1;
    let bestDist = Infinity;
    for (let j = 0; j < poly.length; j++) {
      if (j === i || j === ((i - 1 + poly.length) % poly.length) || j === (i + 1) % poly.length) continue;
      if (!diagonalLiesInside(poly, i, j)) continue;
      const dx = poly[j].x - curr.x;
      const dy = poly[j].y - curr.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestJ = j;
      }
    }
    if (bestJ < 0) {
      // Fall back to fan triangulation
      return fanTriangulate(poly);
    }

    // Split poly along i..bestJ
    const left: V2[] = [];
    const right: V2[] = [];
    let k = i;
    while (true) {
      left.push(poly[k]);
      if (k === bestJ) break;
      k = (k + 1) % poly.length;
    }
    k = bestJ;
    while (true) {
      right.push(poly[k]);
      if (k === i) break;
      k = (k + 1) % poly.length;
    }
    return [...bayazitDecompose(left), ...bayazitDecompose(right)];
  }
  return [poly];
}

function diagonalLiesInside(poly: V2[], i: number, j: number): boolean {
  // A diagonal lies inside if the segment poly[i]→poly[j] doesn't intersect
  // any non-adjacent edge, and the midpoint is strictly inside the polygon.
  const n = poly.length;
  for (let k = 0; k < n; k++) {
    const a = poly[k];
    const b = at(poly, k + 1);
    if (k === i || k === j) continue;
    if ((k + 1) % n === i || (k + 1) % n === j) continue;
    if (segmentsIntersect(poly[i], poly[j], a, b)) return false;
  }
  const mid = { x: (poly[i].x + poly[j].x) / 2, y: (poly[i].y + poly[j].y) / 2 };
  return pointInPolygon(mid, poly);
}

function segmentsIntersect(p1: V2, p2: V2, p3: V2, p4: V2): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return false;
}

function pointInPolygon(pt: V2, poly: V2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function fanTriangulate(poly: V2[]): V2[][] {
  const out: V2[][] = [];
  for (let i = 1; i + 1 < poly.length; i++) {
    out.push([poly[0], poly[i], poly[i + 1]]);
  }
  return out;
}
