//Name: Add body (square)
//Tags: body,square
//Add a body with a square fixture at the cursor position

body b = addBody(-1, '{"type":"dynamic","awake":true}');
b.addFixture(-1, '{"density":1,"shapes":[{"radius":0,"type":"polygon"}],"friction":0.2,"vertices":{"x":[-0.5,0.5,0.5,-0.5],"y":[-0.5,-0.5,0.5,0.5]}}');
b.setPos( cursor() );

