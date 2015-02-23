"use strict";
module.exports = function (window) {
    require('./lib/element-plugin.js')(window);
    return {
        Constrain: require('./lib/constrain.js')(window)
    };
};