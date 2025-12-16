// Name: Split fixture (polygon)
// Tag: fixture

// Based on original contribution from Tim Scott.
// This script accepts 2 vertices on a single fixture and "splits" the fixture along those vertices.
// In reality, it duplicates the source fixture twice, and deletes either half of the fixture to
// get two fixtures, then it deletes the source fixture.

void main() {
	
	vertex [] vs = getSelectedVertices();

	if ( vs.length < 2 || ( vs[0].getFixture() != vs[1].getFixture() ) ) {
		queryYesNo("Please select two vertices of the same fixture to split between");
		return;
	}

	vertex v0 = vs[0];
	vertex v1 = vs[1];

	if ( v0.prev() == v1 || v0.next() == v1 ) {
		queryYesNo("Please select two vertices that are not immediate neighbors");
		return;
	}

	if ( v0.pos == v1.pos ) {
		queryYesNo("Please select two vertices that are not in exactly the same place");
		return;
	}

	fixture parentFixture = v0.getFixture();

	uint startIndex = v0.index;
	uint endIndex = v1.index;

	// make sure start index is below end index
	if ( startIndex > endIndex ) {
		uint tmp = startIndex;
		startIndex = endIndex;
		endIndex = tmp;
	}

	// Duplicate the original fixture
	// Delete child vertices from (startIndex..endIndex) (exclusive)
	fixture newFixture1 = duplicate( parentFixture );
	int count = abs(endIndex - startIndex) - 1;
	for (int i = 0; i < count; i++) 
		newFixture1.deleteVertex( startIndex + 1 ); // do not delete the vertex at the starting point!

	// Duplicate the original fixture
	// Delete child vertices from [0..startIndex) (exclusive)
	//                       from (endIndex..lastIndex] (exclusive)
	fixture newFixture2 = duplicate(parentFixture);
	count = newFixture2.getNumVertices() - endIndex - 1;
	for (int i = 0; i < count; i++)
		newFixture2.deleteVertex(endIndex + 1); // do not delete the vertex at the ending point

	count = startIndex;
	for (int i = 0; i < count; i++)
		newFixture2.deleteVertex(0); // delete vertices up to the starting index node

	// delete the parent
	parentFixture.delete();

}
