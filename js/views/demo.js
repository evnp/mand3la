define([
    'jquery',
    'underscore',
    'backbone',

    'collections/cubes'

], function ($, _, Backbone, CubeCollection) {

    return Backbone.View.extend({

        initialize: function (canvas) {
            this.running = false;
            this.paused  = false;
            this.canvas  = canvas;
            this.actions = [];
            this.cubes   = new CubeCollection();

            var demo = this;
            this.cubes.on('add', function (cube) {
                demo.canvas.cubes.add(cube);
            });
            this.cubes.on('remove', function (cube) {
                demo.canvas.cubes.remove(cube);
            });

            // Add events for 'complete' trigger
            _.extend(this, Backbone.Events);
        },

        reset: function () {
            this.canvas.cubes.remove(this.cubes.toArray());
            this.cubes.reset();
        },

        start: function (regen, instructional) {
            if (regen) this.generateActions(instructional);
            this.reset();
            this.canvas.resetCamera();
            this.running = true;
            this.playActions(this.actions);
        },

        pause: function () { this.paused = true; },
        play:  function () { this.paused = false;  },

        playActions: function (actions) {

            var demo = this
              , canvas = this.canvas

              // Copy actions so that originals aren't modified
              , actions =  _.map(actions, function (action) {
                    var copy = _.clone(action);
                    if (copy.actions)
                        copy.actions = _.clone(copy.actions);
                    return copy;
                })

              // Set maintenance variables
              , index = frameNo = 0

              // Get the first action
              , action = actions[0];

            // Preform an action
            function doAction() {

                // Advance to the next action if necessary
                if (frameNo++ > action.frames) {

                    // If this is the end of a camera movement, reset
                    if (action.type === 'camera') // the reference plane
                        canvas.plane.lookAt(canvas.camera.position);

                    // Save for comparison to new description
                    var oldDescription = action.description,
                        oldTooltip     = action.tooltip;

                    action  = actions[++index];
                    frameNo = 0;

                    // If the new action has a different description
                    // remove the tooltip from the previous action.
                    // Otherwise, transfer the tooltip over.
                    if (!action || action.description !== oldDescription)
                         demo.removeTooltip(oldTooltip);
                    else action.tooltip = oldTooltip;

                    if (action) { // Set up the subjects for this action(s)
                        var subject;
                        _.each( action.actions || [action], function (act) {
                            subject = demo.cubes.at(act.subject || 0);
                            if (act.depth && subject)
                                subject = subject.get('children')[act.depth - 1];
                            act.cube   = subject;

                            // Frames are needed to divide the action
                            act.frames = action.frames;
                        });
                    }
                }

                // We've reached the end of the actions
                if (!action) return;

                _.each(action.actions || [action], function (action) {
                    if (action) handleAction(action);
                });

                function handleAction(action) {

                    if (action.type === 'camera') {
                        canvas.lon += demo.getChange(
                            action.lon, action.frames,
                            frameNo,   'easeInOut'
                        );
                        canvas.lat += demo.getChange(
                            action.lat, action.frames,
                            frameNo,   'easeInOut'
                        );

                    } else if (action.type === 'creation') {
                        demo.cubes.add({
                            position: action.pos,
                            size:     action.size
                        });
                        // Make sure only one cube is created
                        delete action.type;

                    } else if (action.type
                           &&  action.type.match(/position|rotation|scale/)
                           &&  action.cube) {

                        // Get the change vector for this fraction of the frame set
                        var diff = new THREE.Vector3(0, 0, 0);
                        _.each(['x', 'y', 'z'], function (a) {
                            diff[a] = demo.getChange(action.change[a],
                                                     action.frames,
                                                     frameNo,
                                                    'easeInOut');
                        });

                        action.cube.changeAttr(action.type, diff);

                        // Handle tooltip
                        if (action.tooltip)
                            demo.moveTooltip(action.tooltip,
                                             action.cube,
                                             action.alignment);

                    } else if (action.type === 'recursion'
                           &&  action.cube) {

                        // Get vectors used to link child cubes
                        var vectors = {
                            position: new THREE.Vector3( 0, 0, 0 ),
                            rotation: new THREE.Vector3( 0, 0, 0 ),
                            scale:    new THREE.Vector3( 1, 1, 1 )
                        };

                        // Don't add children to demo cube collection
                        canvas.cubes.add( canvas.flatMap(
                            action.cube.getRelated(), function (c) {
                                return c.recurse(0, vectors);
                            }
                        ));

                        action.type = 'position';
                        action.cube = _.last(action.cube.get('children'));
                    }

                    // Create tooltip for description
                    if (action.description && !action.tooltip) {
                        var cube = demo.cubes.last();
                        if (cube) action.tooltip = demo.placeTooltip(
                            action.description, cube,
                            action.alignment
                        );
                    }
                }
            }

            // Animation Loop
            function animate() {
                if (!demo.paused) doAction();
                if ( demo.running && action)
                    requestAnimationFrame(animate);
                else {
                    demo.trigger('complete');
                    demo.running = false;
                }
            }
            animate();
        },

        placeTooltip: function(text, cube, alignment) {

            // Create and place the tooltip
            return this.moveTooltip(
                this.canvas.$el.append(
                    '<div class="demo-tooltip">' + text + '</div>'
                // Use :last to make sure we get the right tooltip
                ).find('div.demo-tooltip:last'), cube, alignment
            ).css({ 'display': 'none' }).fadeIn();
        },

        moveTooltip: function(tooltip, cube, alignment) {
            var pos      = cube.get('position')
              , size     = cube.get('size')
              , scaleVec = cube.get('scale')
              , scale    = (scaleVec.x + scaleVec.y + scaleVec.z)/3

              , offset    = size * scale + 2
              , offsetPos = _.extend(_.clone(pos),
                    alignment === 'right'  ? { x: pos.x + offset } :
                    alignment === 'left'   ? { x: pos.x - offset } :
                    alignment === 'bottom' ? { y: pos.y - offset } :
                       /* default: top */    { y: pos.y + offset } )

              , screenPos = this.canvas.toScreenXY(offsetPos);

            tooltip.css({
                'top':  screenPos.y - tooltip.height()/2 - 3,
                'left': screenPos.x -
                    (alignment === 'right'  ? -80 :
                     alignment === 'left'   ? tooltip.width() + 80 :
                 /* default: top or bottom */ tooltip.width()/2    )
            });

            return tooltip;
        },

        removeTooltip: function(tooltip) {
            if (tooltip) tooltip.fadeOut( function () {
                $(this).remove();
            });
        },

        getChange: function (totalChange, frames, current, easing) {
            if (!easing)
                 return totalChange / frames;
            else return totalChange * this[easing](current, frames);
        },

        easeInOut: function (current, total) {
            return this.easeInOutFunc(current + 1, total) -
                   this.easeInOutFunc(current, total);
        },

        easeIn: function (current, total) {
            return this.easeInFunc(current + 1, total) -
                   this.easeInFunc(current, total);
        },

        easeOut: function (current, total) {
            return this.easeOutFunc(current + 1, total) -
                   this.easeOutFunc(current, total);
        },

        easeInOutFunc: function (current, total) {
            var half = total / 2;
            return current <= half ?
                 this.easeInFunc( current,        half) / 2 :
                 this.easeOutFunc(current - half, half) / 2 + 0.5;
        },

        easeInFunc: function (current, total) {
            return Math.pow(current / total, 4);
        },

        easeOutFunc: function (current, total) {
            return 1 - Math.pow(1 - (current / total), 4);
        },

        generateActions: function (instructional) {

            /*
            Create a cube:
                pos: the cube position
                size: the cube size

            Move the camera:
                type: 'pan'
                lon: change in longitude (degrees)
                lat: change in latitude  (degrees)

            Modify a cube:
                type: 'position'|'rotation'|'scale'
                change: a vector containing the 
                        amount to change the attribute
                subject: a number identifying the cube
                         to modify (by order of creation).
                         Doesn't include children.
                depth: a number indicating the level of
                       a recursion hierarchy to manipulate, 
                       omit for the root, 1 for 1st lvl
                       recursion, 2 for 2nd lvl

            Recurse a cube:
                type: 'recurse'
                change: a vector containing the
                        amount to move the new children
                subject: a number identifying the cube
                         to recurse (by order of creation)
                depth: a number indicating the level of
                       a recursion hierarchy to manipulate, 
                       omit for the root, 1 for 1st lvl
                       recursion, 2 for 2nd lvl

            Skip frames:
                type: null
            */

            this.actions = [{
                frames: 20,
                type: 'creation',
                pos: new THREE.Vector3(0, 0, 0),
                size: 10
            },{
                frames: 20
            },{
                frames: 60,
                type: 'recursion',
                change: new THREE.Vector3(0, 0, -this.random(5, 30))
            },{
                frames: 60,
                type: 'recursion',
                depth: 1,
                change: new THREE.Vector3(0, this.random(5, 30), 0)
            },{
                frames: 60,
                actions: [{
                    type: 'rotation',
                    depth: 1,
                    change: this.randomVector(-360, 360, 0.001)
                },{
                    type: 'rotation',
                    depth: 2,
                    change: this.randomVector(-360, 360, 0.001)
                },{
                    type: 'scale',
                    change: this.randomVector(-20, 0, 0.01, true)
                },{
                    type: 'scale',
                    depth: 1,
                    change: this.randomVector(-20, 0, 0.01, true)
                },{
                    type: 'scale',
                    depth: 2,
                    change: this.randomVector(-20, 0, 0.01, true)
                }]
            },{
                frames: 60,
                actions: [{
                    type: 'rotation',
                    depth: 1,
                    change: this.randomVector(-360, 360, 0.001)
                },{
                    type: 'rotation',
                    depth: 2,
                    change: this.randomVector(-360, 360, 0.001)
                },{
                    type: 'camera',
                    lon: 90,
                    lat: 0
                }]
            }];

            if (instructional) {

                var isMac = navigator.appVersion.indexOf('Mac') !== -1
                  , create = 'double-click to create a cube'
                  , scale  = isMac ? 'swipe with 2 fingers to scale' :
                                     'scroll mouse wheel to scale'
                  , move   = isMac ? '1 finger click and hold to move' :
                                     'hold left click to move'
                  , rotate = isMac ? '2 finger click and hold to rotate' :
                                     'hold right click to rotate'
                  , repeat = isMac ? 'hold &#8984; and move a cube to repeat' :
                                     'hold both to repeat'
                  , again  = 'repeat again for 3-dimensional recursion';

                this.actions.shift()
                this.actions[0].description = repeat;
                this.actions[1].description = repeat;
                this.actions[2].alignment   = 'left';
                this.actions[2].description = again;

                this.actions = [{
                    frames: 40
                },{
                    frames: 120,
                    type: 'creation',
                    pos: new THREE.Vector3(0, 0, 0),
                    size: 10,
                    description: create
                },{
                    frames: 20,
                    description: scale,
                    alignment: 'bottom'
                },{
                    frames: 30,
                    type: 'scale',
                    change: new THREE.Vector3(0.5, 0.5, 0.5),
                    description: scale,
                    alignment: 'bottom'
                },{
                    frames: 30,
                    type: 'scale',
                    change: new THREE.Vector3(-0.5, -0.5, -0.5),
                    description: scale,
                    alignment: 'bottom'
                },{
                    frames: 20,
                    description: 'hold left click to move',
                    description: move,
                    alignment: 'left'
                },{
                    frames: 60,
                    type: 'position',
                    change: new THREE.Vector3(0, 0, 20),
                    description: move,
                    alignment: 'left'
                },{
                    frames: 60,
                    type: 'position',
                    change: new THREE.Vector3(0, 0, -20),
                    description: move,
                    alignment: 'left'
                },{
                    frames: 20,
                    description: rotate,
                    alignment: 'right'
                },{
                    frames: 60,
                    type: 'rotation',
                    change: new THREE.Vector3(2, 2, 2),
                    description: rotate,
                    alignment: 'right'
                },{
                    frames: 60,
                    type: 'rotation',
                    change: new THREE.Vector3(-2, -2, -2),
                    description: rotate,
                    alignment: 'right'

                }].concat(this.actions);
            }
        },

        randomVector: function (a, b, factor, share) {
            factor = factor || 1; // Scale the randomized values
            var val;
            return share && // Should 1 or 3 randomized values be generated?
                (val = this.random(a, b) * factor) ?
                new THREE.Vector3(val, val, val) :
                new THREE.Vector3(
                    this.random(a, b) * factor,
                    this.random(a, b) * factor,
                    this.random(a, b) * factor
                );
        },

        random: function (a, b) {
            return Math.floor((Math.random()*(b-a))+1+a);
        }
    });
});
