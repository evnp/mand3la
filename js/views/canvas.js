define([
    'jquery',
    'underscore',
    'backbone',

    'three',
    'detector'

], function ($, _, Backbone) {

    // Constants
    var W, H
      , PI  = Math.PI
      , THT = 45 // Theta
      , PHI = 60
      , FOV = 4 // Field of view for perspective camera
      , RENDERER = (Detector.webgl ? 'WebGL' : 'Canvas') + 'Renderer'
      , CAMSPEED = 0.4 // Speed of mouse camera rotation
      , RADIUS = 0 // Radius of initial sphere; used for comparison in fractal equation
      , NUM_VERTICES = 0 // Number of vertices in initial sphere

    return Backbone.View.extend({

        el: '#canvas',

        initialize: function () {
            W = this.$el.width();
            H = this.$el.height() - 4;

            this.lon = 0;
            this.lat = 0;

        // Scene
            this.scene = new THREE.Scene();

        // Placeholder Spheres
            //var geometry = new THREE.SphereGeometry(10, 20, 20),
            //    material = new THREE.MeshLambertMaterial({ color: 0xA9A9A9 }),
            //    sphere1  = new THREE.Mesh(geometry, material),
            //    sphere2  = new THREE.Mesh(geometry, material),
            //    sphere3  = new THREE.Mesh(geometry, material),
            //    sphere4  = new THREE.Mesh(geometry, material),
            //    sphere5  = new THREE.Mesh(geometry, material),
            //    sphere6  = new THREE.Mesh(geometry, material),
            //    sphere7  = new THREE.Mesh(geometry, material);

            //sphere2.position.x += 30;
            //sphere3.position.x -= 30;
            //sphere4.position.y += 30;
            //sphere5.position.y -= 30;
            //sphere6.position.z += 30;
            //sphere7.position.z -= 30;

            //this.scene.add(sphere1);
            //this.scene.add(sphere2);
            //this.scene.add(sphere3);
            //this.scene.add(sphere4);
            //this.scene.add(sphere5);
            //this.scene.add(sphere6);
            //this.scene.add(sphere7);

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

        // Render Fractal

            // Get starting sphere
            var sphere   = getIcosphere(1000000),
                vertices = sphere.geometry.vertices,
                faces    = sphere.geometry.faces;

            RADIUS = sphere.geometry.radius;

            // Transform sphere geometry into fractal geometry
            for (var i = 0; i < vertices.length; i++) {
              //vertices[i] = translateToFractalEdge(vertices[i], 1);
            }

            // Flatten faces+vertices into 1 dimensional array for geometry
            var positions = new Float32Array( faces.length * 3 * 3 );
            for ( var i = 0; i < faces.length; i++ ) {
              for ( var j = 0; j < 3; j++) {
                for ( var k = 0; k < 3; k++) {
                  positions[i*9 + j*3 + k] = vertices[faces[i][j]][k];
                }
              }
            }

            // Create geometry
            var geometry = new THREE.BufferGeometry()
            geometry.attributes = {
              position: {
                itemSize: 3,
                array: positions,
                numItems: sphere.faces * 3 * 3
              },
              normal: {
                itemSize: 3,
                array: positions, // Since fractal is centered at origin,
                numItems: sphere.faces * 3 * 3 // vertex positions ARE normals.
              },
              //color: {
              //  itemSize: 3,
              //  array: getArrayOf( sphere.faces * 3 * 3, 80 ),
              //  numItems: sphere.faces * 3 * 3
              //}
            };

            geometry.computeBoundingSphere();

            // Create mesh
            mesh = new THREE.Mesh(
              geometry,
              new THREE.MeshLambertMaterial({ color: 0xA9A9A9 })
            );

            // Add fractal to scene
            this.scene.add(mesh);


        // Rendering Helper Methods

            function getIcosphere(size) {
              var info = {
                vertices   : 12,
                edges      : 30,
                faces      : 20,
                iterations : 0
              };

              while (info.vertices + info.edges < size) {
                info.vertices += info.edges;
                info.edges    = (info.edges * 2) + (info.faces * 3);
                info.faces    *= 4;
                info.iterations++;
              }

              NUM_VERTICES = info.vertices;
              console.log(info)

              info.geometry = getIcosphereGeometry(info.iterations);

              return info;
            }

            function getIcosphereGeometry(iterations) {
              var t = (1.0 + Math.sqrt(5.0)) / 2.0,
                  vertices = [
                    [ -1,  t,  0 ],
                    [  1,  t,  0 ],
                    [ -1, -t,  0 ],
                    [  1, -t,  0 ],
                    [  0, -1,  t ],
                    [  0,  1,  t ],
                    [  0, -1, -t ],
                    [  0,  1, -t ],
                    [  t,  0, -1 ],
                    [  t,  0,  1 ],
                    [ -t,  0, -1 ],
                    [ -t,  0,  1 ]
                  ],
                  faces = [ // Numbers represent indices of vertices
                    // 5 faces around point 0
                    [ 0, 11,  5 ],
                    [ 0,  5,  1 ],
                    [ 0,  1,  7 ],
                    [ 0,  7, 10 ],
                    [ 0, 10, 11 ],

                    // 5 adjacent faces
                    [ 1,  5,  9 ],
                    [ 5,  11, 4 ],
                    [ 11, 10, 2 ],
                    [ 10, 7,  6 ],
                    [ 7,  1,  8 ],

                    // 5 faces around point 3
                    [ 3, 9, 4 ],
                    [ 3, 4, 2 ],
                    [ 3, 2, 6 ],
                    [ 3, 6, 8 ],
                    [ 3, 8, 9 ],

                    // 5 adjacent faces
                    [ 4, 9,  5 ],
                    [ 2, 4, 11 ],
                    [ 6, 2, 10 ],
                    [ 8, 6,  7 ],
                    [ 9, 8,  1 ]
                  ],
                  vhash = {}, // Used to speed up vertex index retrieval
                  radius = getDistFromCenter(vertices[0]);

              function getVertexIndex(v) {
                if (v[0] in vhash) {
                  if (v[1] in vhash[v[0]]) {
                    if (v[2] in vhash[v[0]][v[1]]) {
                      return vhash[v[0]][v[1]][v[2]];
                    } else {
                      vhash[v[0]][v[1]][v[2]] = vertices.length
                    }
                  } else {
                    var hash = {};

                    hash[v[2]] = vertices.length;
                    vhash[v[0]][v[1]] = hash;
                  }
                } else {
                  var hash1 = {}, hash2 = {};

                  hash1[v[2]] = vertices.length;
                  hash2[v[1]] = hash1;
                  vhash[v[0]] = hash2;
                }
                return vertices.push(v) - 1;
              }

              function getMidpoint(a, b) {
                var middle = [ (a[0] + b[0]) / 2,
                               (a[1] + b[1]) / 2,
                               (a[2] + b[2]) / 2 ],
                    currentDist = getDistFromCenter(middle),
                    v = push(middle, currentDist, radius);

                return getVertexIndex(v);
              }

              // Refine geometry
              for ( var i = 0; i < iterations; i++ ) {

                refinedFaces = new Array( faces.length * 4 )

                // For each face...
                for ( var j = 0; j < faces.length; j++ ) {
                  var a = getMidpoint(vertices[faces[j][0]], vertices[faces[j][1]]),
                      b = getMidpoint(vertices[faces[j][1]], vertices[faces[j][2]]),
                      c = getMidpoint(vertices[faces[j][2]], vertices[faces[j][0]]);

                  refinedFaces[(j * 4)    ] = [ faces[j][0], a, c ];
                  refinedFaces[(j * 4) + 1] = [ faces[j][1], b, a ];
                  refinedFaces[(j * 4) + 2] = [ faces[j][2], c, b ];
                  refinedFaces[(j * 4) + 3] = [           a, b, c ];
                }

                faces = refinedFaces;
              }
              return { faces: faces, vertices: vertices, radius: radius };
            }


          // Fractal Calculation Functions
            function vertexToPower(v, n) {
              var pow = Math.pow, sqrt = Math.sqrt,
                  sin = Math.sin, cos  = Math.cos,
                        atan2 = Math.atan2,

              x = v[0], y = v[1], z = v[2],

              radius = sqrt( pow(x, 2) + pow(y, 2) + pow(z, 2) ),
              theta  = atan2( sqrt( pow(x, 2) + pow(y, 2) ), z ),
              phi    = atan2( y, x );

              return [
                pow(radius, n) * sin(theta * n) * cos(phi * n),
                pow(radius, n) * sin(theta * n) * sin(phi * n),
                pow(radius, n) * cos(theta * n)
              ];
            }

            function isWithinSphere(v) {
              return [ Math.pow(v[0], 2),
                       Math.pow(v[1], 2),
                       Math.pow(v[2], 2) ] <= Math.pow(RADIUS, 2);
            }

          // Vertex Manipulation Functions
            function pushFromCenter(v, dist) {
              var distFromCenter = getDistFromCenter(v);
              return push(v, distFromCenter, distFromCenter + dist);
            }

            function getDistFromCenter(v) {
              return Math.sqrt( Math.pow(v[0], 2) +
                                Math.pow(v[1], 2) +
                                Math.pow(v[2], 2) );
            }

            function push(v, from, to) {
              return [ v[0] * (to / from),
                       v[1] * (to / from),
                       v[2] * (to / from) ];
            }

            function translateToFractalEdge(v, iterations) {
              return pushFromCenter(v, isWithinSphere(v) ? 1 : -1);
            }

          // General Helper Functions
            function getArrayOf(len, item) {
                var a, rem, currlen;

                if (len == 0) {
                    return [];
                }
                a = [item];
                currlen = 1;
                while (currlen < len) {
                    rem = len - currlen;
                    if (rem < currlen) {
                        a = a.concat(a.slice(0, rem));
                    }
                    else {
                        a = a.concat(a);
                    }
                    currlen = a.length;
                }
                return a;
            }
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
                canvas.camera.projectionMatrix.makePerspective(
                    FOV += canvas.getScrollDelta(event), W/H, 1, 1100
                );
                event.preventDefault();
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

    // Utility
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
