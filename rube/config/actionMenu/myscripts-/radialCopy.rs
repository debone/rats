int n = queryNumericValue("Total: ", 12);

if ( n < 2 )
	print("Please enter a value greater than 2");
else {
	fixture[] sf = getSelectedFixtures();
	float angle = 360 / n;
	for (int i = 1; i < n; i++) {
		fixture[] nf = duplicate(sf);
		rotate(nf, 0, dr(i*angle));
	}
}

