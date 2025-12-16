//Name: Align Y to cursor
//Tags: align, vertex

//changes the Y coordinate of all selected vertices to match the cursor

vertex[] v = getSelectedVertices();
for (uint i = 0; i < v.length; i++) 
	v[i].setWorldPos( v[i].wx, getCursor().y );

