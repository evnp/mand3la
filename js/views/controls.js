define([
    'jquery',
    'underscore',
    'backbone',
    'jqhotkeys',
    'jqlongkeys',

    'text!templates/controls.html',

    'views/demo'

], function ($, _, Backbone, hotkeys, longkeys, template, Demo) {

    return Backbone.View.extend({

        el: '#controls',

        render: function (canvas) {

            var controls = navigator.appVersion.indexOf('Mac') !== -1 ?
              [ 'double click - create cube'
              , 'double click on cube - delete cube'
              , 'click on cube - select cube'
              , 'click and hold - move selected cubes | rotate camera'
              , '2-finger click and hold - rotate selected cubes'
              , '2-finger swipe (scroll) - resize selected cubes | zoom camera'
              , '&#8984; + click and hold - recursively repeat selected cubes' ]
              :
              [ 'double click - create cube'
              , 'double click on cube - delete cube'
              , 'left click on cube - select cube'
              , 'hold left click - move selected cubes | rotate camera'
              , 'hold right click - rotate selected cubes'
              , 'hold left + right - recursively repeat selected cubes'
              , 'scroll wheel - resize selected cubes | zoom camera' ]

              , params = {
                    labels:  [],
                    entries: []
                };

            _.each( controls, function (control) {
                control = control.split(' - ');
                params.labels.push(control[0]);
                params.entries.push(control[1]);
            });

            // Render controls
            this.$el.html(_.template(template)(params));

            // Set up show/hide controls arrow
            var controls = $('#controls')
              , arrow = controls.find('div.show-hide')
              , text   = controls.find('div.text')
              , noFade = controls.find('div.no-fade');

            arrow.click(toggleControls);

            function toggleControls() {

                // Arrow Rotation:
                // jQuery can't animate transforms. So we animate a property
                // we don't care about (textIndent) and feed the value to a
                // step function that will set the transform value properly.
                var newAngle = parseFloat(arrow.css('text-indent')) ? 0 : -60;
                arrow.animate({ textIndent: newAngle }, {
                    step: function(angle) {
                        var value = 'rotate(' + angle + 'deg)';
                        arrow.css('-webkit-transform', value);
                        arrow.css('-moz-transform',    value);
                        arrow.css('transform',         value);
                    }
                });

                // Animate Controls
                if (newAngle === 0) {
                    noFade.animate({ top: -68 }, function () {
                        text.fadeIn();
                    });
                } else {
                    text.fadeOut( function () {
                        noFade.animate({ top: 298 });
                    });
                }
            }

            function hideControls() {
                if (text.is(':visible')) toggleControls();
            }

            function showControls() {
                if (text.is(':hidden')) toggleControls();
            }

            // Set up demo
            var demo   = new Demo(canvas)
              , button = this.$('#demo-btn')
              , start  = button.find('div,start')
              , pause  = button.find('div.pause')
              , play   = button.find('div.play')
              , replay = button.find('div.replay')
              , again  = replay.find('div.again')
              , regen  = replay.find('div.new')
              , firstRun = true;

            // Route events
            button.on('click',  controlDemo);
            demo.on('complete', completeDemo);

            function controlDemo() {
                if (!demo.running) {
                    start.fadeOut();
                    newDemo();
                    if (firstRun) hideControls();
                    firstRun = false;

                } else if (demo.paused) {
                    play.fadeOut();
                    pause.fadeIn();

                    demo.play();

                } else {
                    pause.fadeOut();
                    play.fadeIn();

                    demo.pause();
                }
            }

            function completeDemo() {
                button.find('div').fadeOut();
                replay.fadeIn();

                again.on(  'click', repeatDemo);
                regen.on(  'click', newDemo);
            }

            function repeatDemo() { resetDemo(); return false; }
            function newDemo()    { resetDemo(true, firstRun);  return false; }

            function resetDemo(regenActions, instructional) {
                replay.fadeOut();
                pause.fadeIn();

                again.off('click', repeatDemo);
                regen.off('click', newDemo);

                demo.start(regenActions, instructional);
            }
        }
    });
});
