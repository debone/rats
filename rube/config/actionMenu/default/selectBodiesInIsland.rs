//Name: Select bodies in island
//Tags: select

body[] bs = sb();
body[] fb; // already processed bodies

while ( bs.length > 0 ) {
   body b = bs[0];
   bs.removeAt(0);
   if ( fb.find(b) != -1 )
      continue;
   fb.insertLast(b);
   b.select();
   joint[] js = b.getJoints();
   for (uint i = 0; i < js.length; i++) {
      b = js[i].getBodyA();
      if ( bs.find(b) == -1 && fb.find(b) == -1 )
         bs.insertLast(b);
      b = js[i].getBodyB();
      if ( bs.find(b) == -1 && fb.find(b) == -1 )
         bs.insertLast(b);
   }
}

