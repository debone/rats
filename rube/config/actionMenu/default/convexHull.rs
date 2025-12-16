//Name: Convex hull
//Tags: fixture, convex
//Converts all selected fixtures to their convex hull 

if ( sf().length < 1 ) {
	print("Please select a fixture");
}
else {
	fixture[] fs = sf();
	for (uint fi = 0; fi < fs.length; fi++) {
		fixture f = fs[fi];

		bool foundConcavity = true;
		while ( foundConcavity ) {
			foundConcavity = false;

			array<int> concaveVertices;

			bool foundStart = false;

			vertex[] vs = f.getVertices();
			for (uint i = 0; i < vs.length; i++) {
				int ind0 = (i+vs.length-1)%vs.length;
				int ind1 = i;
				int ind2 = (i+vs.length+1)%vs.length;
				vec2 v0 = vs[ind1].pos - vs[ind0].pos;
				vec2 v1 = vs[ind2].pos - vs[ind1].pos;
				float c = v0.cross(v1);
				if ( c <= 0 ) {
					//concave
					concaveVertices.insertLast( i );
					foundStart = true;
				}
				else {
					//convex
					if ( foundStart )
						break;
				}
			}

			if ( concaveVertices.length > 0 ) {
				foundConcavity  = true;
				for (int i = concaveVertices.length - 1; i >= 0; i--)
					f.deleteVertex( concaveVertices[i] );
			}
		}
	}
}
