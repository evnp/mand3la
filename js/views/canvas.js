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

        // Placeholder Spheres
            var geometry = new THREE.SphereGeometry(10, 20, 20),
                material = new THREE.MeshLambertMaterial({ color: 0xA9A9A9 }),
                sphere1  = new THREE.Mesh(geometry, material),
                sphere2  = new THREE.Mesh(geometry, material),
                sphere3  = new THREE.Mesh(geometry, material),
                sphere4  = new THREE.Mesh(geometry, material),
                sphere5  = new THREE.Mesh(geometry, material),
                sphere6  = new THREE.Mesh(geometry, material),
                sphere7  = new THREE.Mesh(geometry, material);

            sphere2.position.x += 30;
            sphere3.position.x -= 30;
            sphere4.position.y += 30;
            sphere5.position.y -= 30;
            sphere6.position.z += 30;
            sphere7.position.z -= 30;

            this.scene.add(sphere1);
            this.scene.add(sphere2);
            this.scene.add(sphere3);
            this.scene.add(sphere4);
            this.scene.add(sphere5);
            this.scene.add(sphere6);
            this.scene.add(sphere7);

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
