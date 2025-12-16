Here is a brief summary of the sample loaders in this folder. You can find
more details on these in the R.U.B.E editor integrated help.


box2d-testbed-(C++)
===================
This is the original Box2D testbed source code, with one extra test added. 
Look for the 'loadrube.h' test, which uses the support source files in the
'rubestuff' folder. Both of these are under the usual 'Tests' folder.


box2dweb-testbed-(Javascript)
=============================
A Javascript implementation of the testbed using box2dweb, which makes it 
easy to add your own tests. The JSON files for scenes are loaded via ajax using
jQuery, so to run these you will need to be able to host this on a webserver.


box2dweb-testbed-standalone-(Javascript)
========================================
The same as the above but not using ajax or jQuery, meaning you can run
this version directly from your hard drive without needing to host it on a
webserver. The drawback is that all the scene files will be loaded up-front.


jbox2d-testbed-(Java)
=====================
A build of the JBox2D testbed with some tests that load scenes from JSON 
using the Java version of b2dJson. This version replaces all wheel joints
with revolute joints, so behavior of the vehicles will be incorrect.


chipmunk-demo-(C++)
===================
The Chipmunk physics engine, with a loader for R.U.B.E scenes implemented
as a demonstration. This is really just an experimental implementation and
is incomplete.


iOS-vehicles-(ObjC++)
=====================
Uses an OpenGL view in iOS to display some R.U.B.E scenes with vehicles.


cocos2d-(ObjC++)
================
A Cocos2d project demonstrating some examples of using R.U.B.E scenes, 
including loading pinch-zoom and panning, using CCSprites for images,
destroying bodies when touched, a pinball table, and a simple platform
game with collectible pickups and simple sounds.


SFML-(C++)
==========
Simple program to load a R.U.B.E scene into an SFML render window, and
use sf::Sprites to show the images. Demonstrates panning and zooming a
view, dragging and destroying bodies, a basic pinball table, and a very
simple platform game with collectible pickups and sounds.


SDL2-(C++)
==========
Simple program to load a R.U.B.E scene into an SDL_Window, and
use SDL_Textures to show the images. Demonstrates panning and zooming a
view, dragging and destroying bodies, a basic pinball table, and a very
simple platform game with collectible pickups and sounds.

