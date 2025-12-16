//Name: Reverse fixture winding
//Tags: fixture
//Reverses the vertex winding of all selected fixtures

fixture[] fixtures = getSelectedFixtures();
if ( fixtures.length > 0 ) {	
	for (uint i = 0; i < fixtures.length; i++)
		fixtures[i].reverseWinding();	
}
else
	print("No fixtures selected.");


