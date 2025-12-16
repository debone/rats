//Name: Smooth line
//Tags: vertex, line, smooth
//Moves all selected vertices towards the average position of their two closest neighbors

void main() {

   vertex[] vs = sv();

   if ( vs.length < 1 ) {
      print( "Please select the vertices to smooth." );
      return;
   }

   float smoothFactor = queryNumericValue("Smooth factor (0-1):", 0.25);
   if ( smoothFactor < 0 ) smoothFactor = 0;
   if ( smoothFactor > 1 ) smoothFactor = 1;

   array<vec2> newPositions( vs.length );
   for (uint i = 0; i < vs.length; i++) {
      vec2 oldPos = vs[i].pos;
      vec2 prevPos = vs[i].prev().pos;
      vec2 nextPos = vs[i].next().pos;
      vec2 midPos = 0.5 * (prevPos + nextPos);
      newPositions[i] = smoothFactor * midPos + (1-smoothFactor) * oldPos;
   }

   for (uint i = 0; i < vs.length; i++) 
      vs[i].setPos( newPositions[i] );
   
}
