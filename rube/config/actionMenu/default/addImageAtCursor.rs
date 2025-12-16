//Name: Add image
//add an image at the current cursor position, using an open file dialog to select the file

string filename = queryOpenFile( getSupportedImageFormatsFilter() );

addImage( filename, cursor() );
