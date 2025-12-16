//Name: Add motor joint
//Tags: joint, motor

//Add a motor joint with no name and default properties to the first two currently selected bodies
//The anchor for bodyA will be the cursor position
//The anchor for bodyB will be bodyB's position

body[] bodies = getSelectedBodies();
if ( bodies.length >= 2 ) {
	vec2 anchorA = bodies[0].getLocalPoint( bodies[1].pos );
	addJoint(-1, '{"type":"motor","bodyA":'+bodies[0].id+',"bodyB":'+bodies[1].id+',"anchorA":{"x":'+anchorA.x+',"y":'+anchorA.y+'}}');
}
else
	print("Please select two bodies to join.");
