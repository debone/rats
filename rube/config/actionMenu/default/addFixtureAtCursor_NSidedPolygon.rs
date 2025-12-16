//Name: Add fixture (polygon)
//Add a polygon fixture with the number of sides specified by the user, to all currently selected bodies, at the cursor position

uint numSides = queryNumericValue('Number of sides', 5);
if ( numSides >= 3 ) {
	vec2 cursor = getCursor();
	float radius = 0.5;
	body[] bodies = getSelectedBodies();
	for (uint i = 0; i < bodies.length; i++) {
		body b = bodies[i];
		string xValues;
		string yValues;
		for (uint n = 0; n < numSides; n++) {
			float angle = n * (dr(360) / numSides);
			if ( n > 0 ) {
				xValues += ',';
				yValues += ',';
			}
			vec2 v;
			v.set( radius * cos(angle), radius * sin(angle) );
			v += cursor;
			v = b.getLocalPoint(v);
			xValues += v.x;
			yValues += v.y;
		}
		string fixtureDef = '{"density":1,"shapes":[{"radius":0,"type":"polygon"}],"friction":0.2,"vertices":{"x":['+xValues+'],"y":['+yValues+']}}';
		bodies[i].addFixture(-1, fixtureDef);
	}
}
else
	print('Please enter a value of 3 or greater.');

