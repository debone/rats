import type { TiledProperty } from './types';

export type PropertyMap = Map<string, string | number | boolean>;

/**
 * Converts Tiled properties array to a Map for easy access.
 * Keys are lowercased for case-insensitive lookups.
 */
export function mapProperties(props?: TiledProperty[]): PropertyMap {
  const map = new Map<string, string | number | boolean>();
  if (!props) return map;

  for (const prop of props) {
    const key = prop.name.toLowerCase();
    const value = typeof prop.value === 'string' ? prop.value.toLowerCase() : prop.value;
    map.set(key, value);
  }
  return map;
}

/**
 * Get a property value with type safety
 */
export function getProperty<T extends string | number | boolean>(
  props: PropertyMap,
  name: string,
  defaultValue?: T,
): T | undefined {
  const value = props.get(name.toLowerCase());
  return (value as T) ?? defaultValue;
}
