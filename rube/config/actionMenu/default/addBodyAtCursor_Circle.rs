//Name: Add body (circle)
//Tags: body, circle

//Add a body with a circle fixture at the cursor position

body b = addBody(-1, '{"type":"dynamic","awake":true}');
b.addFixture(-1, '{"density":1,"shapes":[{"radius":0.5,"type":"circle"}],"friction":0.2,"vertices":{"x":[0],"y":[0]}}');
b.setPos( cursor() );

