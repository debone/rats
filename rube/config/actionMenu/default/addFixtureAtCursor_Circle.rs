//Name: Add fixture (circle)
//Add a fixture with no name, a single vertex and non-zero radius shape to all currently selected bodies, at the cursor position

body[] bodies = getSelectedBodies();
for (uint i = 0; i < bodies.length; i++) {
	vec2 pos = bodies[i].getLocalPoint( getCursor() );
    bodies[i].addFixture(-1, '{"density":1,"shapes":[{"radius":0.5,"type":"circle"}],"friction":0.2,"vertices":{"x":['+pos.x+'],"y":['+pos.y+']}}');
}
