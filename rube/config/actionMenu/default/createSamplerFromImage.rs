//Name: Create sampler from image
//Tags: body, fixture, sampler, image
//Creates a sampler that fits over each selected image

if ( si().length < 1 ) {
	print("Please select an image to create the sampler for");
}
else {
	image[] imgs = si();
	for (uint i = 0; i < imgs.length; i++) {
		image img = imgs[i];
		vec2 c = img.getCenter();
		float a = img.getAngle();
		float h = img.getPixelHeight();
		float heightMod = (h + 2) / h; // make sampler one pixel larger than image
		string jsonStr = '"center":{"x":'+c.x+',"y":'+c.y+'}';
		jsonStr += ',"outputWidth":'+img.getPixelWidth() * img.getAspectScale();
		jsonStr += ',"outputHeight":'+img.getPixelHeight();
		jsonStr += ',"height":'+img.getHeight() * heightMod;
		jsonStr += ',"angle":'+ a;
		jsonStr += ',"autoUpdate" : false';
		if ( img.getBody().valid )
			jsonStr += ',"body":'+img.getBody().id;
		addSampler(-1, '{'+jsonStr+'}');
	}
}
