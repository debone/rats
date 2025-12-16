//Name: Select vertices from fixtures
//Tags: select
//selects all vertices of all currently selected fixtures

fixture[] fs = getSelectedFixtures();
for (uint i = 0; i < fs.length; i++)
	select( fs[i].getVertices() );

