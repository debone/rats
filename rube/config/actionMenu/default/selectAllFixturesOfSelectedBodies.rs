//Name: Select fixtures from bodies
//Tags: select
//selects all fixtures of all currently selected bodies

body[] b = getSelectedBodies();
for (uint i = 0; i < b.length; i++) 
	select( b[i].getFixtures() );

