//Name: Add object
//add an object instance at the current cursor position, using an open file dialog to select the file

string filename = queryOpenFile("Scene files (*.rube *.json);;RUBE files (*.rube);;JSON files (*.json);;All files (*.*)");

addObject( filename, cursor() );
