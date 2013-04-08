define([
    'jquery',
    'underscore',
    'backbone',

    'collections/cubes',

    'three',
    'detector'

], function ($, _, Backbone, CubeCollection) {

    // Constants
    var W, H
      , PI  = Math.PI
      , THT = 45 // Theta
      , PHI = 60
      , FOV = 70 // Field of view for perspective camera
      , RENDERER = (Detector.webgl ? 'WebGL' : 'Canvas') + 'Renderer'
      , CAMSPEED = 0.4; // Speed of mouse camera rotation

    return Backbone.View.extend({

        el: '#canvas',

        initialize: function () {
            W = this.$el.width();
            H = this.$el.height() - 4;

            this.lon = 0;
            this.lat = 0;

        // Scene
            this.scene = new THREE.Scene();

        // Cubes
            this.hovered  = null;
            this.selected = new CubeCollection();
            this.cubes    = new CubeCollection();

        // Reference Plane
        // used to determine 3D mouse positions for cube creation/movement
            this.plane = new THREE.Mesh(
                new THREE.PlaneGeometry( 2000, 2000, 8, 8 ),
                new THREE.MeshBasicMaterial({
                    color: 0xff0000, opacity: 0.25,
                    transparent: true,
                    wireframe: true
                })
            );

            this.plane.visible = false;

            // Align the plane with the field of view
            var rotation = new THREE.Matrix4().makeRotationX( Math.PI / 2 );
            this.plane.geometry.applyMatrix(rotation);

            this.planeOffset = new THREE.Vector3();

            this.scene.add(this.plane);

        // Projector - for establishing mouse-object intersections
            this.projector = new THREE.Projector();

        // Cube Creation/Deletion
            this.setupCubeCreation();
            this.setupCubeDeletion();

        // Cube Hover/Selection
            this.setupCubeHover();
            this.setupCubeSelection();

        // Cube Manipulation
            this.setupCubeManipulation();

        // Camera
            this.camera = new THREE.PerspectiveCamera(FOV, this.w/this.h, 1, 1000);
            this.camera.target = new THREE.Vector3( 0, 0, 0 );
            this.setupCameraControls();
            this.scene.add(this.camera);

        // Lights
            var light1 = new THREE.DirectionalLight(0xffffff);
            light1.position.x = 1;
            light1.position.y = 1;
            light1.position.z = 0.75;
            light1.position.normalize();

            var light2 = new THREE.DirectionalLight(0x808080);
            light2.position.x = -1;
            light2.position.y = 1;
            light2.position.z = -0.75;
            light2.position.normalize();

            var ambient = new THREE.AmbientLight(0x404040);

            this.scene.add(light1);
            this.scene.add(light2);
            this.scene.add(ambient);

        // Renderer
            this.renderer = new THREE[RENDERER]();

        // Misc.
            var canvas = this;
            window.addEventListener( 'resize', onWindowResized, false );

            function onWindowResized( event ) {
                canvas.renderer.setSize( W, H );
                canvas.camera.projectionMatrix.makePerspective( FOV, W/H, 1, 1100 );
            }

            onWindowResized(null);
        },

        render: function () {

            this.$el.append(this.renderer.domElement);

            // Start animation loop
            var canvas = this;
            function animate() {
                requestAnimationFrame(animate);
                canvas.renderFrame();
            }
            animate();
        },

        renderFrame: function () {
            this.positionCamera();
            this.renderer.render(this.scene, this.camera);
        },

        setupCameraControls: function () {
            var canvas = this
              , mouseLon = 0
              , mouseLat = 0
              , mouseX   = 0
              , mouseY   = 0;

        // Camera Rotation
            this.$el.mousedown(function (e) {
                if (e.which === 1 && !canvas.hovered) {

                    mouseX = e.clientX; mouseLon = canvas.lon;
                    mouseY = e.clientY; mouseLat = canvas.lat;

                    canvas.$el.on('mousemove.cam', function (e) {
                        canvas.lon = ( e.clientX - mouseX ) * CAMSPEED + mouseLon;
                        canvas.lat = ( e.clientY - mouseY ) * CAMSPEED + mouseLat;
                    });

                    canvas.$el.on('mouseup.cam', function (e) {
                        if (e.which === 1) {
                            canvas.$el.off('mousemove.cam');
                            canvas.$el.off('mouseup.cam');

                            // Keep reference plane parallel with field of view
                            canvas.plane.lookAt(canvas.camera.position);
                        }
                    });
                }
            });

        // Camera Zoom
            this.el.addEventListener( 'mousewheel',     onMouseWheel, false );
            this.el.addEventListener( 'DOMMouseScroll', onMouseWheel, false );
            function onMouseWheel( event ) {

                // If there are selected objects, they will be scaled instead
                if (canvas.selected.isEmpty()) {

                    canvas.camera.projectionMatrix.makePerspective(
                        FOV += canvas.getScrollDelta(event), W/H, 1, 1100
                    );
                }
            }
        },

        positionCamera: function () {
            this.lat = Math.max(-85, Math.min(85, this.lat));

            var phi   = (90 - this.lat) * PI / 180
              , theta =       this.lon  * PI / 180;

            this.camera.position.x = 100 * Math.sin(phi) * Math.cos(theta);
            this.camera.position.y = 100 * Math.cos(phi);
            this.camera.position.z = 100 * Math.sin(phi) * Math.sin(theta);

            this.camera.lookAt(this.camera.target);
        },

        resetCamera: function () {
            this.lat = 0;
            this.lon = 0;
            this.positionCamera();
        },

    // Cube Hover
        setupCubeHover: function () {
            var canvas = this;

            canvas.$el.mousemove( function (e) {
                var hovered = canvas.getHoveredAt(e.clientX, e.clientY);

                // If the hovered object has changed,
                // set colors, then set new hovered
                if (hovered !== canvas.hovered) {
                    if (canvas.hovered) canvas.hovered.hover(false);
                    if (hovered) hovered.hover(true);
                    canvas.hovered = hovered;
                }

                // Set the cursor
                canvas.el.style.cursor = hovered ? 'move' : 'auto'
            });
        },

    // Cube Selection
        setupCubeSelection: function () {
            var canvas   = this
              , cubes    = this.cubes
              , selected = this.selected;

            // Automatically set cube selection property
            selected.on('add',    function (cube) { cube.select(true);  });
            selected.on('remove', function (cube) { cube.select(false); });

            // Automatically add/remove cubes on selection/deselection
            cubes.on('change:selected', function (cube, value) {
                selected[ value ? 'add' : 'remove' ](cube);
            })

            canvas.$el.mousedown( function (e) {
                if (canvas.hovered) {

                    // Select hovered object
                    canvas.selected.add(canvas.hovered);

                    // Set plane offset for new mouseDown start position
                    var x = e.clientX
                      , y = e.clientY
                      , intersect = canvas.getIntersectBetween(
                          x, y, canvas.plane);

                    if (intersect) {
                        canvas.planeOffset.copy(intersect
                        ).subSelf(canvas.plane.position);
                    }
                }
            });
        },

    // Cube Creation
        setupCubeCreation: function () {
            var canvas = this;

            canvas.cubes.on('add', function (cube) {
                // Don't add recursive child cubes to the scene;
                // they are already being added through their Object3D
                if (!cube.get('parent'))
                    canvas.scene.add(cube.get('object'));
            });

            canvas.$el.dblclick( function (e) {
                if (!canvas.hovered) {
                    var x = e.clientX
                      , y = e.clientY;

                    canvas.cubes.add({
                        position: canvas.getIntersectBetween(
                            x, y, canvas.plane)
                    });
                }
            });
        },

    // Cube Deletion
        setupCubeDeletion: function () {
            var canvas = this;

            canvas.cubes.on('remove', function (cubes) {
                if (!(cubes instanceof Array)) cubes = [cubes];

                _.each( cubes, function (cube) {
                    var prnt = cube.get('parent');
                    if (!prnt) { // Don't allow child cube deletion;
                        canvas.scene.remove(cube.get('object'));
                        canvas.selected.deselect(cube);
                    }
                });
            });

            canvas.$el.dblclick( function (e) {
                if (canvas.hovered) canvas.cubes.remove(canvas.hovered);
            });
        },

    // Cube Manipulation
        setupCubeManipulation: function () {
            var canvas = this
              , doc = $(document)
              , left, right, modKey;

            // Recursion - alternate to mouse controls
            doc.on('keydown', function (e) {
                if (canvas.modifierPressed(e)) {
                    modKey = true;
                    doc.on('keyup', function (e) {
                        if (canvas.modifierPressed(e)) {
                            doc.off('keyup');
                            modKey = false;
                        }
                    });
                }
            });

            canvas.$el.mousedown(function (e) {

            // Mouse Button States
                if (e.which === 1) {
                    left  = true;
                    canvas.$el.on('mouseup.left', function (e) {
                        if (e.which === 1) {
                            canvas.$el.off('mouseup.left');
                            left  = false;
                        }
                    });
                } else if (e.which === 3) {
                    right = true;
                    canvas.$el.on('mouseup.right', function (e) {
                        if (e.which === 3) {
                            canvas.$el.off('mouseup.right');
                            right = false;
                        }
                    });
                }

            // Mouse Button Event Routing
                if (left || right) {

                    if (!canvas.hovered) {
                        canvas.selected.deselectAll();

                    } else {
                        var recursive = false
                          , startX = e.clientX
                          , startY = e.clientY

                        // Offsets used by movement handler
                          , movSoFar = new THREE.Vector3(0, 0, 0)
                          , xSoFar = 0, ySoFar = 0;

                        canvas.$el.off('mousemove.mov');
                        canvas.$el.on('mousemove.mov', onMouseMove);

                        // TODO: handle case where mouse leaves canvas before mouseup
                        canvas.$el.off('mouseup.mov');
                        canvas.$el.on('mouseup.mov', function (e) {

                            if ((e.which === 1 && right)
                             || (e.which === 3 && left)) {
                                canvas.selected.deselectAll();
                                recursive = false;

                            } else {
                                canvas.$el.off('mousemove.mov');
                                canvas.$el.off('mouseup.mov');

                                // Reset offsets
                                movSoFar = new THREE.Vector3(0, 0, 0);
                                xSoFar = 0, ySoFar = 0;

                            }
                        });
                    }
                }

            // Mouse Movement Handler
                function onMouseMove(e) {
                    var x = e.clientX
                      , y = e.clientY;

                    if (!canvas.selected.isEmpty()) {
                        var intersect = canvas.getIntersectBetween(
                                x, y, canvas.plane)

                        // Details of the mouse movement. v- 3d movement
                          , movement = intersect ? 
                                intersect.subSelf(canvas.planeOffset) :
                                new THREE.Vector3(0, 0, 0)
                          , mouseX = x - startX // x distance on screen
                          , mouseY = y - startY // y distance on screen

                        // Create copies
                          , movCopy = _.clone(movement)
                          , xCopy   = mouseX
                          , yCopy   = mouseY;

                        // Isolate movement since last move event
                        movement.x -= movSoFar.x;
                        movement.y -= movSoFar.y;
                        movement.z -= movSoFar.z;
                        mouseX     -= xSoFar;
                        mouseY     -= ySoFar;

                        // Save original movement
                        movSoFar = movCopy;
                        xSoFar   = xCopy;
                        ySoFar   = yCopy;

                        if ((left && right || modKey) && !recursive) {

                            // Get set of cubes that will be repeated.
                            var toRecurse = canvas.flatMap(
                                canvas.selected, function (cube) {
                                    return cube.getRelated();
                                }, true
                            );

                            // Get vectors used to link child cubes
                            var vectors = {
                                position: new THREE.Vector3( 0, 0, 0 ),
                                rotation: new THREE.Vector3( 0, 0, 0 ),
                                scale:    new THREE.Vector3( 1, 1, 1 )
                            };

                            // Repeat the cubes
                            var newCubes = canvas.flatMap(
                                toRecurse, function (cube) {
                                    return cube.recurse(0, vectors);
                                }
                            );

                            // Add all the recursed copies
                            // to the main cube collection
                            canvas.cubes.add(newCubes);

                            // Select the first child that was created;
                            // it is used to move all the children.
                            canvas.selected.deselectAll().add(newCubes[0]);

                            // Set flag to activate normal cube movement
                            recursive = true;

                        } else if (left || recursive) {
                            canvas.selected.moveAll(movement);

                        } else if (right) {
                            canvas.selected.rotateAll(
                                movement, mouseX, mouseY);
                        }
                    }
                }
            });

            // Prevent context menu on right-click
            canvas.$el.contextmenu( function () { return false; });

            this.el.addEventListener( 'mousewheel',     onMouseWheel, false );
            this.el.addEventListener( 'DOMMouseScroll', onMouseWheel, false );
            function onMouseWheel( event ) {
                if (!canvas.selected.isEmpty()) {
                    canvas.selected.scaleAll(canvas.getScrollDelta(event));
                }
            }
        },

    // Utility
        getHoveredAt: function (x, y) {
            return this.cubes.getFromIntersect(
                this.getIntersectObject(x, y, this.cubes.wireframes())
            );
        },

        getIntersectBetween: function (x, y, obj) {
            var intersect = this.getIntersectObject(x, y, obj);
            return intersect && intersect.point;
        },

        getIntersectObject: function (x, y, obj) {
            var ray = this.getRayAt(x, y)

            return ( obj instanceof Array ?
                ray.intersectObjects(obj) :
                ray.intersectObject( obj) )[0] || null;
        },

        getRayAt: function (x, y) {

            var vector = new THREE.Vector3(
                ((x/ W) * 2) - 1,
               -((y/ H) * 2) + 1, 0.5);

            this.projector.unprojectVector(vector, this.camera);

            return new THREE.Ray(this.camera.position,
                  vector.subSelf(this.camera.position).normalize());
        },

        toScreenXY: function (pos3d) {

            var pos = pos3d.clone()
              , projScreenMat = new THREE.Matrix4()
              , canvas = this.$('canvas');

            projScreenMat.multiply(this.camera.projectionMatrix,
                                   this.camera.matrixWorldInverse);
            projScreenMat.multiplyVector3(pos);

            return {
                x: ( pos.x + 1) * canvas.width()  / 2,// + canvas.offset().left,
                y: (-pos.y + 1) * canvas.height() / 2// + canvas.offset().top
            };
        },

        getScrollDelta: function (ev) {
            if      ( ev.wheelDeltaY ) return -ev.wheelDeltaY * 0.05; // Webkit
            else if ( ev.wheelDelta )  return -ev.wheelDelta * 0.05;  // Opera
            else if ( ev.detail )      return  ev.detail * 1.0;       // Firefox
        },

        flatMap: function (list, fn, unique) {
            var results = list instanceof Backbone.Collection ?
                _.flatten(list.map(fn))   :
                _.flatten(_.map(list, fn));
            return unique ? _.uniq(results) : results;
        },

        modifierPressed: function (e) {
            return e.metaKey || // meta (command) key
                  ($.browser.webkit &&
                      (e.which === 91   ||
                       e.which === 93)) ||
                  ($.browser.mozilla &&
                       e.which === 224) ||
                   e.ctrlKey || // ctrl key
                   e.which === 17;
        }
    });
});
