//Name: Bevel corners
//Tags: vertex, line
//Adds vertices at sharp corners to make them less sharp.

void main() {

   vertex[] vs = sv();

   if ( vs.length < 1 ) {
      print( "Please select the vertices to check." );
      return;
   }

   float maxAngle = queryNumericValue("Maximum allowable angle (degrees):", 75);
   if ( maxAngle < 0 ) maxAngle = 0;
   if ( maxAngle > 180 ) maxAngle = 180;
	
 	// the lowest allowable dot product between consecutive edge segments
	float minDot = cos( dr( maxAngle ) );

	float bevelDepth = queryNumericValue("Bevel depth: ", 0.25);

	bool foundOne = true;
	while ( foundOne ) {
		foundOne = false;

		// find the vertex which causes the most significant angle
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
			if ( thisDot < minDot ) {
				if ( ! foundOne || thisDot < bestDot ) {
					bestIndex = i;
					bestDot = thisDot;
				}
				foundOne = true;
			}
		}
		
		if ( foundOne ) {

			vertex v = vs[bestIndex];
			vertex p = v.prev();
      		vertex n = v.next();

			vec2 edge0 = v.pos - p.pos;
			vec2 edge1 = n.pos - v.pos;
			if ( edge0.length() > bevelDepth && edge1.length() > bevelDepth ) {
				
				// find new corner positions for the bevel
				edge0.normalize();
				edge1.normalize();
				vec2 p0 = v.pos - bevelDepth * edge0;
				vec2 p1 = v.pos + bevelDepth * edge1;

				// move the existing vertex to one of the bevel corner positions
				v.setPos( p0 );
				vs[bestIndex].setPos( p0 ); // also need to update the reference held in array

				// create a new vertex for the other bevel corner
				vertex newVertex = v.getFixture().addVertex( v.index + 1, p1 );

				// adjust the indices of any other vertices in the same fixture being processed 
				for ( uint i = 0; i < vs.length; i++) {
					if ( vs[i].getFixture() == v.getFixture() && vs[i].index > v.index )
						vs[i].index = vs[i].index + 1;
				}

				// select the newly inserted vertex (not strictly necessary but allows user to 
				// repeat this script again while still preserving their intention of which places to bevel
				newVertex.select();

			}
			else {
				print( "Vertex at "+v.wpos.x+", "+v.wpos.y+" exceeds the max angle but there is not enough room to bevel it" );
				// remove this from the list of vertices being processed to prevent infinite loop
				vs.removeAt( bestIndex );
			}

		}

	}
   
}

