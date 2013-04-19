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

      // Fractal Rendering Configuration
      , VERTICES   = 100000
      , BOUND      = 1000 // used for comparison in fractal equation
      , TOLERANCE  = 0.01 // how close vertices must be to fractal edge. ^ = higher performance
      , PUSH_DIST  = 0.1 // starting sampling density used to find fractal edge
      , ITERATIONS = 1 // number of iterations to calculate z to. Determines fractal detail.
      , MAX_ITERATIONS = 9
      , POWER      = 8 // power of fractal (8 is ideal)
      , RENDERING  = false;
      ;

    return Backbone.View.extend({

        el: '#canvas',

        initialize: function () {
            W = this.$el.width();
            H = this.$el.height() - 4;

            this.lon = 0;
            this.lat = 0;

        // Scene

            this.scene = new THREE.Scene();

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
            this.scene.add(this.camera);

        // Controls

            this.setupControls();

        // Lights

            var ambient = new THREE.AmbientLight( 0xffffff );
            ambient.color.setHSL( 0.1, 0.3, 0.2 );
            this.scene.add( ambient );


            var dirLight = new THREE.DirectionalLight( 0xffffff, 0.125 );
            dirLight.position.set( 0, -1, 0 ).normalize();
            this.scene.add( dirLight );

            dirLight.color.setHSL( 0.1, 0.7, 0.5 );

            var textureFlare0 = THREE.ImageUtils.loadTexture( "images/lensflare0.png" );
            var textureFlare2 = THREE.ImageUtils.loadTexture( "images/lensflare1.png" );
            var textureFlare3 = THREE.ImageUtils.loadTexture( "images/lensflare2.png" );

            addLight( 0.55,  0.9, 0.5, 50, -50, -1, this.scene );
            addLight( 0.08,  0.8, 0.5, 0, 50, -1, this.scene );
            //addLight( 0.995, 0.5, 0.9, 50,50, -1, this.scene );

            function addLight( h, s, l, x, y, z, scene ) {

              var light = new THREE.PointLight( 0xffffff, 1.5, 4500 );
              light.color.setHSL( h, s, l );
              light.position.set( x, y, z );
              scene.add( light );

              var flareColor = new THREE.Color( 0xffffff );
              flareColor.setHSL( h, s, l + 0.5 );

              var lensFlare = new THREE.LensFlare( textureFlare0, 700, 0.0, THREE.AdditiveBlending, flareColor );

              lensFlare.add( textureFlare2, 512, 0.0, THREE.AdditiveBlending );
              lensFlare.add( textureFlare2, 512, 0.0, THREE.AdditiveBlending );
              lensFlare.add( textureFlare2, 512, 0.0, THREE.AdditiveBlending );

              lensFlare.add( textureFlare3, 60, 0.6, THREE.AdditiveBlending );
              lensFlare.add( textureFlare3, 70, 0.7, THREE.AdditiveBlending );
              lensFlare.add( textureFlare3, 120, 0.9, THREE.AdditiveBlending );
              lensFlare.add( textureFlare3, 70, 1.0, THREE.AdditiveBlending );

              lensFlare.customUpdateCallback = lensFlareUpdateCallback;
              lensFlare.position = light.position;

              scene.add( lensFlare );
            }

            function lensFlareUpdateCallback( object ) {
              var f, fl = object.lensFlares.length;
              var flare;
              var vecX = -object.positionScreen.x * 2;
              var vecY = -object.positionScreen.y * 2;


              for( f = 0; f < fl; f++ ) {

                   flare = object.lensFlares[ f ];

                   flare.x = object.positionScreen.x + vecX * flare.distance;
                   flare.y = object.positionScreen.y + vecY * flare.distance;

                   flare.rotation = 0;

              }

              object.lensFlares[ 2 ].y += 0.025;
              object.lensFlares[ 3 ].rotation = object.positionScreen.x * 0.5 + THREE.Math.degToRad( 45 );

            }


        // Renderer

            this.renderer = new THREE[RENDERER]();

            this.renderer.gammaInput = true;
            this.renderer.gammaOutput = true;
            this.renderer.physicallyBasedShading = true;

        // Misc.

            var canvas = this;
            window.addEventListener( 'resize', onWindowResized, false );

            function onWindowResized( event ) {
                canvas.renderer.setSize( W, H );
                canvas.camera.projectionMatrix.makePerspective( FOV, W/H, 1, 1100 );
            }

            onWindowResized(null);

        // Create Geometry

            this.geometry = this.getIcosphere(VERTICES);

        // Render Fractal

            this.renderFractal(POWER, ITERATIONS);
        },

    // Icosphere Generator

        getIcosphere: function (maxVertices, seed) {
          if (!seed) seed = this.getIcosahedron();

          var vhash = {}, // Used to speed up vertex index retrieval
              vertices = seed.vertices,
              faces    = seed.faces,
              radius = getDistFromCenter(vertices[0]),
              iterations = getIterations(seed, maxVertices);

          // Gets the number of face-split steps needed to reach maxVertices
          function getIterations(shape, maxVertices) {
            var verts = shape.vertices.length,
                faces = shape.faces.length,
                edges = shape.numEdges,
                iterations = 0;

            while (verts + edges < maxVertices) {
              verts += edges;
              edges = (edges * 2) + (faces * 3);
              faces *= 4;
              iterations++;
            }
            return iterations;
          }

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

          // Refine geometry into icosphere
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

          // Initialize normals as copy of vertices
          var normals = new Array(vertices.length);
          for (var i = 0; i < vertices.length; i++)
            normals[i] = vertices[i].slice();

          return { faces: faces, vertices: vertices, normals: normals };

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
        },

    // Fractal Renderer

        renderFractal: function (power, iteration) {

          var vertices = this.geometry.vertices,
                 faces = this.geometry.faces,
               normals = this.geometry.normals;

          // Transform sphere geometry into fractal geometry
          for (var i = 0; i < vertices.length; i++) {
            vertices[i] = translateToFractalEdge(vertices[i], normals[i], power, iteration);
            //vertices[i][2] *= -1; // Cool transparency effect
          }

            // Progressive iteration
            //for (var i = 0; i < faces.length; i++) {
            //  for (var j = 0; j < 3; j++) {
            //    vertices[faces[i][j]] = translateToFractalEdge(vertices[faces[i][j]], power, 2);
            //  }
            //}
            //for (var i = 0; i < faces.length / 20; i++) {
            //  for (var j = 0; j < 3; j++) {
            //    vertices[faces[i][j]] = translateToFractalEdge(vertices[faces[i][j]], power, 4);
            //  }
            //}
            //for (var i = 0; i < faces.length / 80; i++) {
            //  for (var j = 0; j < 3; j++) {
            //    vertices[faces[i][j]] = translateToFractalEdge(vertices[faces[i][j]], power, 6);
            //  }
            //}

          // Find and split elongated faces
          //for (var i = 0; i < faces.length; i++) {
          //  var length = getFaceLength(faces[i]);
          //}

          // Compute normals
          if (iteration === 1) { // iteration 1 is a sphere - normals = vertices
            for (var i = 0; i < vertices.length; i++)
              normals[i] = vertices[i].slice();

          } else {
            for (var i = 0; i < faces.length; i++) {
              var normal = normalize( vertices[faces[i][0]],
                                      vertices[faces[i][1]],
                                      vertices[faces[i][2]] );

              normals[faces[i][0]] = vavg(normal, normals[faces[i][0]]);
              normals[faces[i][1]] = vavg(normal, normals[faces[i][1]]);
              normals[faces[i][2]] = vavg(normal, normals[faces[i][2]]);
            }
          }

          // Flatten faces+vertices into 1 dimensional array for geometry
          var flatVertices = new Float32Array( faces.length * 3 * 3 );
          var flatNormals  = new Float32Array( faces.length * 3 * 3 );
          for ( var i = 0; i < faces.length; i++ ) {
            for ( var j = 0; j < 3; j++) {
              for ( var k = 0; k < 3; k++) {
                flatVertices[i*9 + j*3 + k] = vertices[faces[i][j]][k];
                 flatNormals[i*9 + j*3 + k] = normals[faces[i][j]][k];
              }
            }
          }

      // Create geometry

          var geometry = new THREE.BufferGeometry()
          geometry.attributes = {
            position: {
              itemSize: 3,
              array: flatVertices,
              numItems: flatVertices.length
            },
            normal: {
              itemSize: 3,
              array: flatNormals,
              numItems: flatNormals.length
            }
          };

          geometry.computeBoundingSphere();

      // Create material

          var material = new THREE.MeshPhongMaterial({
            ambient: 0x333333,
            color: 0xffffff,
            specular: 0xffffff,
            shininess: 50
          });

      // Create mesh

          // Get rid of old mesh if necessary
          if (this.mesh) {
            this.scene.remove(this.mesh);
          }

          this.mesh = new THREE.Mesh( geometry, material );

          // Rotate 90deg so that fractal is upright
          this.mesh.rotation.x = -(Math.PI/2);

          // Add fractal to scene
          this.scene.add(this.mesh);

      // Update Fractal Information
          var info = $('#info');
          info.find('.power .value'    ).html(POWER);
          info.find('.iteration .value').html(ITERATIONS);
          info.find('.vertices .value' ).html(VERTICES / 1000 + 'k');

      // Fractal Calculation Functions

          function translateToFractalEdge(vertex, normal, power, iteration) {
            var zDist = 0,
             pushDist = PUSH_DIST,
                start = true,  // Indicates whether this is the first pass
               inside = false, // Indicates whether the point is inside the fractal
             switched = false; // Indicates when a point has changed direction

            vertex = vmult(vertex, 0.5); // Factor down v to avoid _huge_ values of z

            while (!atFractalEdge(zDist)) {
              zDist = getDistFromCenter(getZn(vertex, power, iteration));

              if (zDist < BOUND) {
                vertex = pushOut(vertex, pushDist);
                //vertex = pushAlongNormal(vertex, normal, pushDist);

                if (start) inside = true, start = false;
                else if (!inside) switched = true;

              } else {
                vertex = pushIn(vertex, pushDist);
                //vertex = pushAlongNormal(vertex, normal, -pushDist);

                if (start) inside = false, start = false;
                else if (inside) switched = true;
              }
              // If the point has changed direction, we are near the fractal edge.
              // Start halving pushDist to hone in.
              if (switched) pushDist /= 2;
            }
            return vertex;
          }

          function atFractalEdge(dist) {
            return Math.abs(dist - BOUND) < TOLERANCE;
          }

          // Mandelbrot Equation
          // z(0) = 0            (complex zero)
          // z(1) = c            ( z(0)^p + c )
          // z(n+1) = z(n)^p + c

          function getZn(v, p, n) {
            var z = [ 0, 0, 0 ];
            for (n; n >= 0; n--)
              z = vadd(vpow(z, p), v);
            return z;
          }

      // Vertex Manipulation Functions

          function pushIn(v, dist) { return pushOut(v, -dist); }
          function pushOut(v, dist) {
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

          function pushAlongNormal(v, n, dist) {
            return vadd(v, vmult(n, dist));
          }

          function vadd(a, b) {
            return [ a[0] + b[0],
                     a[1] + b[1],
                     a[2] + b[2] ];
          }

          function vsub(a, b) {
            return [ a[0] - b[0],
                     a[1] - b[1],
                     a[2] - b[2] ];
          }

          function vmult(a, f) {
            return [ a[0] * f,
                     a[1] * f,
                     a[2] * f ];
          }

          function vdiv(a, d) {
            return [ a[0] / d,
                     a[1] / d,
                     a[2] / d ];
          }

          function vavg(a, b) {
            return b ? vdiv(vadd(a, b), 2) : a;
          }

          function vpow(v, n) {
            if (v === [ 0, 0, 0 ]) return v;

            var pow = Math.pow, sqrt = Math.sqrt,
                sin = Math.sin, cos  = Math.cos,
                      atan2 = Math.atan2,

            x = v[0], y = v[1], z = v[2],

            radius = sqrt( pow(x, 2) + pow(y, 2) + pow(z, 2) ),
            theta  = atan2( sqrt( pow(x, 2) + pow(y, 2) ), z ),
            phi    = atan2( y, x );

            return [ pow(radius, n) * sin(theta * n) * cos(phi * n),
                     pow(radius, n) * sin(theta * n) * sin(phi * n),
                     pow(radius, n) * cos(theta * n) ];
          }

          // TODO: This thing doesn't work properly! GL debugging.
          function vpowFast(v, n) {
            if (n !== 8) return vpow(v, n);

            var p = Math.pow;
            function r(a, b, n) { return p(a, n) + p(b, n); }

            var x = v[0],
                y = v[1],
                z = v[2],
                rxy2 = r(x,y,2),
                rxy4 = r(x,y,4),
                a = 1 + (( p(z,8) - (28 * p(z,6) * rxy2) +
                                    (70 * p(z,4) * rxy4) -
                                    (28 * p(z,2) * r(x,y,6)) ) / r(x,y,8) );

            return [
              a * (p(x,8) - (28 * p(x,6) * p(y,2)) +
                            (70 * p(x,4) * p(y,4)) -
                            (28 * p(x,2) * p(y,6)) + p(y,8)),

              8 * a * x * y * (p(x,6) - (7 * p(x,4) * p(y,2)) +
                                        (7 * p(x,2) * p(y,4)) - p(y,6)),

              8 * z * Math.sqrt(rxy2) * (p(z,2) - rxy2) *
                  (p(z,4) - (6 * p(z,2) * rxy2) + rxy4)
            ];
          }

          function normalize(a, b, c) {
              var x = crossProduct(vsub(a, b), vsub(a, c));
              return vdiv(x, getDistFromCenter(x));
          }

          function crossProduct(a, b) {
            return [ (a[1] * b[2]) - (a[2] * b[1]),
                     (a[2] * b[0]) - (a[0] * b[2]),
                     (a[0] * b[1]) - (a[1] * b[0]) ];
          }

          function getFaceLength(face) {
            var a = getDistFromCenter(vertices[face[0]]),
                b = getDistFromCenter(vertices[face[1]]),
                c = getDistFromCenter(vertices[face[2]]);

            return Math.max(a, b, c) - Math.min(a, b, c);
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

        setupControls: function () {
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
                        canvas.lon = ( e.clientX - mouseX ) * (CAMSPEED * (FOV / 2)) + mouseLon;
                        canvas.lat = ( e.clientY - mouseY ) * (CAMSPEED * (FOV / 2)) + mouseLat;
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
                    FOV += (canvas.getScrollDelta(event) * (FOV / 12)), W/H, 1, 1100
                );
                event.preventDefault();
            }

        // Fractal Controls
            $(document).on('keydown', function (e) {

              if (
                e.which === 38 || // up
                e.which === 40 || // down
                e.which === 37 || // left
                e.which === 39 || // right
               (e.which > 48 && e.which < 58) // number
              ) {
                var rerender = false;

                if (e.which === 37) {
                  if (PUSH_DIST < 0.1) {
                    TOLERANCE = 0.01;
                    PUSH_DIST = 0.1;

                    canvas.geometry = canvas.getIcosphere(
                      VERTICES, canvas.getIcosahedron()
                    );
                    rerender = true;

                  } else if (VERTICES > 200000){
                    VERTICES -= 200000;
                    rerender = true;
                  }

                } else if (e.which === 39) {
                  if (VERTICES < 500000) {
                    VERTICES += 200000;
                    rerender = true;

                  } else if (PUSH_DIST === 0.1) {
                    TOLERANCE *= 0.2;
                    PUSH_DIST *= 0.2;
                    console.log(PUSH_DIST)

                    canvas.geometry = canvas.getIcosphere(
                      VERTICES, canvas.getIcosahedron(2)
                    );
                    rerender = true;

                  } else if (PUSH_DIST < 0.1 && PUSH_DIST > 0.01){
                    TOLERANCE *= 0.2;
                    PUSH_DIST *= 0.2;

                    canvas.geometry = canvas.getIcosphere(
                      VERTICES, canvas.getIcosahedron(1)
                    );
                    rerender = true;
                  }

                } else if (e.which === 38) {
                  if (ITERATIONS < MAX_ITERATIONS) ITERATIONS++, rerender = true;

                } else if (e.which === 40) {
                  if (ITERATIONS > 1) ITERATIONS--, rerender = true;

                } else if (e.which > 49 && e.which < 58) {
                  POWER = e.which - 48, rerender = true;
                }

                if (rerender) canvas.renderFractal(POWER, ITERATIONS);
              }
              e.preventDefault();
            });
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
        getIcosahedron: function (numFaces) {
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
              ];

          numFaces = numFaces || faces.length;
          return { faces: faces.slice(0, numFaces), vertices: vertices, numEdges: 30 };
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
        }
    });
});
