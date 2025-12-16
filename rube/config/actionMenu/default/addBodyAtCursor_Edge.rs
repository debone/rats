//Name: Add body (edge)
//Tags: body, edge
//Add a body with an edge fixture at the cursor position

body b = addBody(-1, '{"type":"dynamic","awake":true}');
b.addFixture(-1, '{"density":1,"shapes":[{"radius":0,"type":"line"}],"friction":0.2,"vertices":{"x":[-0.5,0.5],"y":[0,0]}}');
b.setPos( cursor() );

