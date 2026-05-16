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

    // Accumulate continuation lines whenever any bracket type is unbalanced.
    // This covers plain {}, [], () as well as typed wrappers like
    // Dictionary[String, Variant]({...}) or Array[int]([...]).
    let parenD = countChar(value, '(') - countChar(value, ')');
    let curlyD = countChar(value, '{') - countChar(value, '}');
    let squareD = countChar(value, '[') - countChar(value, ']');
    if (parenD > 0 || curlyD > 0 || squareD > 0) {
      i++;
      while (i < lines.length && (parenD > 0 || curlyD > 0 || squareD > 0)) {
        value += '\n' + lines[i];
        parenD += countChar(lines[i], '(') - countChar(lines[i], ')');
        curlyD += countChar(lines[i], '{') - countChar(lines[i], '}');
        squareD += countChar(lines[i], '[') - countChar(lines[i], ']');
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

/** Parse a Vector2i(x, y) literal. Returns null if the string is not a Vector2i. */
export function parseVector2i(s: string): { x: number; y: number } | null {
  const m = s.match(/^Vector2i\(\s*([^,]+),\s*([^)]+)\)\s*$/);
  if (!m) return null;
  return { x: parseInt(m[1].trim(), 10), y: parseInt(m[2].trim(), 10) };
}

/**
 * Decode a Godot `PackedByteArray(...)` literal into raw bytes. Handles both
 * forms emitted by Godot 4.3+: base64 (`PackedByteArray("base64-string")`) for
 * arrays > 64 bytes, and comma-separated decimals
 * (`PackedByteArray(0, 1, 2, ...)`) for smaller arrays. Returns null when the
 * literal is missing or unparseable.
 */
export function parsePackedByteArray(s: string): Uint8Array | null {
  const m = s.match(/PackedByteArray\(([\s\S]*?)\)/);
  if (!m) return null;
  const body = m[1].trim();
  if (body === '') return new Uint8Array(0);
  // Base64 form: first non-whitespace char is a quote.
  if (body.startsWith('"')) {
    const close = body.lastIndexOf('"');
    if (close <= 0) return null;
    const b64 = body.slice(1, close);
    try {
      const buf = Buffer.from(b64, 'base64');
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch {
      return null;
    }
  }
  // Decimal form: comma-separated byte values.
  const nums = body
    .split(',')
    .map((t) => parseInt(t.trim(), 10))
    .filter((n) => !isNaN(n));
  return new Uint8Array(nums);
}

/**
 * Decode a TileMapLayer `tile_map_data` blob into a flat list of placed cells.
 * Format (Godot 4.3+, format version 0 only — all current Godot 4 versions):
 *   - 2 bytes: format version (uint16 LE, must be 0)
 *   - per cell, 12 bytes:
 *       int16 LE  coord_x
 *       int16 LE  coord_y
 *       uint16 LE source_id    (0xFFFF means erase — defensively skipped)
 *       uint16 LE atlas_x      (0xFFFF means erase)
 *       uint16 LE atlas_y
 *       uint16 LE alternative_tile
 */
export interface TileMapCell {
  coordX: number;
  coordY: number;
  sourceId: number;
  atlasX: number;
  atlasY: number;
  alternativeTile: number;
}

export function decodeTileMapData(bytes: Uint8Array): TileMapCell[] {
  if (bytes.length < 2) return [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint16(0, true);
  if (version !== 0) {
    console.warn(`[Godot] tile_map_data unknown format version ${version}; skipping`);
    return [];
  }
  const out: TileMapCell[] = [];
  for (let p = 2; p + 12 <= bytes.length; p += 12) {
    const coordX = view.getInt16(p + 0, true);
    const coordY = view.getInt16(p + 2, true);
    const sourceId = view.getUint16(p + 4, true);
    const atlasX = view.getUint16(p + 6, true);
    const atlasY = view.getUint16(p + 8, true);
    const alternativeTile = view.getUint16(p + 10, true);
    if (sourceId === 0xffff || atlasX === 0xffff) continue;
    out.push({ coordX, coordY, sourceId, atlasX, atlasY, alternativeTile });
  }
  return out;
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
  // Godot 4 typed containers: Dictionary[K, V]({...}) and Array[T]([...])
  // Strip the type wrapper and decode the inner literal.
  const typedContainer = trimmed.match(/^(?:Dictionary|Array)\[[^\]]*\]\((.+)\)$/s);
  if (typedContainer) {
    return decodeGodotValue(typedContainer[1]);
  }
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
