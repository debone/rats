//Name: Move selected images to front
//Tags: image, render order
//Changes the render order of all selected images so that they are in front of all non-selected images. The order among selected images will be preserved. Assumes no images have render orders larger than +/-99999.

void main() {

	image[] sel = si();
	if ( sel.length == 0 )
		return;

	//find highest render order among all images in scene
	float bestRO = -99999;
	image[] imgs = ai();
	for (uint i = 0; i < imgs.length; i++) {
		if ( imgs[i].getRenderOrder() > bestRO )
			bestRO = imgs[i].getRenderOrder();
	}

	//find lowest render order among selected images
	float bestRO2 = 99999;
	for (uint i = 0; i < sel.length; i++) {
		if ( sel[i].getRenderOrder() < bestRO2 )
			bestRO2 = sel[i].getRenderOrder();
	}

	float delta = bestRO - bestRO2 + 1;
	for (uint i = 0; i < sel.length; i++)
		sel[i].setRenderOrder( sel[i].getRenderOrder() + delta );

}