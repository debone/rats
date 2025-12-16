//Name: Align vertices right
//Tags: align, vertex

//sets the X coordinate of all selected vertices to match the rightmost one

vertex[] v = getSelectedVertices();

float best = 0;
for (uint i = 0; i < v.length; i++) {
	if ( i == 0 )
		best = v[i].wx;
	else if ( v[i].wx > best )
		best = v[i].wx;
}

for (uint i = 0; i < v.length; i++)
	v[i].setWorldPos( best, v[i].wy );


