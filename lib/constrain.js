"use strict";
module.exports = function (window) {
    require('./element-plugin.js')(window);

    var createHashMap = require('js-ext/extra/hashmap.js').createMap,
        PluginConstrain;

    window._ITSAmodules || Object.protectedProp(window, '_ITSAmodules', createHashMap());

/*jshint boss:true */
    if (PluginConstrain=window._ITSAmodules.PluginConstrain) {
/*jshint boss:false */
        return PluginConstrain;
    }

    window._ITSAmodules.PluginConstrain = PluginConstrain = window.document.definePlugin('constrain', null, {
            attrs: {
                selector: 'string'
            },
            defaults: {
                selector: 'window'
            }
        }
    );

    return PluginConstrain;
};