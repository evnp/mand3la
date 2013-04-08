define([
    'jquery',
    'underscore',
    'backbone',
    'router', // Request router.js
], function($, _, Backbone, Router){
    var initialize = function(){
        // Pass in our Router module and call its initialize function
        Router.initialize();
    }

    return {
        initialize: initialize
    };
});
