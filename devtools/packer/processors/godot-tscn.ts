/**
 * Shared Godot 4 .tscn parser primitives.
 *
 * The .tscn format is INI-like: a sequence of [section_type attr="v" ...] headers
 * followed by key = value bodies. Multi-line brace blocks are common
 * (animation keys, big dictionaries). This module turns a .tscn file into a flat
 * list of sections; downstream processors interpret the sections (cutscenes,
 * geometry, etc.).
 */

export interface TscnSection {
  /** Section type: "gd_scene", "ext_resource", "sub_resource", "node" */
  type: string;
  /** Attributes from the section header, still quoted */
  attrs: Record<string, string>;
  /** Key=value pairs from the section body */
  props: Map<string, string>;
}

export function parseTscnSections(content: string): TscnSection[] {
  const headerRe = /^\[([^\]]+)\]/gm;
  const matches = [...content.matchAll(headerRe)];
  const sections: TscnSection[] = [];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const headerContent = m[1];
    const bodyStart = m.index! + m[0].length;
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].index! : content.length;
    const body = content.slice(bodyStart, bodyEnd);

    const spaceIdx = headerContent.search(/\s/);
    const type = spaceIdx >= 0 ? headerContent.slice(0, spaceIdx) : headerContent;
    const attrStr = spaceIdx >= 0 ? headerContent.slice(spaceIdx) : '';

    const attrs: Record<string, string> = {};
    // Matches: key="quoted", key=ExtResource("..."), key=SubResource("..."), key=bareValue
    const attrRe = /(\w+)=("(?:[^"\\]|\\.)*"|(?:Ext|Sub)Resource\("[^"]+"\)|[\w./:{}@-]+)/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(attrStr)) !== null) {
      attrs[am[1]] = am[2];
    }

    sections.push({ type, attrs, props: parseProps(body) });
  }

  return sections;
}

export function parseProps(body: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = body.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const eqIdx = line.indexOf(' = ');
    if (eqIdx < 0) {
      i++;
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 3).trimEnd();

    if (value.trimStart().startsWith('{') || value.trimStart().startsWith('[')) {
      const open = value.trimStart()[0];
      const close = open === '{' ? '}' : ']';
      let depth = countChar(value, open) - countChar(value, close);
      i++;
      while (i < lines.length && depth > 0) {
        value += '\n' + lines[i];
        depth += countChar(lines[i], open) - countChar(lines[i], close);
        i++;
      }
    } else {
      i++;
    }

    if (key) result.set(key, value.trim());
  }

  return result;
}

export function countChar(str: string, ch: string): number {
  let n = 0;
  for (let i = 0; i < str.length; i++) if (str[i] === ch) n++;
  return n;
}

export function unquote(s: string): string {
  return s.replace(/^"|"$/g, '');
}

/**
 * Parse a Vector2(x, y) literal. Returns null if the string is not a Vector2.
 */
export function parseVector2(s: string): { x: number; y: number } | null {
  const m = s.match(/^Vector2\(\s*([^,]+),\s*([^)]+)\)\s*$/);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

/**
 * Parse a Transform2D(rot_x, rot_y, skew_x, skew_y, origin_x, origin_y) literal.
 * Returns null if the string is not a Transform2D.
 *
 * Godot 4 stores Transform2D as two basis vectors (first column = X axis,
 * second column = Y axis) plus an origin. For a node with rotation θ and
 * scale (sx, sy):
 *   x_axis = (cos θ · sx,  sin θ · sx)
 *   y_axis = (-sin θ · sy, cos θ · sy)
 */
export function parseTransform2D(
  s: string,
): { rotation: number; scale: { x: number; y: number }; origin: { x: number; y: number } } | null {
  const m = s.match(/^Transform2D\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)\s*$/);
  if (!m) return null;
  const xAxisX = parseFloat(m[1]);
  const xAxisY = parseFloat(m[2]);
  const yAxisX = parseFloat(m[3]);
  const yAxisY = parseFloat(m[4]);
  const originX = parseFloat(m[5]);
  const originY = parseFloat(m[6]);

  const rotation = Math.atan2(xAxisY, xAxisX);
  const scaleX = Math.hypot(xAxisX, xAxisY);
  // Sign of scaleY: positive if (xAxis ⟂ yAxis) preserves CCW orientation.
  const det = xAxisX * yAxisY - xAxisY * yAxisX;
  const scaleY = Math.hypot(yAxisX, yAxisY) * Math.sign(det || 1);
  return { rotation, scale: { x: scaleX, y: scaleY }, origin: { x: originX, y: originY } };
}

/**
 * Parse a PackedVector2Array(x1, y1, x2, y2, ...) literal into [{x,y}, ...].
 * Used for CollisionPolygon2D's polygon property.
 */
export function parsePackedVector2Array(s: string): { x: number; y: number }[] {
  const m = s.match(/PackedVector2Array\(([\s\S]*?)\)/);
  if (!m) return [];
  const nums = m[1]
    .split(',')
    .map((t) => parseFloat(t.trim()))
    .filter((n) => !isNaN(n));
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    out.push({ x: nums[i], y: nums[i + 1] });
  }
  return out;
}

/**
 * Extract metadata/<key> = <value> entries from a node's props.
 * Values are returned as Godot literal strings (caller decodes).
 */
export function extractMetadata(props: Map<string, string>): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const [key, value] of props) {
    if (key.startsWith('metadata/')) {
      meta[key.slice('metadata/'.length)] = value;
    }
  }
  return meta;
}

/**
 * Decode a Godot literal value (number, bool, string, Vector2, Dictionary)
 * into the matching JS value. Used for metadata values and @export properties.
 */
export function decodeGodotValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  const v2 = parseVector2(trimmed);
  if (v2) return v2;
  if (trimmed.startsWith('{')) {
    return parseGodotDictionary(trimmed);
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return unquote(trimmed).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return trimmed;
}

/**
 * Parse a Godot 4 Dictionary literal: `{"key1": value1, "key2": value2, ...}`.
 * Keys may be plain strings ("foo") or StringNames (&"foo"). Values are decoded
 * via decodeGodotValue. Multi-line is supported (the parseProps caller already
 * accumulates the full brace block).
 */
export function parseGodotDictionary(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return {};
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return {};

  const segments = splitTopLevel(inner, ',');
  const out: Record<string, unknown> = {};
  for (const seg of segments) {
    const colonIdx = findTopLevelColon(seg);
    if (colonIdx < 0) continue;
    const keyRaw = seg.slice(0, colonIdx).trim();
    const valRaw = seg.slice(colonIdx + 1).trim();
    let key: string | null = null;
    if (keyRaw.startsWith('&"') && keyRaw.endsWith('"')) {
      key = keyRaw.slice(2, -1).replace(/\\"/g, '"');
    } else if (keyRaw.startsWith('"') && keyRaw.endsWith('"')) {
      key = keyRaw.slice(1, -1).replace(/\\"/g, '"');
    }
    if (key !== null) out[key] = decodeGodotValue(valRaw);
  }
  return out;
}

/** Split a string at top-level occurrences of `sep`, respecting brackets and quoted strings. */
function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inString = false;
  let segStart = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && (i === 0 || s[i - 1] !== '\\')) inString = !inString;
    if (inString) continue;
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === sep && depth === 0) {
      out.push(s.slice(segStart, i));
      segStart = i + 1;
    }
  }
  if (segStart <= s.length) out.push(s.slice(segStart));
  return out;
}

function findTopLevelColon(s: string): number {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && (i === 0 || s[i - 1] !== '\\')) inString = !inString;
    if (inString) continue;
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ':' && depth === 0) return i;
  }
  return -1;
}
