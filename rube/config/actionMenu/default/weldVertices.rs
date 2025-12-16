//Name: Weld vertices
//Tags: vertex

//moves all selected vertices to their average position

vertex[] v = getSelectedVertices();
if ( v.length > 1 ) {
	vec2 avgPos;
	avgPos.set(0,0);

	//first loop finds the average position
	for (uint i = 0; i < v.length; i++) {
		fixture f = v[i].getFixture();
		avgPos = avgPos + v[i].wpos;
	}

	avgPos.x /= v.length;
	avgPos.y /= v.length;

	//second loop sets the new position
	for (uint i = 0; i < v.length; i++) 
		v[i].setWorldPos( avgPos ); 
}
else
	print( "Please select at least two vertices" );

