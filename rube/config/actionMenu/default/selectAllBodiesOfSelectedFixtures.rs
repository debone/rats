//Name: Select bodies from fixtures
//Tags: select
//selects all bodies of all currently selected fixtures

fixture[] f = getSelectedFixtures();
for (uint i = 0; i < f.length; i++) {
	f[i].getBody().select();
}

