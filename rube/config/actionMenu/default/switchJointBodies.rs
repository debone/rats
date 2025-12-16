//Name: Swap joint bodies
//Tags: joint


//switch the bodyA/bodyB of all selected joints

joint[] joints = getSelectedJoints();
if ( joints.length > 0 ) {	
	for (uint i = 0; i < joints.length; i++)
		joints[i].setBodyA( joints[i].getBodyB() );	
}
else
	print("No joints selected.");

