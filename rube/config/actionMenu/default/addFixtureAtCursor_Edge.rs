//Name: Add fixture (edge)
//Add a fixture with no name, two vertices and a zero radius shape to all currently selected bodies, at the cursor position
//The edge will be axis aligned (horizontal) in world coordinates

vec2 cursor = getCursor();
float halfsize = 0.5;
vec2 p0, p1;
p0.set( -halfsize, 0 );
p1.set(  halfsize, 0 );

body[] bodies = getSelectedBodies();
for (uint i = 0; i < bodies.length; i++) {
	body b = bodies[i];
	vec2 v0 = b.getLocalPoint( cursor + p0 );
	vec2 v1 = b.getLocalPoint( cursor + p1 );
    bodies[i].addFixture(-1, '{"density":1,"shapes":[{"radius":0,"type":"line"}],"friction":0.2,"vertices":{"x":['+v0.x+','+v1.x+'],"y":['+v0.y+','+v1.y+']}}');
}
