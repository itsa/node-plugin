"use strict";

/**
 * Basic NodePlugin Class for plugin's on HTMLElements.
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @module node-plugin
 * @class NodePlugin
 * @since 0.0.1
*/

require('js-ext/lib/object.js');
require('js-ext/lib/string.js');
require('js-ext/lib/promise.js');
require('js-ext/extra/observers.js');
require('polyfill');

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
        Event = require('event-dom')(window),
        async = timers.async,
        later = timers.later,
        DELAY_DESTRUCTION = 5000, // must be kept below vnode.js its DESTROY_DELAY (which is currently 60000)
        DOCUMENT = window.document,
        NODE = 'node',
        REMOVE = 'remove',
        INSERT = 'insert',
        CHANGE = 'change',
        ATTRIBUTE = 'attribute',
        NODE_REMOVE = NODE+REMOVE,
        NODE_INSERT = NODE+INSERT,
        ATTRIBUTE_REMOVE = ATTRIBUTE+REMOVE,
        ATTRIBUTE_CHANGE = ATTRIBUTE+CHANGE,
        ATTRIBUTE_INSERT = ATTRIBUTE+INSERT,
        Base, pluginDOM, modelToAttrs, attrsToModel, syncPlugin, pluginDOMresync;

    Object.protectedProp(window, '_ITSAPlugins', createHashMap());

    /*
     * Inspects the DOM for Elements that have the plugin defined by their html and plugs the Plugin-Class.
     *
     * @method pluginDOM
     * @param NewClass {Class} the class to be inspected
     * @protected
     * @since 0.0.1
     */
    pluginDOM = function(NewClass) {
        // asynchroniously we check all current elements and render when needed:
        var ns = NewClass.prototype.$ns;
        async(function() {
            var elements = DOCUMENT.getAll('[plugin-'+ns+'="true"]', true),
                len = elements.length,
                element, i;
            for (i=0; i<len; i++) {
                element = elements[i];
                element.plug(ns);
            }
        });
    };

    /*
     * Inspects the DOM for Elements that have the plugin defined and and initialized. Then it will resyncs the plugin.
     *
     * @method pluginDOMresync
     * @param NewClass {Class} the class to be inspected
     * @protected
     * @since 0.0.1
     */
    pluginDOMresync = function(NewClass) {
        // asynchroniously we check all current elements and render when needed:
        var ns = NewClass.prototype.$ns;
        async(function() {
            var elements = DOCUMENT.getAll('[plugin-'+ns+'="true"]['+ns+'-ready="true"]', true),
                len = elements.length,
                element, i;
            for (i=0; i<len; i++) {
                element = elements[i];
                syncPlugin(element[ns]);
            }
        });
    };

    /*
     * Sets the config (first) and then the attribute-values into the plugin's model.
     *
     * @method attrsToModel
     * @param plugin {Object} the plugin-instance
     * @param config {Object} config
     * @protected
     * @since 0.0.1
     */
    attrsToModel = function(plugin, config) {
        var host = plugin.host,
            attrs = plugin.attrs,
            defaults = plugin.defaults,
            ns = plugin.$ns + '-',
            attrValue, validValue;
        config || (config={});
        // read the current ns-attributes on the node, overrule them with config and set the new attributes
        attrs.each(function(value, key) {
            attrValue = config.hasKey(key) ? config[key] : (host.getAttr(ns+key) || defaults[key]);
            attrValue = String(attrValue);
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

    /*
     * Sets the plugin.model properties into the attributes. Only those properties that are specified by `attrs` are set.
     *
     * @method modelToAttrs
     * @param plugin {Object} the plugin-instance
     * @protected
     * @since 0.0.1
     */
    modelToAttrs = function(plugin) {
        console.log(NAME+'modelToAttrs');
        var attrs = plugin.attrs.shallowClone(),
            model = plugin.model,
            domElement = plugin.host,
            ns = plugin.$ns,
            newAttrs = [];
        attrs.merge(plugin.defaults);
        attrs.each(function(value, key) {
            model[key] && (model[key]!=='undefined') && (newAttrs[newAttrs.length] = {name: ns+'-'+fromCamelCase(key), value: model[key]});
        });
        if (newAttrs.length>0) {
            domElement.setAttrs(newAttrs, true);
        }
    };

    /*
     * Syncs the plugin: both sets the attributes as well invoking `sync`.
     *
     * @method syncPlugin
     * @param plugin {Object} the plugin-instance
     * @param compareWithPrevData {Boolean} whether to sync "no matter what" or only when pervious modeldata was changed.
     * @protected
     * @since 0.0.1
     */
    syncPlugin = function() {
        var plugin = this; // is bound with the plugin
        modelToAttrs(plugin);
        plugin.sync();
    };

    // extend window.Element:
    window.Element && (function(HTMLElementPrototype) {
       /**
        * Checks whether the plugin is plugged in at the HtmlElement. Checks whether all its attributes are set.
        *
        * @for HTMLElement
        * @method isPlugged
        * @param plugin {String} The name of the plugin that should be plugged. Needs to be the Class, not an instance!
        * @return {Boolean} whether the plugin is plugged in
        * @since 0.0.1
        */
        HTMLElementPrototype.isPlugged = function(plugin) {
            // to prevent the need os waiting for initialisation, we will check the attribute
            return (this.getAttr('plugin-'+plugin)==='true');
        };

       /**
        * Checks whether the plugin is ready to be used.
        *
        * @method pluginReady
        * @param plugin {String} The name of the plugin that should be ready.
        * @return {Promise} whether the plugin is plugged in
        * @since 0.0.1
        */
        HTMLElementPrototype.pluginReady = function(plugin) {
            var instance = this;
            instance._pluginReadyInfo || (instance._pluginReadyInfo={});
            instance._pluginReadyInfo[plugin] || (instance._pluginReadyInfo[plugin]=window.Promise.manage());
            return instance._pluginReadyInfo[plugin];
        };

       /**
        * Plugs in the plugin on the HtmlElement, and gives is special behaviour by setting the appropriate attributes.
        *
        * @method plug
        * @param plugin {String} The name of the plugin that should be plugged.
        * @param [config] {Object} any config that should be passed through when the class is instantiated.
        * @param [model] {Object} model to used as `ns.model`
        * @return {Object|undefined} the plugin's instance, or undefined in case of an unregistered plugin
        * @since 0.0.1
        */
        HTMLElementPrototype.plug = function(plugin, config, model) {
            var instance = this,
                Plugin;
            if (typeof plugin==='string') {
                if (window._ITSAPlugins[plugin]) {
                    if (!instance._plugin || !instance._plugin[plugin]) {
                        instance._plugin || Object.protectedProp(instance, '_plugin', {});
                        Plugin = window._ITSAPlugins[plugin];
                        instance._plugin[plugin] = new Plugin(instance, config, model);
                    }
                    else {
                        console.info('ElementPlugin '+plugin+' already plugged in');
                        model && instance._plugin[plugin].bindModel(model);
                    }
                    return instance._plugin[plugin];
                }
                else {
                    console.warn('Plugin '+plugin+' is not registered');
                }
            }
        };

       /**
        * Gets the plugin-instance of the specified plugin-name. Will fulfill as soon as the plugin is ready.
        *
        * @method getPlugin
        * @param plugin {String} The name of the plugin that should be plugged.
        * @return {Promise} the plugin-instance of the specified plugin-name
        * @since 0.0.1
        */
        HTMLElementPrototype.getPlugin = function(plugin) {
            var instance = this;
            return instance.pluginReady(plugin).then(
                function() {
                    return instance._plugin[plugin];
                }
            );
        };

       /**
        * Unplugs a NodePlugin from the HtmlElement.
        *
        * @method unplug
        * @param PluginClass {NodePlugin} The plugin that should be unplugged. Needs to be the Class, not an instance!
        * @chainable
        * @since 0.0.1
        */
        HTMLElementPrototype.unplug = function(plugin) {
            var instance = this;
            if (instance._plugin && instance._plugin[plugin]) {
                instance._plugin[plugin].destroy();
            }
            return instance;
        };
    }(window.HTMLElement.prototype));

    Base = Classes.createClass(
        function (hostElement, config, model) {
            var instance = this;
            instance.host = hostElement;
            instance.model = {};
            attrsToModel(instance, config);
            instance.model.merge(instance.defaults);
            hostElement.setAttr('plugin-'+instance.$ns, 'true', true);
            if (model) {
                instance.bindModel(model, true);
            }
            else if (hostElement.getAttr(instance.$ns+'-ready')==='true') {
                instance._observer = syncPlugin.bind(instance);
                instance.model.observe(instance._observer);
            }
            modelToAttrs(instance);
        },
        {
            /*
             * Definition of all attributes: these attributes will be read during initalization and updated during `sync`
             * In the dom, the attributenames are prepended with `pluginName-`. The property-values should be the property-types
             * that belong to the property, this way the attributes get right casted into model.
             *
             * @property attrs
             * @default {}
             * @type Object
             * @since 0.0.1
            */
            attrs: {},
            /*
             * Any default values for attributes specified by `attrs`.
             *
             * @property defaults
             * @default {}
             * @type Object
             * @since 0.0.1
            */
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
                    host = instance.host;
                if (Object.isObject(model) && (instance.model!==model)) {
                    host.removeAttr('bound-model');
                    instance.model.unobserve(instance._observer);
                    instance._observer = null;
                    mergeCurrent && (model.merge(instance.model, {full: true}));
                    instance.model = model;
                    if (host.getAttr(instance.$ns+'-ready')==='true') {
                        instance._observer = syncPlugin.bind(instance);
                        instance.model.observe(instance._observer);
                        syncPlugin.call(instance);
                    }
                }
            },
            /*
             * Gets invoked after the complete initialization of all constructors in the chain.
             * This method assures it will happen as last stage of the initialisation.
             * This method also will invoke `render` (unless render was already done on the server)
             *
             * @method afterInit
             * @since 0.0.1
             */
            afterInit: function() {
                var instance = this,
                    ns = instance.$ns,
                    host = instance.host;

                if (!instance._observer) {
                    instance._observer = syncPlugin.bind(instance);
                    instance.model.observe(instance._observer);
                }
                (host.getAttr(ns+'-ready')==='true') || instance.render();
                syncPlugin.call(instance);
                host.setAttr(ns+'-ready', 'true', true);
                host._pluginReadyInfo || (host._pluginReadyInfo={});
                host._pluginReadyInfo[ns] || (host._pluginReadyInfo[ns]=window.Promise.manage());
                host._pluginReadyInfo[ns].fulfill();
            },
            /*
             * Renders the plugin. This method is invoked only once: at the end of initialization.
             * It should be used to render any nodes inside the host. Not all plugins need this.
             * Defaults to NOOP.
             *
             * @method render
             * @since 0.0.1
             */
            render: function() {
                // defaults to NOOP
            },
            /*
             * Syncs plugin.model's data with the host. Not its attributes: they will be synced automaticly.
             * Is invoked after every change of plugin.model's data.
             *
             * @method sync
             * @since 0.0.1
             */
            sync: function() {
                // defaults to NOOP
            },
           /**
            * Defines the `key`-property on element.model, but only when is hasn't been defined before.
            *
            * @method defineWhenUndefined
            * @param key {String} plugin.model's property
            * @param value {any} its value to be set
            * @chainable
            * @since 0.0.1
            */
            defineWhenUndefined: function(key, value) {
                var instance = this,
                    model = this.model;
                if (value!==undefined) {
                    model.hasKey(key) || (model[key]=value);
                }
                return instance;
            },
            /*
             * Cleansup the plugin. Is invoked whenever a plugin gets unplugged or its host gets removed from the dom.
             *
             * @method destroy
             * @since 0.0.1
             */
            destroy: function () {
                var instance = this,
                    host = instance.host,
                    attrs = instance.attrs,
                    ns = instance.$ns;

                instance.model.unobserve(instance.model, instance._observer);
                instance._observer = null;
                attrs.each(
                    function(value, key) {
                        host.removeAttr(ns+'-'+fromCamelCase(key), true);
                    }
                );
                host.removeAttr('plugin-'+ns, true);
                host.removeAttr(ns+'-ready', true);
                delete host._plugin[ns];
            },
            $ns: 'undefined-namespace'
        }
    );

    // Whenever elements are added: check for plugins and initialize them
    Event.after(['UI:'+ATTRIBUTE_CHANGE, 'UI:'+ATTRIBUTE_INSERT], function(e) {
        var element = e.target,
            ns, Plugin;
        // to prevent less userexperience, we plug asynchroniously
        async(function() {
            e.changed.forEach(function(item) {
                if (item.attribute.substr(0, 7)==='plugin-') {
                    ns = item.attribute.substr(7);
                    Plugin = window._ITSAPlugins[ns];
                    if (Plugin) {
                        if (item.newValue==='true') {
                            element.plug(ns);
                            console.log(NAME, 'plug: '+ns+' due to attribute change');
                        }
                        else {
                            element.unplug(ns);
                            console.log(NAME, 'unplug: '+ns+' due to attribute change');
                        }
                    }
                }
            });
        });
    });

    // Whenever elements are added: check for plugins and initialize them
    Event.after('UI:'+ATTRIBUTE_REMOVE, function(e) {
        var element = e.target,
            ns, Plugin;
        // to prevent less userexperience, we plug asynchroniously
        async(function() {
            e.changed.forEach(function(attribute) {
                if (attribute.substr(0, 7)==='plugin-') {
                    ns = attribute.substr(7);
                    Plugin = window._ITSAPlugins[ns];
                    if (Plugin) {
                        element.unplug(ns);
                        console.log(NAME, 'unplug: '+ns+' due to attribute removal');
                    }
                }
            });
        });
    });

    // Whenever elements are added: check for plugins and initialize them
    Event.after('UI:'+NODE_INSERT, function(e) {
        var element = e.target;
        // to prevent less userexperience, we plug asynchroniously
        async(function() {
            var attrs = element.vnode.attrs,
                ns, Plugin;
            attrs && attrs.each(function(value, key) {
                if (key.substr(0, 7)==='plugin-') {
                    ns = key.substr(7);
                    Plugin = window._ITSAPlugins[ns];
                    if (Plugin) {
                        element.plug(ns);
                        console.log(NAME, 'plug: '+ns+' due to node insert with the plugin-attribute');
                    }
                }
            });
        });
    });

    // Whenever elements are removed: check for plugins and destoy (unplug) them
    Event.after('UI:'+NODE_REMOVE, function(e) {
        var element = e.target;
        // to prevent less userexperience, we unplug after a delay
        later(function() {
            var Plugin;
            if (element.plugin) {
                element.plugin.each(function(value, ns) {
                    Plugin = window._ITSAPlugins[ns];
                    if (Plugin) {
                        element.unplug(ns);
                        console.log(NAME, 'unplug: '+ns+' due to node removal with this plugin');
                    }
                });
            }
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
    * @param plugin {String} the namespace of the plugin
    * @param [constructor] {Function} The function that will serve as constructor for the new class.
    *        If `undefined` defaults to `NOOP`
    * @param [prototypes] {Object} Hash map of properties to be added to the prototype of the new class.
    * @return {PluginClass}
    * @since 0.0.1
    */
    DOCUMENT.definePlugin = function(plugin, constructor, prototypes) {
        var NewClass;
        if ((typeof plugin==='string') && (plugin=plugin.replaceAll(' ', '')) && (plugin.length>0) && !plugin.contains('-')) {
/*jshint boss:true */
            if (NewClass=window._ITSAPlugins[plugin]) {
/*jshint boss:false */
                console.warn(NAME+'definePlugin cannot redefine Plugin '+plugin+' --> already exists');
            }
            else {
                console.log(NAME+'definePlugin');
                NewClass = Base.subClass(plugin, constructor, prototypes).mergePrototypes({$ns: plugin}, true);
            }
        }
        else {
            console.warn(NAME+'definePlugin cannot create Plugin: invalid plugin: '+plugin);
        }
        return NewClass;
    };

   /**
    * Returns the PluginClass that belongs with the specified `plugin`-name.
    *
    * @method getPluginClass
    * @param plugin {String} the namespace of the plugin
    * @return {PluginClass|indefined}
    * @since 0.0.1
    */
    DOCUMENT.getPluginClass = function(plugin) {
        return window._ITSAPlugins[plugin];
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
         * @param plugin {String} the namespace of the plugin
         * @param [constructor] {Function} The function that will serve as constructor for the new class.
         *        If `undefined` defaults to `NOOP`
         * @param [prototypes] {Object} Hash map of properties to be added to the prototype of the new class.
         * @param [chainConstruct=true] {Boolean} Whether -during instance creation- to automaticly construct in the complete hierarchy with the given constructor arguments.
         * @return {Plugin|undefined} undefined when no valid namespace is given
         */
        FunctionPrototype.subClass = function (plugin, constructor, prototypes /*, chainConstruct */) {
            var instance = this,
                NewClass;
            if (instance.prototype.$ns) {
                if ((typeof plugin==='string') && (plugin=plugin.replaceAll(' ', '')) && (plugin.length>0) && !plugin.contains('-')) {
/*jshint boss:true */
                    if (NewClass=window._ITSAPlugins[plugin]) {
/*jshint boss:false */
                        console.warn(NAME+'definePlugin cannot redefine Plugin '+plugin+' --> already exists');
                    }
                    else {
                        // change the constructor, so that it will end by calling `_finishInit`
                        NewClass = originalSubClass.call(instance, constructor, prototypes).mergePrototypes({$ns: plugin}, true);
                        window._ITSAPlugins[plugin] = NewClass;
                        pluginDOM(NewClass);
                    }
                    return NewClass;
                }
                else {
                    console.warn(NAME+'subClass cannot create Plugin: invalid plugin: '+plugin);
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