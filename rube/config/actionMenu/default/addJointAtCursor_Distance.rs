//Name: Add distance joint
//Tags: joint, distance

//Add a distance joint with no name and default properties to the first two currently selected bodies
//The anchor for bodyA will be at bodyA's position
//The anchor for bodyB will be at the cursor position

body[] bodies = getSelectedBodies();
if ( bodies.length >= 2 ) {	
	vec2 posA = bodies[0].pos;
	vec2 posB = getCursor();
	vec2 anchorA = bodies[0].getLocalPoint( posA );
	vec2 anchorB = bodies[1].getLocalPoint( posB );
	float length = (posA - posB).length();
	addJoint(-1, '{"type":"distance","bodyA":'+bodies[0].id+',"bodyB":'+bodies[1].id+',"anchorA":{"x":'+anchorA.x+',"y":'+anchorA.y+'},"anchorB":{"x":'+anchorB.x+',"y":'+anchorB.y+'},"length":'+length+'}');
}
else
	print("Please select two bodies to join.");
