//Name: Create fixture from sampler
//Tags: sampler, fixture
//Creates a fixture from an already defined sampler path. Requires a body to be selected as the destination.

if ( sb().length < 1 && ss().length < 1 ) {
	print("Please select a body and a sampler");
}
else if ( sb().length < 1 ) {
	print("Please select a body");
}
else if ( ss().length < 1 ) {
	print("Please select a sampler");
}
else {
	body b = sb()[0];
	sampler s = ss()[0];
	path p = getPath(s.id,0);
	createFixture( b, p );
}

