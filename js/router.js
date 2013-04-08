define([
    'jquery',
    'underscore',
    'backbone',

    'views/main'

], function($, _, Backbone, MainView){

    var AppRouter = Backbone.Router.extend({

        routes: {
            // Default
            '*actions': 'showMain'
        },

        showMain: function(actions){
            this.mainView.render();
        }
    });

    var initialize = function(){
        var app_router = new AppRouter;
        app_router.mainView = new MainView;
        Backbone.history.start();
    };

    return {
        initialize: initialize
    };
});
