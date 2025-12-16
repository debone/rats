//Name: Split edges
//Tags: split, vertex, edge

//Inserts vertices between consecutive selected vertices

bool sortVerticesByIndex(vertex a, vertex b) {
	return a.index < b.index;
}

void main() {
	float numSegments = queryNumericValue('Number of segments');
	
	if ( numSegments < 2 ) {
		print('Please enter a value of 2 or greater.');
		return;
	}
	
	//vertex[] newVertices;
	vertex[] verts = sortVertices( getSelectedVertices(), sortVerticesByIndex );

	//need to loop in descending order because adding a vertex increments the indices of all vertices above it
	for (int i = verts.length-1; i >= 0; i--) {//dont use uint here :)
		vertex v = verts[i]; 
		vertex nv = v.next();
		if ( nv == v )
			continue;//single vertex fixture (circle)
		if ( ! nv.isSelected() )
			continue;

		fixture f = v.getFixture();

		//print( "Edge between vertices "+v.index+" and "+nextVertexIndex+" of fixture "+f.id+" is selected" );

		//user probably doesn't want to add vertices between the ends of a line shape
		if ( nv.index == 0 && f.getShape(0).type == 2 )
			continue;

		//find the midpoint
		vec2 d = nv.pos - v.pos;
		float spacing = 1 / numSegments;
		for (float n = 1; n < numSegments; n++) {
			vec2 newpoint;
			newpoint.set(n * spacing * d.x, n * spacing * d.y);
			newpoint = v.pos + newpoint;
			vertex newVertex = f.addVertex( v.index + n, newpoint );
			//newVertices.insertLast( newVertex );
		}
	}
	//print( "Added "+newVertices.length()+" new vertices");
	//select( newVertices ); damn... doesn't work because indices get incremented
}

/*

//Inserts vertices between consecutive selected vertices

float numSegments = queryNumericValue('Number of segments');
if ( numSegments >= 2 ) {
	//vertex[] newVertices;
	vertex[] verts = getSelectedVertices();

	//need to loop in descending order because adding a vertex increments the indices of all vertices above it
	for (int i = verts.length-1; i >= 0; i--) {//dont use uint here :)
		vertex v = verts[i]; 
		fixture f = v.getFixture();
                uint nextVertexIndex = ( v.index + 1 ) % f.getNumVertices();
		if ( nextVertexIndex == v.index )
			continue;//single vertex fixture (circle)
		vertex nv = f.getVertex( nextVertexIndex );
		if ( ! nv.isSelected() )
			continue;

		//print( "Edge between vertices "+v.index+" and "+nextVertexIndex+" of fixture "+f.id+" is selected" );

		if ( nextVertexIndex == 0 ) {
			//user probably doesnt want to add vertices between the ends of a line shape
			if ( f.getShape(0).type == 2 )
				continue;
		}

		//find the midpoint (todo: let user select number in dialog)
		vec2 d = nv.pos - v.pos;
                float spacing = 1 / numSegments;
                for (float n = 1; n < numSegments; n++) {
			vec2 newpoint;
			newpoint.set(n * spacing * d.x, n * spacing * d.y);
			newpoint = v.pos + newpoint;
			vertex newVertex = f.addVertex( v.index + n, newpoint );
			//newVertices.insertLast( newVertex );
		}
	}
	//print( "Added "+newVertices.length()+" new vertices");
	//select( newVertices ); damn... doesn't work because indices get incremented
}
else
	print('Please enter a value of 2 or greater.');

*/
