define([
    'jquery',
    'underscore',
    'backbone',

    'models/cube'

], function($, _, Backbone, Cube){

    var CubeCollection = Backbone.Collection.extend({

        model: Cube,

        wireframes: function () {
            return this.pluck('wireframe');
        },

        getFromWireframe: function (wf) {
            return this.find( function (cube) {
                return cube.get('wireframe').id === (wf && wf.id);
            }) || null;
        },

        getFromIntersect: function (intersect) {
            return intersect && this.getFromWireframe(intersect.object);
        },

        moveAll: function (movement) {
            this.each( function (cube) { cube.move(movement); });
            return this;
        },

        rotateAll: function (movement, mouseX, mouseY) {
            this.each( function (cube) {
                cube.rotate(movement, mouseX, mouseY);
            });
            return this;
        },

        scaleAll: function (factor) {
            this.each( function (cube) { cube.scale(factor); });
            return this;
        },

        deselect: function (cube) {
            cube.select(false);
            this.remove(cube);
        },

        deselectAll: function () {
            this.each( function (cube) { cube.select(false); });
            this.reset();
            return this;
        }
    });

    return CubeCollection;
});
