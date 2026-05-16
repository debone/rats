import { generateGeometryJsonFiles } from './packer/processors/godot-geometry.ts';

generateGeometryJsonFiles(
  './godot/geometry',
  './public/assets/geometry',
  './godot/sprite-map.json',
  './src/assets/geometry.ts',
);
