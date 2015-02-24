"use strict";

/**
 * Integrates DOM-events to event. more about DOM-events:
 * http://www.smashingmagazine.com/2013/11/12/an-introduction-to-dom-events/
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @module vdom
 * @submodule element-plugin
 * @class Plugins
 * @since 0.0.1
*/

require('js-ext/lib/object.js');
require('js-ext/lib/string.js');
require('polyfill');
require('event/extra/timer-finalize.js');

var createHashMap = require('js-ext/extra/hashmap.js').createMap,
    fromCamelCase = function(input) {
        return input.replace(/[a-z]([A-Z])/g, function(match, group) {
            return match[0]+'-'+group.toLowerCase();
        });
    };

module.exports = function (window) {

    window._ITSAmodules || Object.protectedProp(window, '_ITSAmodules', createHashMap());

    if (window._ITSAmodules.ElementPlugin) {
        return; // ElementPlugin was already created
    }

    require('vdom')(window);

    var NAME = '[ElementPlugin]: ',
        Classes = require('js-ext/extra/classes.js'),
        timers = require('utils/lib/timers.js'),
        IO = require('io')(window),
        Event = require('event-dom')(window),
        asyncSilent = timers.asyncSilent,
        laterSilent = timers.laterSilent,
        DELAY_DESTRUCTION = 5000, // must be kept below vnode.js its DESTROY_DELAY (which is currently 60000)
        DELAYED_EVT_TIME = 500,
        NATIVE_OBJECT_OBSERVE = !!Object.observe,
        DOCUMENT = window.document,
        types = [],
        NODE = 'node',
        REMOVE = 'remove',
        INSERT = 'insert',
        CHANGE = 'change',
        ATTRIBUTE = 'attribute',
        NODE_REMOVE = NODE+REMOVE,
        NODE_INSERT = NODE+INSERT,
        NODE_CONTENT_CHANGE = NODE+'content'+CHANGE,
        ATTRIBUTE_REMOVE = ATTRIBUTE+REMOVE,
        ATTRIBUTE_CHANGE = ATTRIBUTE+CHANGE,
        ATTRIBUTE_INSERT = ATTRIBUTE+INSERT,
        MUTATION_EVENTS = [NODE_REMOVE, NODE_INSERT, NODE_CONTENT_CHANGE, ATTRIBUTE_REMOVE, ATTRIBUTE_CHANGE, ATTRIBUTE_INSERT],
        Base, pluginDOM, modelToAttrs, attrsToModel, syncPlugin, autoRefreshPlugin, pluginDOMresync, DEFAULT_DELAYED_FINALIZE_EVENTS;

    Object.protectedProp(window, '_ITSAPlugins', createHashMap());

    /**
     * Default internal hash containing all DOM-events that will not directly call `event-finalize`
     * but after a delay of 1 second
     *
     * @property DEFAULT_DELAYED_FINALIZE_EVENTS
     * @default {
     *    mousedown: true,
     *    mouseup: true,
     *    mousemove: true,
     *    panmove: true,
     *    panstart: true,
     *    panleft: true,
     *    panright: true,
     *    panup: true,
     *    pandown: true,
     *    pinchmove: true,
     *    rotatemove: true,
     *    focus: true,
     *    manualfocus: true,
     *    keydown: true,
     *    keyup: true,
     *    keypress: true,
     *    blur: true,
     *    resize: true,
     *    scroll: true
     * }
     * @type Object
     * @private
     * @since 0.0.1
    */
    DEFAULT_DELAYED_FINALIZE_EVENTS = {
        mousedown: true,
        mouseup: true,
        mousemove: true,
        panmove: true,
        panstart: true,
        panleft: true,
        panright: true,
        panup: true,
        pandown: true,
        pinchmove: true,
        rotatemove: true,
        focus: true,
        manualfocus: true,
        keydown: true,
        keyup: true,
        keypress: true,
        blur: true,
        resize: true,
        scroll: true
    };

    pluginDOM = function(NewClass) {
        // asynchroniously we check all current elements and render when needed:
        var ns = NewClass.prototype.$ns;
        asyncSilent(function() {
            var elements = DOCUMENT.getAll('[plugin-'+ns+'="true"]'),
                len = elements.length,
                element, i;
            for (i=0; i<len; i++) {
                element = elements[i];
                element.plug(NewClass);
            }
        });
    };

    pluginDOMresync = function(NewClass) {
        // asynchroniously we check all current elements and render when needed:
        var ns = NewClass.prototype.$ns;
        asyncSilent(function() {
            var elements = DOCUMENT.getAll('[plugin-'+ns+'="true"]'),
                len = elements.length,
                element, i;
            for (i=0; i<len; i++) {
                element = elements[i];
                syncPlugin(element[ns]);
            }
        });
    };

    attrsToModel = function(plugin, config) {
        var host = plugin.host,
            attrs = plugin.attrs,
            defaults = plugin.defaults,
            ns = plugin.$ns + '-',
            attrValue, validValue;
        config || (config={});
        // read the current ns-attributes on the node, overrule them with config and set the new attributes
        attrs.each(function(value, key) {
            attrValue = config[key] || host.getAttr(ns+key) || defaults[key];
            if (attrValue) {
                switch (value.toLowerCase()) {
                    case 'boolean':
                        validValue = attrValue.validateBoolean();
                        attrValue = (attrValue==='true');
                        break;
                    case 'number':
                        validValue = attrValue.validateFloat();
                        attrValue = parseFloat(attrValue);
                        break;
                    case 'date':
                        validValue = attrValue.validateDate();
                        attrValue = attrValue.toDate();
                        break;
                    case 'string':
                        validValue = true;
                        break;
                    default:
                        validValue = false;
                }
            }
            else if (value.toLowerCase()==='boolean') {
                // undefined `boolean` attributes need to be stored as `false`
                validValue = true;
                attrValue = false;
            }
            else {
                validValue = false;
            }
            if (validValue && !plugin.model[key]) {
                plugin.model[key] = attrValue;
            }
        });
    };

    modelToAttrs = function(plugin) {
        console.log(NAME+'modelToAttrs');
        var attrs = plugin.attrs,
            model = plugin.model,
            domElement = plugin.host,
            ns = plugin.$ns,
            newAttrs = [];
        attrs.each(function(value, key) {
            model[key] && (newAttrs[newAttrs.length] = {name: ns+'-'+fromCamelCase(key), value: model[key]});
        });
        if (newAttrs.length>0) {
            console.warn('modelToAttrs '+JSON.stringify(newAttrs));
            domElement.setAttrs(newAttrs, true);
        }
    };

    syncPlugin = function(plugin) {
        modelToAttrs(plugin);
        plugin.sync();
    };

    autoRefreshPlugin = function(plugin) {
        if (!NATIVE_OBJECT_OBSERVE) {
            plugin._EventFinalizer = Event.finalize(function(e) {
                var type = e.type;
                if (!e._noRender && (!e.status || !e.status.renderPrevented)) {
                    if (!MUTATION_EVENTS[type] && !type.endsWith('outside')) {
                        if (plugin._DELAYED_FINALIZE_EVENTS[type]) {
                            types.push(type);
                            plugin.constructor.$registerDelay || (plugin.constructor.$registerDelay = laterSilent(function() {
                                console.info('Event-finalizer will delayed-refresh itags because of events: '+JSON.stringify(types));
                                syncPlugin(plugin);
                                types.length = 0;
                                plugin.constructor.$registerDelay = null;
                            }, DELAYED_EVT_TIME));
                        }
                        else {
                            console.info('Event-finalizer will refresh itags because of event: '+type);
                            syncPlugin(plugin);
                        }
                    }
                }
            });

            plugin._IOFinalizer = IO.finalize(function() {
                syncPlugin(plugin);
            });
        }
    };

    // extend window.Element:
    window.Element && (function(ElementPrototype) {
        ElementPrototype.plugin = {};

       /**
        * Checks whether the plugin is plugged in at the HtmlElement. Checks whether all its attributes are set.
        *
        * @method isPlugged
        * @param PluginClass {NodePlugin} The plugin that should be plugged. Needs to be the Class, not an instance!
        * @return {Boolean} whether the plugin is plugged in
        * @since 0.0.1
        */
        ElementPrototype.isPlugged = function(PluginClass) {
            return !!this.ns && !!this.ns[PluginClass.prototype.$ns];
        };

       /**
        * Plugs in the plugin on the HtmlElement, and gives is special behaviour by setting the appropriate attributes.
        *
        * @method plug
        * @param PluginClass {NodePlugin} The plugin that should be plugged. Needs to be the Class, not an instance!
        * @param [config] {Object} any config that should be passed through when the class is instantiated.
        * @param [model] {Object} model to used as `ns.model`
        * @chainable
        * @since 0.0.1
        */
        ElementPrototype.plug = function(PluginClass, config, model) {
            var instance = this;
            if (!instance.isPlugged(PluginClass)) {
                instance.ns || Object.protectedProp(instance, 'ns', {});
                instance.ns[PluginClass.prototype.$ns] = new PluginClass(instance, config, model);
            }
            else {
                console.warn('ElementPlugin '+PluginClass.prototype.$ns+' already plugged in');
            }
            return instance;
        };

       /**
        * Unplugs a NodePlugin from the HtmlElement.
        *
        * @method unplug
        * @param PluginClass {NodePlugin} The plugin that should be unplugged. Needs to be the Class, not an instance!
        * @chainable
        * @since 0.0.1
        */
        ElementPrototype.unplug = function(PluginClass) {
            var instance = this;
            instance.isPlugged(PluginClass) && instance.ns[PluginClass.prototype.$ns].destroy();
            return instance;
        };
    }(window.Element.prototype));

    Base = Classes.createClass(
        function (hostElement, config, model) {
            var instance = this,
                ns = instance.$ns;
            instance.host = hostElement;
            hostElement.plugin[ns] = instance;
            instance.model = Object.isObject(model) ? model : {};
            attrsToModel(instance, config);
            hostElement.setAttr('plugin-'+ns, 'true', true);
            syncPlugin(instance);
            autoRefreshPlugin(instance);
            (hostElement.getAttr(ns+'-ready')==='true') || instance.render();
            hostElement.setAttr(ns+'-ready', 'true', true);
        },
        {
            _DELAYED_FINALIZE_EVENTS: DEFAULT_DELAYED_FINALIZE_EVENTS.shallowClone(),
            attrs: {},
            defaults: {},
           /**
            * Binds a model to the plugin, making plugin.model equals the bound model.
            * Immediately syncs the plugin with the new model-data.
            *
            * Syncs the new vnode's childNodes with the dom.
            *
            * @method bindModel
            * @param model {Object} the model to bind to the itag-element
            * @param [mergeCurrent=false] {Boolean} when set true, current properties on the plugin's model that aren't defined
            *        in the new model, get merged into the new model.
            * @since 0.0.1
            */
            bindModel: function(model, mergeCurrent) {
                console.log(NAME+'bindModel');
                var instance = this,
                    observer;
                if (instance.model!==model) {
                    instance.removeAttr('bound-model');
                    if (NATIVE_OBJECT_OBSERVE) {
                        observer = instance._observer;
                        observer && Object.unobserve(instance.model, observer);
                    }
                    mergeCurrent && (model.merge(instance.model, {full: true}));
                    instance.model = model;
                    if (NATIVE_OBJECT_OBSERVE) {
                        observer = function() {
                            syncPlugin(instance);
                        };
                        Object.observe(instance.model, observer);
                        instance._observer = observer;
                    }
                    syncPlugin(instance);
                }
            },
           /**
            * Defines which domevents should lead to a direct sync by the Event-finalizer.
            * Only needed for events that are in the list set by DEFAULT_DELAYED_FINALIZE_EVENTS:
            *
            * <ul>
            *     <li>mousedown</li>
            *     <li>mouseup</li>
            *     <li>mousemove</li>
            *     <li>panmove</li>
            *     <li>panstart</li>
            *     <li>panleft</li>
            *     <li>panright</li>
            *     <li>panup</li>
            *     <li>pandown</li>
            *     <li>pinchmove</li>
            *     <li>rotatemove</li>
            *     <li>focus</li>
            *     <li>manualfocus</li>
            *     <li>keydown</li>
            *     <li>keyup</li>
            *     <li>keypress</li>
            *     <li>blur</li>
            *     <li>resize</li>
            *     <li>scroll</li>
            * </ul>
            *
            * Events that are not in this list don't need to be set: they always go through the finalizer immediatly.
            *
            * You need to set this if the itag-definition its `sync`-method should be updated after one of the events in the list.
            *
            * @method setItagDirectEventResponse
            * @param ItagClass {Class} The ItagClass that wants to register
            * @param domEvents {Array|String} the domevents that should directly make the itag sync
            * @since 0.0.1
            */
            setDirectEventResponse :function(domEvents) {
                console.log(NAME+'setDirectEventResponse');
                var instance = this;
                if (!NATIVE_OBJECT_OBSERVE) {
                    Array.isArray(domEvents) || (domEvents=[domEvents]);
                    domEvents.forEach(function(domEvent) {
                        domEvent.endsWith('outside') && (domEvent=domEvent.substr(0, domEvent.length-7));
                        domEvent = domEvent.toLowerCase();
                        if (domEvent==='blur') {
                            console.warn('the event "blur" cannot be delayed, for it would lead to extremely many syncing before anything changes which you don\'t need');
                        }
                        else {
                            if (DEFAULT_DELAYED_FINALIZE_EVENTS[domEvent]) {
                                ('DELAYED_FINALIZE_EVENTS' in instance.constructor.prototypes) || instance.mergePrototypes({'DELAYED_FINALIZE_EVENTS': DEFAULT_DELAYED_FINALIZE_EVENTS.shallowClone()});
                                delete instance.DELAYED_FINALIZE_EVENTS[domEvent];
                            }
                        }
                    });
                }
            },
            render: function() {
                // defaults to NOOP
            },
            sync: function() {
                // defaults to NOOP
            },
            destroy: function () {
                var instance = this,
                    host = instance.host,
                    attrs = instance.attrs,
                    ns = instance.$ns,
                    observer;
                if (NATIVE_OBJECT_OBSERVE) {
                    observer = instance._observer;
                    if (observer) {
                        Object.unobserve(instance.model, observer);
                        delete instance._observer;
                    }
                }
                else {
                    instance._EventFinalizer.detach();
                    instance._IOFinalizer.detach();
                }
                attrs.each(
                    function(value, key) {
                        host.removeAttr(ns+'-'+fromCamelCase(key), true);
                    }
                );
                host.setAttr('plugin-'+ns, true);
                host.setAttr(ns+'-ready', true);
                delete host.ns[instance.$ns];
            },
            $ns: 'undefined-namespace'
        }
    );

    // Whenever elements are added: check for plugins and initialize them
    Event.after('UI:'+NODE_INSERT, function(e) {
        var element = e.target;
        // to prevent less userexperience, we plug asynchroniously
        asyncSilent(function() {
            var attrs = element.vnode.attrs,
                ns, Plugin;
            attrs && attrs.each(function(value, key) {
                if (key.substr(0, 7)==='plugin-') {
                    ns = key.substr(7);
                    Plugin = window._ITSAPlugins[ns];
                    Plugin && element.plug(Plugin);
                }
            });
        });
    });

    // Whenever elements are removed: check for plugins and destoy (unplug) them
    Event.after('UI:'+NODE_REMOVE, function(e) {
        var element = e.target;
        // to prevent less userexperience, we unplug after a delay
        laterSilent(function() {
            var attrs = element.vnode.attrs,
                ns, Plugin;
            attrs && attrs.each(function(value, key) {
                if (key.substr(0, 7)==='plugin-') {
                    ns = key.substr(7);
                    Plugin = window._ITSAPlugins[ns];
                    Plugin && element.unplug(Plugin);
                }
            });
        }, DELAY_DESTRUCTION);
    });

    Event.after(
        ['*:prototypechange', '*:prototyperemove'],
        function(e) {
            pluginDOMresync(e.target);
        },
        function(e) {
            return !!e.target.prototype.$ns;
        }
    );

   /**
    * Creates a new Element-PluginClass.
    *
    * @method definePlugin
    * @param ns {String} the namespace of the plugin
    * @param [constructor] {Function} The function that will serve as constructor for the new class.
    *        If `undefined` defaults to `NOOP`
    * @param [prototypes] {Object} Hash map of properties to be added to the prototype of the new class.
    * @return {PluginClass}
    * @since 0.0.1
    */
    DOCUMENT.definePlugin = function(ns, constructor, prototypes) {
        var NewClass;
        if ((typeof ns==='string') && (ns=ns.replaceAll(' ', '')) && (ns.length>0) && !ns.contains('-')) {
/*jshint boss:true */
            if (NewClass=window._ITSAPlugins[ns]) {
/*jshint boss:false */
                console.warn(NAME+'definePlugin cannot redefine Plugin '+ns+' --> already exists');
            }
            else {
                console.log(NAME+'definePlugin');
                NewClass = Base.subClass(ns, constructor, prototypes).mergePrototypes({$ns: ns}, true);
            }
        }
        else {
            console.warn(NAME+'definePlugin cannot create Plugin: invalid ns: '+ns);
        }
        return NewClass;
    };

    (function(FunctionPrototype) {
        var originalSubClass = FunctionPrototype.subClass;
        /**
         * Returns a newly created class inheriting from this class
         * using the given `constructor` with the
         * prototypes listed in `prototypes` merged in.
         *
         *
         * The newly created class has the `$$super` static property
         * available to access all of is ancestor's instance methods.
         *
         * Further methods can be added via the [mergePrototypes](#method_mergePrototypes).
         *
         * @example
         *
         *  var Circle = Shape.subClass(
         *      function (x, y, r) {
         *          // arguments will automaticly be passed through to Shape's constructor
         *          this.r = r;
         *      },
         *      {
         *          area: function () {
         *              return this.r * this.r * Math.PI;
         *          }
         *      }
         *  );
         *
         * @method subClass
         * @param ns {String} the namespace of the plugin
         * @param [constructor] {Function} The function that will serve as constructor for the new class.
         *        If `undefined` defaults to `NOOP`
         * @param [prototypes] {Object} Hash map of properties to be added to the prototype of the new class.
         * @param [chainConstruct=true] {Boolean} Whether -during instance creation- to automaticly construct in the complete hierarchy with the given constructor arguments.
         * @return {Plugin|undefined} undefined when no valid namespace is given
         */
        FunctionPrototype.subClass = function (ns, constructor, prototypes /*, chainConstruct */) {
            var instance = this,
                NewClass;
            if (instance.prototype.$ns) {
                if ((typeof ns==='string') && (ns=ns.replaceAll(' ', '')) && (ns.length>0) && !ns.contains('-')) {
/*jshint boss:true */
                    if (NewClass=window._ITSAPlugins[ns]) {
/*jshint boss:false */
                        console.warn(NAME+'definePlugin cannot redefine Plugin '+ns+' --> already exists');
                    }
                    else {
                        NewClass = originalSubClass.call(instance, constructor, prototypes).mergePrototypes({$ns: ns}, true);
                        window._ITSAPlugins[ns] = NewClass;
                        pluginDOM(NewClass);
                    }
                    return NewClass;
                }
                else {
                    console.warn(NAME+'subClass cannot create Plugin: invalid ns: '+ns);
                }
            }
            else {
                // Original subclassing
                return originalSubClass.apply(instance, arguments);
            }
        };
    }(Function.prototype));

    window._ITSAmodules.ElementPlugin = true;
};