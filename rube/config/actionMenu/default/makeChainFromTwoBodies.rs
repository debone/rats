//Name: Construct chain
//Tags: joint, revolute, chain
//Create a chain, starting with two bodies (and optionally the joints between them) as a template
//
//Usage
//Select two bodies to be the 'prototype' bodies for the chain. The order of selection is important:
//the chain will grow in the direction from the first body to the second body, by duplicating the second body.
//If any joints between the two bodies are selected, those joints will also be duplicated.
//The number of bodies to add to the chain will be supplied by the user at runtime.

body[] bodies = getSelectedBodies();
if ( bodies.length >= 2 ) {
    vec2 delta = bodies[1].pos - bodies[0].pos;

    //get all selected joints between the two bodies
    joint[] js = bodies[0].getJoints(bodies[1]);
    for (int i = js.length-1; i >= 0; i--) {
        if ( ! js[i].isSelected() )
            js.removeAt(i);
    }

    body b = bodies[1];
    int numLinks = queryNumericValue("Number of bodies to add:");
    for (int i = 0; i < numLinks; i++) {

        //duplicate body B and move it
        body bn = duplicate(b,false);
        translate( bn, delta );

        //duplicate joints and set their bodies to the new ones
        joint[] newJoints = duplicate(js);
        for (uint k = 0; k < newJoints.length; k++) {
            joint j = newJoints[k];
            if ( bodies[0] == j.getBodyA() ) {
                j.setBodyB(bn);
                j.setBodyA(b);
            }
            else {
                j.setBodyA(bn);
                j.setBodyB(b);
            }
        }

        //prepare for next iteration
        b = bn;
    }
}
else
    print("Please select two bodies as the prototype for the chain");

