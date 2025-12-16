//Name: Merge vertices
//Tags: vertex

//Only the first two vertices are used. Deletes one vertex and moves the other to their average position.

vertex[] v = getSelectedVertices();
if ( v.length > 1 ) {
	vec2 avgPos = 0.5 * (v[0].pos + v[1].pos);

	v[0].setPos( avgPos );
	v[1].delete();
}
else
	print( "Please select two vertices" );

