//Name: Align vertices top
//Tags: align, vertex

//sets the Y coordinate of all selected vertices to match the topmost one

vertex[] v = getSelectedVertices();

float best = 0;
for (uint i = 0; i < v.length; i++) {
	if ( i == 0 )
		best = v[i].wy;
	else if ( v[i].wy > best )
		best = v[i].wy;
}

for (uint i = 0; i < v.length; i++)
	v[i].setWorldPos( v[i].wx, best );


