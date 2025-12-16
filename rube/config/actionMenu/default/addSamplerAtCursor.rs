//Name: Add sampler
//Add a sampler at the current cursor position

vec2 c = getCursor();
addSampler(-1, '{"center":{"x":'+c.x+',"y":'+c.y+'},"autoUpdate":false,"alphaEdgeThreshold":0.5}');
