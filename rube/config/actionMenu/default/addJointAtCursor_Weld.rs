//Name: Add weld joint
//Tags: joint, weld

//Add a weld joint with no name and default properties to the first two currently selected bodies

body[] bodies = getSelectedBodies();
if ( bodies.length >= 2 ) {	
	vec2 anchorA = bodies[0].getLocalPoint( getCursor() );
	vec2 anchorB = bodies[1].getLocalPoint( getCursor() );
	addJoint(-1, '{"type":"weld","bodyA":'+bodies[0].id+',"bodyB":'+bodies[1].id+',"anchorA":{"x":'+anchorA.x+',"y":'+anchorA.y+'},"anchorB":{"x":'+anchorB.x+',"y":'+anchorB.y+'}}');
}
else
	print("Please select two bodies to join.");
