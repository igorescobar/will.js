(function (window, undefined) {
    "use strict";
    var will = {}, basicApi = {};
    window.will = will;
    function fill(root, keys, value) {
        var key, v;
        if (typeof keys === 'string') {
            keys = keys.split(/\./);
        }
        key = keys.shift();
        if (keys.length == 0) {
            root[key] = value;
        } else {
            v = root[key];
            if (typeof v !== "object" || v.constructor.name == "Array") {
                v = {};
                root[key] = v;
            }
            fill(v, keys, value);
        }
    }
    function extend(hash) {
        var key = "", k;
        if (typeof hash === "string") {
            key = hash + ".";
            hash = arguments[1];
        }
        for (k in hash) {
            fill(this, key + k, hash[k]);
        }
    }
    function defaultConfig() {
        return {
            "mode": will.modes.DEV,
            "domains": {
                "local": "/javascripts/will-functions/"
            },
            "addDomain": function (domainName, urlPrefix) {
                this.domains[domainName] = urlPrefix + (/\/$/.test(urlPrefix) ? "/" : "");
            },
            "packages": {},
            "defaultPackage": "defaultFunctions",
            "registerPackage": function (packageName, functions) {
                var funcs = functions.split(/,/), p, len, i;
                p = this.packages;
                for (i = 0, len = funcs.length; i < len; ) {
                    p[funcs[i++]] = packageName;
                }
            }
        };
    }
    function setup(context, reset, initConfig) {
        if (reset || ! ("cfg" in context)) {
            extend.call(context, "cfg", defaultConfig());
            context.registry = {};
            if (! ("call" in context)) extend.call(context, basicApi);
        }
        if (typeof initConfig === "function") initConfig(context.cfg);
    }
    function entryOf(registry, func) {
        return registry[func] || (registry[func] = {queue:[]});
    }
    function registerFunctions(registry, funcs, func) {
        if (typeof funcs !== "object") return;
        var entry,
            g = funcs.getImpl,
            f = funcs.impl || g && g();
        if (typeof f === "function") {
            entry = entryOf(registry, func);
            entry.impl = f;
        } else {
            for(func in funcs) {
                registerFunctions(registry, funcs[func], func);
            }
        }
    }
    function pathFor(context, funcPath) {
        var cfg = context.cfg,
            d = cfg.domains,
            domain = d.local,
            packageName = cfg.defaultPackage,
            func = funcPath;
        if ( /^(?:(\w+):)?(?:(\w+)\.)?(\w+)$/.test(funcPath) ){
            func = RegExp.$3;
            packageName = RegExp.$2 || cfg.packages[func] || packageName;
            domain = d[RegExp.$1 || "local"] || domain;
        }
        return {domain: domain, packageName: packageName, func: func};
    }
    function urlFor(context, path) {
        var cfg = context.cfg,
            pn = path.packageName, f = path.func;
        return path.domain
            + (cfg.mode == will.modes.PROD
                ? pn
                : pn == cfg.defaultPackage
                    ? f
                    : pn + "/" + f)
            + ".json";
    }
    function stubsTo(context, funcPath) {
        return function () {
            var registry = context.registry,
                path = pathFor(context, funcPath),
                entry = entryOf(registry, path.func);
            if (entry.impl) {
              return entry.impl.apply(context, arguments);
            } else {
                entry.queue.push(arguments);
                will.u.loadComponent(urlFor(context, path), function (data) {
                    if (typeof data === "string") {
                        try{data = eval("("+data+")");}catch(e){return;}
                    }
                    if (typeof data !== "object") return;
                    registerFunctions(registry, data, path.func);
                    while (entry.queue.length) {
                        entry.impl.apply(context, entry.queue.shift());
                    }
                });
            }
        };
    }

    // The Public API
    extend.call(basicApi, {
        "call": function (selector) {
            return stubsTo(this, selector);
        },
        "modes": {DEV:0, PROD:1},
        "u.extend": extend
    });
    extend.call(will, {
        "configure": function (initConfig) {
            setup(this, false, initConfig);
            return this;
        },
        "reconfigure": function (initConfig) {
            setup(this, true, initConfig);
            return this;
        }
    });
    extend.call(will, basicApi);
    setup(will, false);
})(window);

// will-jquery_adapter
(function ($) {
    "use strict";
    if (! $) return;
    will.u.extend({
        "loadComponent": function (url, successCallback) {
            $.ajax({
                dataType: "html",
                success: successCallback,
                url: url
            });
        }
    });
})(window.jQuery);