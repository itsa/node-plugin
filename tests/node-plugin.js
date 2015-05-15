/*global describe, it, beforeEach, afterEach */
/*jshint unused:false */
(function (window) {

    "use strict";

    require("js-ext/lib/object.js");
    require("window-ext");
    // require('../partials/extend-element.js')(window);
    // require('../partials/extend-document.js')(window);

    var expect = require('chai').expect,
        should = require('chai').should(),
        plugins = require("../node-plugin.js")(window),
        NS = require('vdom/partials/vdom-ns.js')(window),
        timers = require('utils/lib/timers.js'),
        async = require('utils/lib/timers.js').async,
        later = require('utils/lib/timers.js').later,
        node, nodeSub1, nodeSub2;

    require("vdom")(window);
    require("constrain")(window);

    describe('General', function () {

        // bodyNode looks like this:
        /*
        <div>
            <div></div>
            <div></div>
        </div>
        */

        // Code to execute before every test.
        beforeEach(function() {
            node = window.document.createElement('div');
                nodeSub1 = window.document.createElement('div');
                node.appendChild(nodeSub1);

                nodeSub2 = window.document.createElement('div');
                node.appendChild(nodeSub2);

            window.document.body.appendChild(node);
        });

        // Code to execute after every test.
        afterEach(function() {
            window.document.body.removeChild(node);
            nodeSub1.unplug('constrain');
        });

        it('plug', function () {
            nodeSub1.plug('constrain');

            expect(nodeSub1.outerHTML.replace(' plugin-constrain="true"', '').replace(' constrain-ready="true"', '')).to.be.eql('<div constrain-selector="window"></div>');
            expect(nodeSub1.getOuterHTML().replace(' plugin-constrain="true"', '').replace(' constrain-ready="true"', '')).to.be.eql('<div constrain-selector="window"></div>');
            expect(nodeSub2.outerHTML).to.be.eql('<div></div>');
            expect(nodeSub2.getOuterHTML()).to.be.eql('<div></div>');

            nodeSub1.unplug('constrain');
            nodeSub1.plug('constrain', {selector: '#div1'});

            expect(nodeSub1.outerHTML.replace(' plugin-constrain="true"', '').replace(' constrain-ready="true"', '')).to.be.eql('<div constrain-selector="#div1"></div>');
            expect(nodeSub1.getOuterHTML().replace(' plugin-constrain="true"', '').replace(' constrain-ready="true"', '')).to.be.eql('<div constrain-selector="#div1"></div>');
            expect(nodeSub1.getAttr('constrain-ready')).to.be.equal('true');
            expect(nodeSub1.getAttr('plugin-constrain')).to.be.equal('true');
        });

        it('isPlugged', function () {
            expect(nodeSub1.isPlugged('constrain')).to.be.false;
            expect(nodeSub2.isPlugged('constrain')).to.be.false;

            expect(nodeSub1.outerHTML).to.be.eql('<div></div>');
            expect(nodeSub1.getOuterHTML()).to.be.eql('<div></div>');

            nodeSub1.plug('constrain');
            expect(nodeSub1.isPlugged('constrain')).to.be.true;
            expect(nodeSub2.isPlugged('constrain')).to.be.false;

            nodeSub1.unplug('constrain');
            expect(nodeSub1.isPlugged('constrain')).to.be.false;
            expect(nodeSub2.isPlugged('constrain')).to.be.false;

            nodeSub1.plug('constrain', {selector: '#div1'});
            expect(nodeSub1.isPlugged('constrain')).to.be.true;
            expect(nodeSub2.isPlugged('constrain')).to.be.false;

            nodeSub1.removeAttr('constrain-selector');
            expect(nodeSub1.isPlugged('constrain')).to.be.true;
        });

        it('unplug', function () {
            nodeSub1.plug('constrain');
            expect(nodeSub1.isPlugged('constrain')).to.be.true;
            nodeSub1.unplug('constrain');
            expect(nodeSub1.isPlugged('constrain')).to.be.false;
            expect(nodeSub1.getAttr('constrain-ready')===null).to.be.true;
            expect(nodeSub1.getAttr('plugin-constrain')===null).to.be.true;
        });

        it('changing attributes', function (done) {
            nodeSub1.plug('constrain');
            expect(nodeSub1.getAttr('constrain-selector')).to.be.equal('window');
            nodeSub1._plugin.constrain.model.selector = 'dummy';
            async(function() {
                // first async will make model sync with its attribute
                later(function() {
                    expect(nodeSub1.getAttr('constrain-selector')).to.be.equal('dummy');
                    done();
                }, 50);
            });
        });

        it('plug with modeldata', function (done) {
            nodeSub1.plug('constrain', null, {selector: 'dummy2'});
            async(function() {
                // first async will make model sync with its attribute
                later(function() {
                    expect(nodeSub1.getAttr('constrain-selector')).to.be.equal('dummy2');
                    done();
                }, 50);
            });
        });

        it('plug with config', function (done) {
            nodeSub1.plug('constrain', {selector: 'dummy3'});
            async(function() {
                // first async will make model sync with its attribute
                later(function() {
                    expect(nodeSub1.getAttr('constrain-selector')).to.be.equal('dummy3');
                    done();
                }, 50);
            });
        });

    });


}(global.window || require('node-win')));