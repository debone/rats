// Name: Join fixtures
// Tag: fixture

// Takes two fixtures and joins them together. You need to select the 'destination'
// fixture which will remain, and the other fixture will be deleted. You also need to 
// select one vertex from each fixture to specify where the join should be made. If 
// the body of the deleted fixture is left with no fixtures, the body will also be 
// deleted (comment out the last part of the script if you don't want this).

// See this thread for details: http://www.iforce2d.net/forums/viewtopic.php?f=9&t=186

void main() {

   //check that one fixture is selected
   if ( sf().length != 1 ) {
      queryYesNo("Please select a single fixture to be the destination for the merged result");
      return;
   }
   fixture destinationFixture = sf()[0];

   //check that two vertices are selected
   if ( sv().length != 2 ) {
      queryYesNo("Please select one vertex from each of the fixtures to merge");
      return;
   }
   vertex[] vs = sv();
   vertex v0 = vs[0];
   vertex v1 = vs[1];
   fixture f0 = v0.getFixture();
   fixture f1 = v1.getFixture();

   //check that one (and only one) of the vertices belongs to the selected fixture
   if ( ! (f0 != f1 && (f0 == destinationFixture || f1 == destinationFixture)) ) {
      queryYesNo("Please select one vertex from each of the fixtures to merge");
      return;
   }

   //make sure 0 is the destination, and 1 is the source
   if ( f1 == destinationFixture ) {
      vertex tmpv = v1;
      v1 = v0;
      v0 = tmpv;
      fixture tmpf = f1;
      f1 = f0;
      f0 = tmpf;
   }

   //add all vertices from f1 to f0
   uint dstIndex = v0.index+1;
   uint srcIndex = v1.index;
   for (int i = 0; i < f1.getNumVertices(); i++) {
      f0.addVertex( dstIndex++, f0.getBody().getLocalPoint(f1.getVertex(srcIndex).wpos) );
      srcIndex = (srcIndex + 1) % f1.getNumVertices();
   }

   body b1 = f1.getBody();

   //delete the source fixture (the body will remain)
   f1.delete();

   //delete body if it now has no fixtures
   if ( b1.getFixtures().length == 0 )
      b1.delete();

}

