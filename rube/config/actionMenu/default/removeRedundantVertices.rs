//Name: Remove redundant vertices
//Tags: vertex, line
//Removes all vertices among the selected vertices, where the presence of the vertex
// does not significantly change the overall line. The angle deemed to be 'significant'
// will be given by the user at run-time.

void main() {

   vertex[] vs = sv();

   if ( vs.length < 1 ) {
      print( "Please select the vertices to check." );
      return;
   }

   float minAngle = queryNumericValue("Minimum allowable angle (degrees):", 10);
   if ( minAngle < 0 ) minAngle = 0;
   if ( minAngle > 90 ) minAngle = 90; // this is kinda arbitrary, but have to cut off somehow...
	
 	// the highest allowable dot product between consecutive edge segments
	float maxDot = cos( dr( minAngle ) );

	bool foundOne = true;
	while ( foundOne ) {
		foundOne = false;

		// find the vertex which causes the least significant angle
		float bestDot = 0;
		float bestIndex = 0;
		for (uint i = 0; i < vs.length; i++) {
			vec2 p0 = vs[i].prev().pos;
      		vec2 p1 = vs[i].pos;
      		vec2 p2 = vs[i].next().pos;
			vec2 edge0 = p1 - p0;
			vec2 edge1 = p2 - p1;
			edge0.normalize();
			edge1.normalize();
			float thisDot = edge0.dot( edge1 );
			if ( thisDot > maxDot ) {
				if ( ! foundOne || thisDot > bestDot ) {
					bestIndex = i;
					bestDot = thisDot;
				}
				foundOne = true;
			}
		}
		
		if ( foundOne ) {

			// remove the vertex
			vertex v = vs[bestIndex];
			v.getFixture().deleteVertex( v.index );

			// adjust the indices of any other vertices in the same fixture being processed 
			for ( uint i = 0; i < vs.length; i++) {
				if ( vs[i].getFixture() == v.getFixture() && vs[i].index > v.index )
					vs[i].index = vs[i].index - 1;
			}

			// remove the deleted vertex from the list of vertices being processed
			vs.removeAt( bestIndex );
		}
	}
   
}

