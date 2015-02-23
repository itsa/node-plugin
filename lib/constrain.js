"use strict";
module.exports = function (window) {
    require('./element-plugin.js')(window);
    return window.document.definePlugin('constrain', null, {
            attrs: {
                selector: 'string'
            },
            defaults: {
                selector: 'window'
            }
        }
    );
};