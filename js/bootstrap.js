require.config({
    paths: {
        jquery:     'libs/jquery/jquery-min',
        jqhotkeys:  'libs/jquery/plugins/jquery.hotkeys.min',
        jqlongkeys: 'libs/jquery/plugins/jquery.longkeys.min',
        underscore: 'libs/underscore/underscore-1.3.2-amd-min',
        backbone:   'libs/backbone/backbone-0.9.2-amd-min',
        three:      'libs/three/three.min',
        detector:   'libs/three/Detector',

        text: 'libs/require/text',
        templates: '../templates'
    }
});

require([ 'app' ], function(App) {
    App.initialize();
});
