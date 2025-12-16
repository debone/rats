//Name: Create body and fixture from image
//Tags: body, fixture, sampler, image
//Creates a sampler that fits over each selected image

if ( si().length < 1 ) {
	print("Please select an image to create the sampler for");
}
else {
	int maxPoints = queryNumericValue("Max points:", 100);
	int minAngle = queryNumericValue("Min angle:", 15);
	bool keepSampler = queryYesNo("Keep sampler?");
print( keepSampler );

	image[] imgs = si();
	for (uint i = 0; i < imgs.length; i++) {
		image img = imgs[i];

		// create temporary sampler to fit image
		vec2 c = img.getCenter();
		float a = img.getAngle();
		float h = img.getPixelHeight();
		float heightMod = (h + 2) / h; // make sampler one pixel larger than image
		string jsonStr = '"center":{"x":'+c.x+',"y":'+c.y+'}';
		jsonStr += ',"outputWidth":'+img.getPixelWidth();
		jsonStr += ',"outputHeight":'+img.getPixelHeight();
		jsonStr += ',"height":'+img.getHeight() * heightMod;
		jsonStr += ',"angle":'+ a;
		jsonStr += ',"autoUpdate" : false';
		jsonStr += ',"alphaEdgeThreshold" : 0.5';
		if ( img.getBody().valid )
			jsonStr += ',"body":'+img.getBody().id;
		sampler s = addSampler(-1, '{'+jsonStr+'}');

		vec2[] pts = s.getAlphaEdgePathSeedPoints();
		if ( pts.length > 0 ) {
			path p = getPath(s.id,0);
			int n = pts.length;
			for (int i = 0; i < n; i++)
				p.addControlPoint(i, pts[i].x, pts[i].y);
			p.addControlPoint(n, pts[0].x, pts[0].y);

			body b;
			if ( img.getBody().valid )
				b = img.getBody();
			else {
				b = addBody(-1, '{"type":"dynamic","awake":true}');
				b.setPos( img.getCenter() );
				img.setBody( b);
			}
			p = getPath(s.id,0);
			p.setMaxPoints(maxPoints);
			p.setMinAngle(minAngle);
			createFixture( b, p );
		}
		else
			print("Could not make path seed points (image "+img.id+")");

		if ( ! keepSampler )
			s.delete();
	}
}
