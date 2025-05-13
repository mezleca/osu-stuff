/*! ctxMenu v2.0.2 | (c) Nikolaj Kappler | https://github.com/nkappler/ctxmenu/blob/master/LICENSE !*/
// modified to work with osu-stuff
// theres no way this inst some minified bullshit

function getProp(prop) {
    return typeof prop === "function" ? prop() : prop;
}

function itemIsInteractive(item) {
    return itemIsAction(item) || itemIsAnchor(item) || itemIsSubMenu(item);
}

function itemIsAction(item) {
    return item.hasOwnProperty("action");
}

function itemIsAnchor(item) {
    return item.hasOwnProperty("href");
}

function itemIsDivider(item) {
    return item.hasOwnProperty("isDivider");
}

function itemIsSubMenu(item) {
    return item.hasOwnProperty("subMenu");
}

function itemIsCustom(item) {
    return item.hasOwnProperty("html") || item.hasOwnProperty("element");
}

function itemIsHeading(item) {
    return !itemIsInteractive(item) && !itemIsDivider(item) && !itemIsCustom(item);
}

function isDisabled(item) {
    return itemIsInteractive(item) && getProp(item.disabled) || itemIsSubMenu(item) && getProp(item.subMenu).length === 0;
}

function onHoverDebounced(target, action) {
    var timeout;

    target.addEventListener("mouseenter", (function(e) {
        timeout = setTimeout((function() {
            return action(e);
        }), 150);
    }));

    target.addEventListener("mouseleave", (function() {
        return clearTimeout(timeout);
    }));
}

function generateMenu(ctxMenu) {

    var menu = document.createElement("ul");
    menu.className = "ctxmenu";
    menu.append.apply(menu, ctxMenu.map(generateMenuItem));

    if (!ctxMenu.length) {
        menu.style.display = "none";
    }

    menu.addEventListener("contextmenu", (function(e) {
        e.stopPropagation();
        e.preventDefault();
    }));

    menu.addEventListener("click", (function(e) {
        return void e.stopPropagation();
    }));

    return menu;
}

function generateMenuItem(item) {
    var li = document.createElement("li");
    
    populateClassList([
        [itemIsDivider, "divider", false],
        [function(item) {
            return item.icon;
        }, "icon", true],
        [itemIsHeading, "heading", false],
        [itemIsSubMenu, "submenu", true],
        [isDisabled, "disabled", false],
        [itemIsInteractive, "interactive", true]
    ], item, li);

    if (itemIsDivider(item)) {
        return li;
    }

    [makeInnerHTML, makeAttributes, makeIcon, addEventHandlers, makeAnchor].forEach((function(step) {
        return step.call(null, item, li);
    }));

    return li;
}

function populateClassList(rules, item, li) {

    for (let i = 0; i < rules.length; i++) {
        const [matcher, className, supportsSubSequent] = rules[i];

        if (matcher(item)) {
            li.classList.add(className);  
            if (!supportsSubSequent) {
                break;
            }
        }
    }
}

function makeInnerHTML(_a, li) {
    var _b;
    var html = _a.html,
        text = _a.text,
        element = _a.element;
    var elem = getProp(element);
    elem ? li.append(elem) : li.innerHTML = (_b = getProp(html)) !== null && _b !== void 0 ? _b : "<span>".concat(getProp(text), "</span>");
}

function makeAttributes(_a, li) {
    var tooltip = _a.tooltip,
        style = _a.style,
        attributes = _a.attributes;
    li.title = getProp(tooltip) || "";
    style && li.setAttribute("style", getProp(style));
    attributes && Object.entries(getProp(attributes)).forEach((function(_a) {
        var attr = _a[0],
            val = _a[1];
        li.setAttribute(attr, val);
    }));
}

function makeIcon(_a, li) {
    var icon = _a.icon;
    icon && (li.innerHTML += '<img class="icon" src="'.concat(getProp(icon), '" />'));
}

function addEventHandlers(item, li) {
    for (var _i = 0, _a = Object.entries(getProp(item.events) || {}); _i < _a.length; _i++) {
        var _b = _a[_i],
            event_1 = _b[0],
            handler = _b[1];
        var _c = typeof handler === "function" ? {
                listener: handler,
                options: {}
            } : handler,
            listener = _c.listener,
            options = _c.options;
        li.addEventListener(event_1, listener, options);
    }

    if (isDisabled(item) || itemIsSubMenu(item)) {
        return;
    }

    itemIsAction(item) && li.addEventListener("click", item.action);
    itemIsInteractive(item) && li.addEventListener("click", (function() {
        return ctxmenu.hide();
    }));
}

function makeAnchor(item, li) {
    if (!itemIsAnchor(item) || isDisabled(item)) return;
    var href = item.href,
        download = item.download,
        target = item.target;
    var a = document.createElement("a");
    a.innerHTML = li.innerHTML;
    a.href = getProp(href);
    download !== void 0 && (a.download = getProp(download));
    target && (a.target = getProp(target));
    li.replaceChildren(a);
}

var hdir = "r";
var vdir = "d";

function resetDirections() {
    hdir = "r";
    vdir = "d";
}

function setPosition(container, parentOrEvent, fixedPos) {

    var scale = getScale();
    var _a = window.visualViewport,
        width = _a.width,
        height = _a.height;

    Object.assign(container.style, {
        maxHeight: height / scale.y + "px",
        maxWidth: width / scale.x + "px"
    });

    // NEW: yep
    if (fixedPos) {

        var rect = getUnmountedBoundingRect(container);

        Object.assign(container.style, {
            left: fixedPos.left,
            top: fixedPos.top,
            width: rect.width + "px",
            height: rect.height + "px"
        });

        return;
    }

    var rect = getUnmountedBoundingRect(container);

    rect.width = Math.trunc(rect.width) + 1;
    rect.height = Math.trunc(rect.height) + 1;

    var pos = {
        x: 0,
        y: 0
    };

    if (parentOrEvent instanceof Element) {
        var _b = getBoundingRect(parentOrEvent),
            x = _b.x,
            width_1 = _b.width,
            y = _b.y;
        pos = {
            x: hdir === "r" ? x + width_1 : x - rect.width,
            y: y
        };
        if (parentOrEvent.className.includes("submenu")) pos.y += vdir === "d" ? 4 : -12;
        var safePos = getPosition(rect, pos);
        if (pos.x !== safePos.x) {
            hdir = hdir === "r" ? "l" : "r";
            pos.x = hdir === "r" ? x + width_1 : x - rect.width;
        }
        if (pos.y !== safePos.y) {
            vdir = vdir === "u" ? "d" : "u";
            pos.y = safePos.y;
        }
        pos = getPosition(rect, pos);
    } else {
        var hasTransform = document.body.style.transform !== "";
        var body = hasTransform ? document.body.getBoundingClientRect() : {
            x: 0,
            y: 0
        };
        pos = getPosition(rect, {
            x: (parentOrEvent.clientX - body.x) / scale.x,
            y: (parentOrEvent.clientY - body.y) / scale.y
        });
    }

    Object.assign(container.style, {
        left: pos.x + "px",
        top: pos.y + "px",
        width: rect.width + "px",
        height: rect.height + "px"
    });
}

function getPosition(rect, pos) {
    var _a = window.visualViewport,
        width = _a.width,
        height = _a.height;
    var hasTransform = document.body.style.transform !== "";
    var _b = hasTransform ? document.body.getBoundingClientRect() : {
            left: 0,
            top: 0
        },
        left = _b.left,
        top = _b.top;
    var scale = getScale();
    var minX = -left / scale.x;
    var minY = -top / scale.y;
    var maxX = (width - left) / scale.x;
    var maxY = (height - top) / scale.y;
    return {
        x: hdir === "r" ? pos.x + rect.width > maxX ? maxX - rect.width : pos.x : pos.x < minX ? minX : pos.x,
        y: vdir === "d" ? pos.y + rect.height > maxY ? maxY - rect.height : pos.y : pos.y < minY ? minY : pos.y + rect.height > maxY ? maxY - rect.height : pos.y
    };
}

function getUnmountedBoundingRect(elem) {
    var container = elem.cloneNode(true);
    container.style.visibility = "hidden";
    document.body.appendChild(container);
    var result = getBoundingRect(container);
    document.body.removeChild(container);
    return result;
}

function getBoundingRect(elem) {
    var x = elem.offsetLeft,
        y = elem.offsetTop,
        height = elem.offsetHeight,
        width = elem.offsetWidth;
    if (elem.offsetParent instanceof HTMLElement) {
        var parent_1 = getBoundingRect(elem.offsetParent);
        return {
            x: x + parent_1.x,
            y: y + parent_1.y,
            width: width,
            height: height
        };
    }
    return {
        x: x,
        y: y,
        width: width,
        height: height
    };
}

function getScale() {
    var body = document.body;
    var rect = body.getBoundingClientRect();
    return {
        x: rect.width / body.offsetWidth,
        y: rect.height / body.offsetHeight
    };
}

var ContextMenu = function() {

    function ContextMenu() {

        var _this = this;
        this.cache = {};
        this.preventCloseOnScroll = false;

        window.addEventListener("click", (function() {
            return void _this.hide();
        }));

        window.addEventListener("resize", (function() {
            return void _this.hide();
        }));

        var timeout = 0;
        window.addEventListener("wheel", (function() {
            clearTimeout(timeout);
            timeout = setTimeout((function() {
                if (_this.preventCloseOnScroll) {
                    _this.preventCloseOnScroll = false;
                    return;
                }
                _this.hide();
            }));
        }), {
            passive: true
        });
        window.addEventListener("keydown", (function(e) {
            if (e.key === "Escape") _this.hide();
        }));
    }

    ContextMenu.getInstance = function() {
        if (!ContextMenu.instance) ContextMenu.instance = new ContextMenu;
        var instance = ContextMenu.instance;
        return {
            attach: instance.attach.bind(instance),
            delete: instance.delete.bind(instance),
            hide: instance.hide.bind(instance),
            show: instance.show.bind(instance),
            update: instance.update.bind(instance)
        };
    };

    ContextMenu.prototype.attach = function(target, ctxMenu, config) {
        var _this = this;
        if (config === void 0) config = {};
        // NEW: target can also be a element (to add listener to non-created elements)
        var t = typeof target == "string" ? document.querySelector(target) : target;
        if (this.cache[typeof target == "string" ? target : target.id] !== void 0) {
            //console.error("target element ".concat(target, " already has a context menu assigned. Use ContextMenu.update() intstead."));
            this.update(target, ctxMenu, config);
            return;
        }
        if (!t) {
            //console.error("target element ".concat(target, " not found"));
            return;
        }
        var handler = function(e) {
            _this.show(ctxMenu, e, config);
        };
        this.cache[typeof target == "string" ? target : target.id] = {
            ctxMenu: ctxMenu,
            handler: handler,
            config: config
        };
        // NEW: yeah
        t.addEventListener(config?.onClick ? "click" : "contextmenu", handler);
    };

    ContextMenu.prototype.update = function(target, ctxMenu, _config) {
        if (_config === void 0) _config = {};
        var o = this.cache[typeof target == "string" ? target : target.id];
        var config = Object.assign({}, o === null || o === void 0 ? void 0 : o.config, _config);
        // NEW: target can also be a element (to add listener to non-created elements)
        var t = typeof target == "string" ? document.querySelector(target) : target;
        o && (t === null || t === void 0 ? void 0 : t.removeEventListener("contextmenu", o.handler));
        delete this.cache[typeof target == "string" ? target : target.id];
        this.attach(target, ctxMenu || (o === null || o === void 0 ? void 0 : o.ctxMenu) || [], config);
    };

    ContextMenu.prototype.delete = function(target) {
        var o = this.cache[typeof target == "string" ? target : target.id];
        if (!o) {
            // return console.error("no context menu for target element ".concat(target, " found"));
            return;      
        }
        delete this.cache[typeof target == "string" ? target : target.id];
        var t = document.querySelector(target);
        if (!t) return console.error("target element ".concat(target, " does not exist (anymore)"));
        t.removeEventListener("contextmenu", o.handler);
    };

    ContextMenu.prototype.show = function(ctxMenu, eventOrElement, config) {
        var _this = this;
        var _a, _b, _c;
        if (config === void 0) config = {};
        if (eventOrElement instanceof MouseEvent) {
            eventOrElement.stopImmediatePropagation();
            eventOrElement.preventDefault();
        }
        this.hide();
        this.onHide = config.onHide;
        this.onBeforeHide = config.onBeforeHide;
        var newMenu = (_b = (_a = config.onBeforeShow) === null || _a === void 0 ? void 0 : _a.call(config, ctxMenu.slice(), eventOrElement instanceof MouseEvent ? eventOrElement : void 0)) !== null && _b !== void 0 ? _b : ctxMenu;
        this.menu = this.generateDOM(newMenu, eventOrElement, config.attributes, config.Fixed);
        document.body.appendChild(this.menu);
        (_c = config.onShow) === null || _c === void 0 ? void 0 : _c.call(config, this.menu);
        this.menu.addEventListener("wheel", (function() {
            _this.preventCloseOnScroll = true;
        }), {
            passive: true
        });
    };

    ContextMenu.prototype.hide = function() {
        this._hide(this.menu);
    };

    ContextMenu.prototype._hide = function(menuOrSubMenu) {
        var _a, _b;
        (_a = this.onBeforeHide) === null || _a === void 0 ? void 0 : _a.call(this, menuOrSubMenu);
        resetDirections();
        if (!menuOrSubMenu) return;
        menuOrSubMenu.remove();
        (_b = this.onHide) === null || _b === void 0 ? void 0 : _b.call(this, menuOrSubMenu);
        if (menuOrSubMenu === this.menu) {
            delete this.menu;
            this.onBeforeHide = void 0;
            this.onHide = void 0;
        }
    };

    ContextMenu.prototype.generateDOM = function(ctxMenu, parentOrEvent, attributes, fixedPos) {
        var _this = this;
        if (attributes === void 0) attributes = {};
        var container = generateMenu(ctxMenu);
        setPosition(container, parentOrEvent, fixedPos);
        ctxMenu.forEach((function(item, i) {
            var li = container.children[i];
            onHoverDebounced(li, (function() {
                var _a;
                var subMenu = (_a = li.parentElement) === null || _a === void 0 ? void 0 : _a.querySelector("ul");
                if (subMenu && subMenu.parentElement !== li) _this._hide(subMenu);
            }));
            if (isDisabled(item)) return;
            if (!itemIsSubMenu(item)) return;
            onHoverDebounced(li, (function() {
                if (li.querySelector("ul")) return;
                li.appendChild(_this.generateDOM(getProp(item.subMenu), li, getProp(item.subMenuAttributes)));
            }));
        }));
        Object.entries(attributes).forEach((function(_a) {
            var attr = _a[0],
                val = _a[1];
            return container.setAttribute(attr, val);
        }));
        return container;
    };

    return ContextMenu;
}();

export const ctxmenu = ContextMenu.getInstance();