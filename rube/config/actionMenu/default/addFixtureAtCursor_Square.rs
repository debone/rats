//Name: Add fixture (square)
//Add a fixture with no name, four vertices and a zero radius shape to all currently selected bodies, at the cursor position
//The square will be axis aligned in world coordinates

vec2 cursor = getCursor();
float halfsize = 0.5;
vec2 p0, p1, p2, p3;
p0.set( -halfsize, -halfsize );
p1.set(  halfsize, -halfsize );
p2.set(  halfsize,  halfsize );
p3.set( -halfsize,  halfsize );

body[] bodies = getSelectedBodies();
for (uint i = 0; i < bodies.length; i++) {
	body b = bodies[i];
	vec2 v0 = b.getLocalPoint( cursor + p0 );
	vec2 v1 = b.getLocalPoint( cursor + p1 );
	vec2 v2 = b.getLocalPoint( cursor + p2 );
	vec2 v3 = b.getLocalPoint( cursor + p3 );
    bodies[i].addFixture(-1, '{"density":1,"shapes":[{"radius":0,"type":"polygon"}],"friction":0.2,"vertices":{"x":['+v0.x+','+v1.x+','+v2.x+','+v3.x+'],"y":['+v0.y+','+v1.y+','+v2.y+','+v3.y+']}}');
}
