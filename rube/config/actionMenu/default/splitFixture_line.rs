// Name: Split fixture (line)
// Tag: fixture

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

	if ( v0.prev() != v1 && v0.next() != v1 ) {
		queryYesNo("Please select two vertices that are immediate neighbors");
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
	// Delete child vertices (0..startIndex]
	fixture newFixture1 = duplicate( parentFixture );
	for (uint i = 0; i < endIndex; i++) 
		newFixture1.deleteVertex( 0 ); 

	// Duplicate the original fixture
	// Delete child vertices from [endIndex..length)
	fixture newFixture2 = duplicate(parentFixture);
	int count = newFixture2.getNumVertices() - endIndex;
	for (int i = 0; i < count; i++)
		newFixture2.deleteVertex( endIndex );

	// delete the parent
	parentFixture.delete();

}
