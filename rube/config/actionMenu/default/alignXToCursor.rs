//Name: Align X to cursor
//Tags: align, vertex

//changes the X coordinate of all selected vertices to match the cursor

vertex[] v = getSelectedVertices();
for (uint i = 0; i < v.length; i++) 
	v[i].setWorldPos( getCursor().x, v[i].wy );

