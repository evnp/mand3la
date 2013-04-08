define([
    'jquery',
    'underscore',
    'backbone',

    'text!templates/main.html',
    'views/canvas',
    'views/controls'

], function ($, _, Backbone, mainTemplate, Canvas, Controls) {

    return Backbone.View.extend({

        el: '#content',

        render: function () {
            this.$el.html(mainTemplate);

            var canvas = new Canvas;
            (new Controls).render(canvas);
            canvas.render();

            $('#title .browser-warning').css(
                'display', window.chrome ? 'none' : 'visible'
            );
        }
    });
});
