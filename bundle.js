;(function(e,t,n,r){function i(r){if(!n[r]){if(!t[r]){if(e)return e(r);throw new Error("Cannot find module '"+r+"'")}var s=n[r]={exports:{}};t[r][0](function(e){var n=t[r][1][e];return i(n?n:e)},s,s.exports)}return n[r].exports}for(var s=0;s<r.length;s++)i(r[s]);return i})(typeof require!=="undefined"&&require,{1:[function(require,module,exports){
// Imports
// -----------------------------------------------------------------------------

var fold = require('reducers/fold');
var filter = require('reducers/filter');
var map = require('reducers/map');
var expand = require('reducers/expand');
var print = require('reducers/debug/print');

var open = require('dom-reduce/event');

var geneology = require('./geneology-reduce.js');

// DOM
// -----------------------------------------------------------------------------

var isTouch = 'ontouchstart' in window;
var touchstart = isTouch ? 'touchstart' : 'mousedown';
var touchmove = isTouch ? 'touchmove' : 'mousemove';
var touchend = isTouch ? 'touchend' : 'mouseup';

function hasClass(el, classname) {
  return el.classList && el.classList.contains(classname);
}

function toggleClass(el, classname) {
  el.classList.toggle(classname);
  return el;
}

function liftEventTarget(lambda) {
  return function liftedForEventTarget(event) {
    return lambda(event.target);
  }
}

// Parallax
// -----------------------------------------------------------------------------

function syncParallax(distance, totalWidth, backgroundWidth, viewportWidth) {
  // Find the distance for b such that a and b, starting at 0 arrive
  // at their end at the same time for the same distance.

  // The viewport travels less of a distance than the total width.
  // Think of it this way: put a pencil at the middle point of
  // the viewport. Starting with the viewport at the [0, 0] mark, drag it
  // until the viewer edge meets the scroll edge.
  // The line created by the pencil will be shorter than the total width by
  // (viewportWidth / 2) on each side, or
  // `((viewportWidth / 2) * 2) = viewportWidth`.
  var maxXOffset = (totalWidth - viewportWidth);

  // We don't ever want to offset the background by more than this. If we do,
  // we will end up not covering the viewport on the right-hand side.
  var maxBackgroundOffset = backgroundWidth - viewportWidth;

  // Now that we have values for both the background offset and max viewport
  // offset, we can derive a ratio.
  var backgroundToOffsetRatio = maxBackgroundOffset/maxXOffset;

  // Calculate the corresponding distance for b given a.
  return clamp(distance * backgroundToOffsetRatio, 0, distance);
}

function lambda(method) {
  // Convert a method func that uses a `this` context into a function that takes
  // the context object as the first parameter.
  return function (context) {
    var args = Array.prototype.slice.call(arguments, 1);
    return method.apply(context, args);
  };
}

// A lambda approach to `Array.prototype.slice`.
// Used in a lot of places for slicing the arguments object into a proper array.
var slice = Array.slice || lambda(Array.prototype.slice);
var reduce = Array.reduce || lambda(Array.prototype.reduce);

function extend(obj/* obj1, obj2, objN */) {
  // Copy all keys and values of obj1..objN to obj.
  // Mutates obj. Tip: use `Object.create` to copy values to a new object.
  return reduce(slice(arguments, 1), function (obj, objN) {
    return reduce(Object.keys(objN), function (obj, key) {
      obj[key] = objN[key];
      return obj;
    }, obj);
  }, obj);
}

function extendState(state, old, update) {
  // This filter is always run first by updateState.
  // Extends state with keys/values from update 
  return extend(state, update);
}

function updateState(old, update, filters) {
  // Create a new "state" object from `old` by running it through a series of
  // filter functions.
  // Start by extending a prototypal copy of `old` with `update`.
  return reduce([extendState].concat(filters), function (state, filter) {
    // Filter functions receive current state, old state and update object.
    return filter(state, old, update);
  }, Object.create(old));
}

function clamp(num, min, max) {
  // Normalize a number such that:
  //
  // * If it is less than min, min will be returned
  // * If it is greater than max, max will be returned.
  // * Otherwise, `num` will be returned.
  return (num < min) ? min : Math.min(num, max);
}

var STATE_FILTERS = [
  function clampIndex(state, old, update) {
    return extend(state, {
      index: clamp(state.index, 0, state.units - 1)
    });
  },
  function calculateOffset(state, old, update) {
    return extend(state, {
      offset: state.index * state.unitWidth
    });
  },
  function calculateTotalWidth(state, old, update) {
    return extend(state, {
      totalWidth: state.units * state.unitWidth
    });
  }
];

function render(state) {
  state.screensEl.style.transform = "translateX(-" + state.offset + "px)";

  var backgroundOffset = syncParallax(state.offset, state.totalWidth, state.backgroundWidth, state.unitWidth);
  state.backgroundEl.style.transform = "translateX(-" + backgroundOffset + "px";
  return state;
}

function enter(state) {
  // Run once, at beginning.
  reduce(state.screenEls, function (offset, el) {
    el.style.width = state.unitWidth + 'px';
    el.style.left = offset + 'px';
    return offset + state.unitWidth;
  }, 0);
  return state;
}

// Control flow logic
// -----------------------------------------------------------------------------

var stageEl = document.getElementById('demo-stage');
var homeScreensEl = document.getElementById('home-screens');
var bg1El = document.getElementById('home-background-1');
var nextEl = document.getElementById('demo-next');
var prevEl = document.getElementById('demo-prev');

var STATE = updateState({}, {
  index: 0,
  units: 9,
  unitWidth: 320,
  backgroundWidth: bg1El.clientWidth,
  screensEl: homeScreensEl,
  screenEls: homeScreensEl.children,
  backgroundEl: bg1El
}, STATE_FILTERS);

// Set up stage.
// Run `enter` and `render`.
STATE = render(enter(STATE));

var tapStartsOverTime = open(document.documentElement, touchstart);

var tappedElsOverTime = map(tapStartsOverTime, function getEventTarget(event) {
  return event.target;
});

// React to prev el taps over time.
//
// Filter out prevEl taps.
var prevElTapsOverTime = filter(tapStartsOverTime, liftEventTarget(function isPrevEl(el) {
  return el === prevEl;
}));

var nextElTapsOverTime = filter(tapStartsOverTime, liftEventTarget(function isNextEl(el) {
  return el === nextEl;
}));

var tappedAncestorsOverTime = expand(tappedElsOverTime, geneology);

var cardTapsOverTime = filter(tappedAncestorsOverTime, function isCard(el) {
  return hasClass(el, 'deck-card');
});

print(cardTapsOverTime);

fold(prevElTapsOverTime, function (event) {
  event.preventDefault();
  STATE = render(updateState(STATE, { index: STATE.index - 1 }, STATE_FILTERS));
});

fold(nextElTapsOverTime, function (event) {
  event.preventDefault();
  STATE = render(updateState(STATE, { index: STATE.index + 1 }, STATE_FILTERS));
});

fold(cardTapsOverTime, function (el) {
  toggleClass(el, 'deck-card-zoomed-out');
});

},{"./geneology-reduce.js":2,"reducers/fold":3,"reducers/filter":4,"reducers/map":5,"reducers/expand":6,"reducers/debug/print":7,"dom-reduce/event":8}],2:[function(require,module,exports){
"use strict";

var reducible = require("reducible/reducible");
var end = require('reducible/end'); 

function geneology(el, maxDepth) {
  maxDepth = (maxDepth == null ? Number.POSITIVE_INFINITY : maxDepth);
  var depth = 0;
  return reducible(function reduceAncestors(next, result) {
    result = next(el, result);
    while (((el = el.parentNode) != null) && (depth < maxDepth)) {
      result = next(el, result);
      depth++;
    }
    next(end, result);
  });
}
module.exports = geneology;

},{"reducible/reducible":9,"reducible/end":10}],4:[function(require,module,exports){
"use strict";

var reducer = require("./reducer")

var filter = reducer(function filter(predicate, next, value, result) {
  /**
  Composes filtered version of given `source`, such that only items contained
  will be once on which `f(item)` was `true`.

  ## Example

  var digits = filter([ 10, 23, 2, 7, 17 ], function(value) {
    return value >= 0 && value <= 9
  })
  print(digits) // => < 2 7 >
  **/
  return predicate(value) ? next(value, result) :
         result
})

module.exports = filter

},{"./reducer":11}],6:[function(require,module,exports){
"use strict";

var merge = require("./merge")
var map = require("./map")

function expand(source, f) {
  /**
  Takes `source` sequence maps each item via `f` to a new sequence
  and then flattens them down into single form sequence. Note that
  returned sequence will have items ordered by time and not by index,
  if you wish opposite you need to force sequential order by wrapping
  `source` into `sequential` before passing it.

  ## Example

  var sequence = expand([ 1, 2, 3 ], function(x) {
    return [ x, x * x ]
  })
  print(sequence)   // => < 1 1 2 4 3 9 >

  **/
  return merge(map(source, f))
}

module.exports = expand

},{"./merge":12,"./map":5}],5:[function(require,module,exports){
"use strict";

var reducer = require("./reducer")

var map = reducer(function map(f, next, value, result) {
  /**
  Returns transformed version of given `source` where each item of it
  is mapped using `f`.

  ## Example

  var data = [{ name: "foo" }, { name: "bar" }]
  var names = map(data, function(value) { return value.name })
  print(names) // => < "foo" "bar" >
  **/
  next(f(value), result)
})

module.exports = map

},{"./reducer":11}],13:[function(require,module,exports){
var events = require('events');

exports.isArray = isArray;
exports.isDate = function(obj){return Object.prototype.toString.call(obj) === '[object Date]'};
exports.isRegExp = function(obj){return Object.prototype.toString.call(obj) === '[object RegExp]'};


exports.print = function () {};
exports.puts = function () {};
exports.debug = function() {};

exports.inspect = function(obj, showHidden, depth, colors) {
  var seen = [];

  var stylize = function(str, styleType) {
    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    var styles =
        { 'bold' : [1, 22],
          'italic' : [3, 23],
          'underline' : [4, 24],
          'inverse' : [7, 27],
          'white' : [37, 39],
          'grey' : [90, 39],
          'black' : [30, 39],
          'blue' : [34, 39],
          'cyan' : [36, 39],
          'green' : [32, 39],
          'magenta' : [35, 39],
          'red' : [31, 39],
          'yellow' : [33, 39] };

    var style =
        { 'special': 'cyan',
          'number': 'blue',
          'boolean': 'yellow',
          'undefined': 'grey',
          'null': 'bold',
          'string': 'green',
          'date': 'magenta',
          // "name": intentionally not styling
          'regexp': 'red' }[styleType];

    if (style) {
      return '\033[' + styles[style][0] + 'm' + str +
             '\033[' + styles[style][1] + 'm';
    } else {
      return str;
    }
  };
  if (! colors) {
    stylize = function(str, styleType) { return str; };
  }

  function format(value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (value && typeof value.inspect === 'function' &&
        // Filter out the util module, it's inspect function is special
        value !== exports &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      return value.inspect(recurseTimes);
    }

    // Primitive types cannot have properties
    switch (typeof value) {
      case 'undefined':
        return stylize('undefined', 'undefined');

      case 'string':
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                 .replace(/'/g, "\\'")
                                                 .replace(/\\"/g, '"') + '\'';
        return stylize(simple, 'string');

      case 'number':
        return stylize('' + value, 'number');

      case 'boolean':
        return stylize('' + value, 'boolean');
    }
    // For some reason typeof null is "object", so special case here.
    if (value === null) {
      return stylize('null', 'null');
    }

    // Look up the keys of the object.
    var visible_keys = Object_keys(value);
    var keys = showHidden ? Object_getOwnPropertyNames(value) : visible_keys;

    // Functions without properties can be shortcutted.
    if (typeof value === 'function' && keys.length === 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        var name = value.name ? ': ' + value.name : '';
        return stylize('[Function' + name + ']', 'special');
      }
    }

    // Dates without properties can be shortcutted
    if (isDate(value) && keys.length === 0) {
      return stylize(value.toUTCString(), 'date');
    }

    var base, type, braces;
    // Determine the object type
    if (isArray(value)) {
      type = 'Array';
      braces = ['[', ']'];
    } else {
      type = 'Object';
      braces = ['{', '}'];
    }

    // Make functions say that they are functions
    if (typeof value === 'function') {
      var n = value.name ? ': ' + value.name : '';
      base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
    } else {
      base = '';
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + value.toUTCString();
    }

    if (keys.length === 0) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        return stylize('[Object]', 'special');
      }
    }

    seen.push(value);

    var output = keys.map(function(key) {
      var name, str;
      if (value.__lookupGetter__) {
        if (value.__lookupGetter__(key)) {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Getter/Setter]', 'special');
          } else {
            str = stylize('[Getter]', 'special');
          }
        } else {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Setter]', 'special');
          }
        }
      }
      if (visible_keys.indexOf(key) < 0) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (seen.indexOf(value[key]) < 0) {
          if (recurseTimes === null) {
            str = format(value[key]);
          } else {
            str = format(value[key], recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (isArray(value)) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = stylize('[Circular]', 'special');
        }
      }
      if (typeof name === 'undefined') {
        if (type === 'Array' && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
                     .replace(/\\"/g, '"')
                     .replace(/(^"|"$)/g, "'");
          name = stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    });

    seen.pop();

    var numLinesEst = 0;
    var length = output.reduce(function(prev, cur) {
      numLinesEst++;
      if (cur.indexOf('\n') >= 0) numLinesEst++;
      return prev + cur.length + 1;
    }, 0);

    if (length > 50) {
      output = braces[0] +
               (base === '' ? '' : base + '\n ') +
               ' ' +
               output.join(',\n  ') +
               ' ' +
               braces[1];

    } else {
      output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    return output;
  }
  return format(obj, (typeof depth === 'undefined' ? 2 : depth));
};


function isArray(ar) {
  return ar instanceof Array ||
         Array.isArray(ar) ||
         (ar && ar !== Object.prototype && isArray(ar.__proto__));
}


function isRegExp(re) {
  return re instanceof RegExp ||
    (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');
}


function isDate(d) {
  if (d instanceof Date) return true;
  if (typeof d !== 'object') return false;
  var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);
  var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);
  return JSON.stringify(proto) === JSON.stringify(properties);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

exports.log = function (msg) {};

exports.pump = null;

var Object_keys = Object.keys || function (obj) {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
};

var Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {
    var res = [];
    for (var key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) res.push(key);
    }
    return res;
};

var Object_create = Object.create || function (prototype, properties) {
    // from es5-shim
    var object;
    if (prototype === null) {
        object = { '__proto__' : null };
    }
    else {
        if (typeof prototype !== 'object') {
            throw new TypeError(
                'typeof prototype[' + (typeof prototype) + '] != \'object\''
            );
        }
        var Type = function () {};
        Type.prototype = prototype;
        object = new Type();
        object.__proto__ = prototype;
    }
    if (typeof properties !== 'undefined' && Object.defineProperties) {
        Object.defineProperties(object, properties);
    }
    return object;
};

exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object_create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (typeof f !== 'string') {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(exports.inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j': return JSON.stringify(args[i++]);
      default:
        return x;
    }
  });
  for(var x = args[i]; i < len; x = args[++i]){
    if (x === null || typeof x !== 'object') {
      str += ' ' + x;
    } else {
      str += ' ' + exports.inspect(x);
    }
  }
  return str;
};

},{"events":14}],10:[function(require,module,exports){
"use strict";

module.exports = String("End of the collection")

},{}],3:[function(require,module,exports){
"use strict";

var reduce = require("reducible/reduce")
var isError = require("reducible/is-error")
var isReduced = require("reducible/is-reduced")
var end = require("reducible/end")

var Eventual = require("eventual/type")
var deliver = require("eventual/deliver")
var defer = require("eventual/defer")
var when = require("eventual/when")


// All eventual values are reduced same as the values they realize to.
reduce.define(Eventual, function reduceEventual(eventual, next, initial) {
  return when(eventual, function delivered(value) {
    return reduce(value, next, initial)
  }, function failed(error) {
    next(error, initial)
    return error
  })
})


function fold(source, next, initial) {
  /**
  Fold is just like `reduce` with a difference that `next` reducer / folder
  function it takes has it's parameters reversed. One always needs `value`,
  but not always accumulated one. To avoid conflict with array `reduce` we
  have a `fold`.
  **/
  var promise = defer()
  reduce(source, function fold(value, state) {
    // If source is `end`-ed deliver accumulated `state`.
    if (value === end) return deliver(promise, state)
    // If is source has an error, deliver that.
    else if (isError(value)) return deliver(promise, value)

    // Accumulate new `state`
    try { state = next(value, state) }
    // If exception is thrown at accumulation deliver thrown error.
    catch (error) { return deliver(promise, error) }

    // If already reduced, then deliver.
    if (isReduced(state)) deliver(promise, state.value)

    return state
  }, initial)

  // Wrap in `when` in case `promise` is already delivered to return an
  // actual value.
  return when(promise)
}

module.exports = fold

},{"eventual/type":15,"eventual/deliver":16,"eventual/defer":17,"eventual/when":18,"reducible/reduce":19,"reducible/is-error":20,"reducible/is-reduced":21,"reducible/end":10}],8:[function(require,module,exports){
/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true browser: true devel: true
         forin: true latedef: false globalstrict: true */

"use strict";

var reducible = require("reducible/reducible")
var isReduced = require("reducible/is-reduced")

function open(target, type, options) {
  /**
  Capture events on a DOM element, converting them to a reducible channel.
  Returns a reducible channel.

  ## Example

      var allClicks = open(document.documentElement, "click")
      var clicksOnMyTarget = filter(allClicks, function (click) {
        return click.target === myTarget
      })
  **/
  var capture = options && options.capture || false
  return reducible(function reducDomEvents(next, result) {
    function handler(event) {
      result = next(event, result)
      //  When channel is marked as accumulated, remove event listener.
      if (isReduced(result)) {
        if (target.removeEventListener)
          target.removeEventListener(type, handler, capture)
        else
          target.detachEvent(type, handler, capture)
      }
    }
    if (target.addEventListener) target.addEventListener(type, handler, capture)
    else target.attachEvent("on" + type, handler)
  })
}

module.exports = open

},{"reducible/reducible":9,"reducible/is-reduced":21}],9:[function(require,module,exports){
(function(){"use strict";

var reduce = require("./reduce")
var end = require("./end")
var isError = require("./is-error")
var isReduced = require("./is-reduced")
var reduced = require("./reduced")

function Reducible(reduce) {
  /**
  Reducible is a type of the data-structure that represents something
  that can be reduced. Most of the time it's used to represent transformation
  over other reducible by capturing it in a lexical scope.

  Reducible has an attribute `reduce` pointing to a function that does
  reduction.
  **/

  // JS engines optimize access to properties that are set in the constructor's
  // so we set it here.
  this.reduce = reduce
}

// Implementation of `accumulate` for reducible, which just delegates to it's
// `reduce` attribute.
reduce.define(Reducible, function reduceReducible(reducible, next, initial) {
  var result
  // State is intentionally accumulated in the outer variable, that way no
  // matter if consumer is broken and passes in wrong accumulated state back
  // this reducible will still accumulate result as intended.
  var state = initial
  try {
    reducible.reduce(function forward(value) {
      try {
        // If reduction has already being completed return is set to
        // an accumulated state boxed via `reduced`. It's set to state
        // that is return to signal input that reduction is complete.
        if (result) state = result
        // if dispatched `value` is is special `end` of input one or an error
        // just forward to reducer and store last state boxed as `reduced` into
        // state. Later it will be assigned to result and returned to input
        // to indicate end of reduction.
        else if (value === end || isError(value)) {
          next(value, state)
          state = reduced(state)
        }
        // if non of above just accumulate new state by passing value and
        // previously accumulate state to reducer.
        else state = next(value, state)

        // If state is boxed with `reduced` then accumulation is complete.
        // Indicated explicitly by a reducer or by end / error of the input.
        // Either way store it to the result in case broken input attempts to
        // call forward again.
        if (isReduced(state)) result = state

        // return accumulated state back either way.
        return state
      }
      // If error is thrown then forward it to the reducer such that consumer
      // can apply recovery logic. Also store current `state` boxed with
      // `reduced` to signal input that reduction is complete.
      catch (error) {
        next(error, state)
        result = reduced(state)
        return result
      }
    })
  }
  // It could be that attempt to reduce underlaying reducible throws, if that
  // is the case still forward an `error` to a reducer and store reduced state
  // into result, in case process of reduction started before exception and
  // forward will still be called. Return result either way to signal
  // completion.
  catch(error) {
    next(error, state)
    result = reduced(state)
    return result
  }
})

function reducible(reduce) {
  return new Reducible(reduce)
}
reducible.type = Reducible

module.exports = reducible

})()
},{"./reduce":19,"./end":10,"./is-error":20,"./is-reduced":21,"./reduced":22}],16:[function(require,module,exports){
"use strict";

// Anyone crating an eventual will likely need to realize it, requiring
// dependency on other package is complicated, not to mention that one
// can easily wind up with several copies that does not necessary play
// well with each other. Exposing this solves the issues.
module.exports = require("pending/deliver")

},{"pending/deliver":23}],17:[function(require,module,exports){
"use strict";

var Eventual = require("./type")
var defer = function defer() { return new Eventual() }

module.exports = defer

},{"./type":15}],24:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],14:[function(require,module,exports){
(function(process){if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;
function indexOf (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0; i < xs.length; i++) {
        if (x === xs[i]) return i;
    }
    return -1;
}

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = indexOf(list, listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  if (arguments.length === 0) {
    this._events = {};
    return this;
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

})(require("__browserify_process"))
},{"__browserify_process":24}],20:[function(require,module,exports){
"use strict";

var stringifier = Object.prototype.toString

function isError(value) {
  return stringifier.call(value) === "[object Error]"
}

module.exports = isError

},{}],22:[function(require,module,exports){
"use strict";


// Exported function can be used for boxing values. This boxing indicates
// that consumer of sequence has finished consuming it, there for new values
// should not be no longer pushed.
function reduced(value) {
  /**
  Boxes given value and indicates to a source that it's already reduced and
  no new values should be supplied
  **/
  return { value: value, is: reduced }
}

module.exports = reduced

},{}],7:[function(require,module,exports){
(function(process){"use strict";

var reduce = require("reducible/reduce")
var reducible = require("reducible/reducible")
var end = require("reducible/end")
var isError = require("reducible/is-error")

var PREFIX = "\u200B"
var OPEN = PREFIX + "< "
var CLOSE = PREFIX + ">\n"
var ERROR = PREFIX + "\u26A1 "
var DELIMITER = PREFIX + " "

var SPECIALS = [ OPEN, CLOSE, ERROR, DELIMITER ]

var write = (function() {
  if (typeof(process) !== "undefined" &&
      typeof(process.stdout) !== "undefined" &&
      typeof(process.stdout.write) === "function") {
    var inspect = require("util").inspect
    var slicer = Array.prototype.slice
    return function write() {
      var message = slicer.call(arguments).map(function($) {
        return SPECIALS.indexOf($) >= 0 ? $ : inspect($)
      }).join("")
      process.stdout.write(message)
    }
  } else {
    return console.log.bind(console)
  }
})()

function print(source) {
  var open = false
  reduce(source, function reducePrintSource(value) {
    if (!open) write(OPEN)
    open = true

    if (value === end) write(CLOSE)
    else if (isError(value)) write(ERROR, value, DELIMITER, CLOSE)
    else write(value, DELIMITER)
  })
}

module.exports = print

})(require("__browserify_process"))
},{"util":13,"reducible/reduce":19,"reducible/reducible":9,"reducible/end":10,"reducible/is-error":20,"__browserify_process":24}],21:[function(require,module,exports){
"use strict";

var reduced = require("./reduced")

function isReduced(value) {
  return value && value.is === reduced
}

module.exports = isReduced

},{"./reduced":22}],15:[function(require,module,exports){
(function(){"use strict";

var watchers = require("watchables/watchers")
var watch = require("watchables/watch")
var await = require("pending/await")
var isPending = require("pending/is")
var deliver = require("./deliver")
var when = require("./when")

// Internal utility function returns true if given value is of error type,
// otherwise returns false.
var isError = (function() {
  var stringy = Object.prototype.toString
  var error = stringy.call(Error.prototype)
  return function isError(value) {
    return stringy.call(value) === error
  }
})()

// Internal utility, identity function. Returns whatever is given to it.
function identity(value) { return value }

// Internal utility, decorator function that wraps given function into
// try / catch and returns thrown exception in case when exception is
// thrown.
function attempt(f) {
  return function effort(value) {
    try { return f(value) }
    catch (error) { return error }
  }
}


// Define property names used by an `Eventual` type. Names are prefixed via
// `module.id` to avoid name conflicts.
var observers = "observers@" + module.id
var result = "value@" + module.id
var pending = "pending@" + module.id


function Eventual() {
  /**
  Data type representing eventual value, that can be observed and delivered.
  Type implements `watchable`, `pending` and `eventual` abstractions, where
  first two are defined in an external libraries.
  **/
  this[observers] = []
  this[result] = this
  this[pending] = true
}
// Expose property names via type static properties so that it's easier
// to refer to them while debugging.
Eventual.observers = observers
Eventual.result = result
Eventual.pending = pending

watchers.define(Eventual, function(value) {
  return value[observers]
})
// Eventual values considered to be pending until the are deliver by calling
// `deliver`. Internal `pending` property is used to identify weather value
// is being watched or not.
isPending.define(Eventual, function(value) {
  return value[pending]
})
// Eventual type implements await function of pending abstraction, to enable
// observation of value delivery.
await.define(Eventual, function(value, observer) {
  if (isPending(value)) watch(value, observer)
  else observer(value[result])
})

// Eventual implements `deliver` function of pending abstraction, to enable
// fulfillment of eventual values. Eventual value can be delivered only once,
// which will transition it from pending state to non-pending state. All
// further deliveries are ignored. It's also guaranteed that all the registered
// observers will be invoked in FIFO order.
deliver.define(Eventual, function(value, data) {
  // Ignore delivery if value is no longer pending, or if it's in a process of
  // delivery (in this case eventual[result] is set to value other than
  // eventual itself). Also ignore if data deliver is value itself.
  if (value !== data && isPending(value) && value[result] === value) {
    var count = 0
    var index = 0
    var delivering = true
    var observers = void(0)
    // Set eventual value result to passed data value that also marks value
    // as delivery in progress. This way all the `deliver` calls is side
    // effect to this will be ignored. Note: value should still remain pending
    // so that new observers could be registered instead of being called
    // immediately, otherwise it breaks FIFO order.
    value[result] = data
    while (delivering) {
      // If current batch of observers is exhausted, splice a new batch
      // and continue delivery. New batch is created only if new observers
      // are registered in side effect to this call of deliver.
      if (index === count) {
        observers = watchers(value).splice(0)
        count = observers.length
        index = 0
        // If new observers have not being registered mark value as no longer
        // pending and finish delivering.
        if (count === index) {
          value[pending] = false
          delivering = false
        }
      }
      // Register await handlers on given result, is it may be eventual /
      // pending itself. Delivering eventual will cause delivery of the
      // delivered eventual's delivery value, whenever that would be.
      else {
        await(data, observers[index])
        index = index + 1
      }
    }
  }
})

// Eventual implements `when` polymorphic function that is part of it's own
// abstraction. It takes `value` `onFulfill` & `onError` handlers. In return
// when returns eventual value, that is delivered return value of the handler
// that is invoked depending on the given values delivery. If deliver value
// is of error type error handler is invoked. If value is delivered with other
// non-pending value that is not of error type `onFulfill` handlers is invoked
// with it. If pending value is delivered then it's value will be delivered
// it's result whenever that would be. This will cause both value and error
// propagation.
when.define(Eventual, function(value, onRealize, onError) {
  // Create eventual value for a return value.
  var delivered = false
  var eventual = void(0)
  var result = void(0)
  // Wrap handlers into attempt decorator function, so that in case of
  // exception thrown error is returned causing error propagation. If handler
  // is missing identity function is used instead to propagate value / error.
  var realize = onRealize ? attempt(onRealize) : identity
  var error = onError ? attempt(onError) : identity
  // Wait for pending value to be delivered.
  await(value, function onDeliver(data) {
    // Once value is delivered invoke appropriate handler, and deliver it
    // to a resulting eventual value.
    result = isError(data) ? error(data)
                           : realize(data)

    // If outer function is already returned and has created eventual
    // for it's result deliver it. Otherwise (if await called observer
    // in same synchronously) mark result delivered.
    if (eventual) deliver(eventual, result)
    else delivered = true
  })

  // If result is delivered already return it, otherwise create eventual
  // value for the result and return that.
  return delivered ? result : (eventual = new Eventual())
})

module.exports = Eventual

})()
},{"pending/await":25,"pending/is":26,"./deliver":16,"./when":18,"watchables/watchers":27,"watchables/watch":28}],11:[function(require,module,exports){
(function(process){"use strict";

var reduce = require("reducible/reduce")
var reducible = require("reducible/reducible")
var isError = require("reducible/is-error")
var end = require("reducible/end")


function reducer(process) {
  /**
  Convenience function to simplify definitions of transformation function, to
  avoid manual definition of `reducible` results and currying transformation
  function. It creates typical transformation function with a following
  signature:

      transform(source, options)

  From a pure data `process` function that is called on each value for a
  collection with following arguments:

    1. `options` - Options passed to the resulting transformation function
       most commonly that's a function like in `map(source, f)`.
    2. `next` - Function which needs to be invoked with transformed value,
       or simply not called to skip the value.
    3. `value` - Last value emitted by a collection being reduced.
    4. `result` - Accumulate value.

  Function is supposed to return new, accumulated `result`. It may either
  pass mapped transformed `value` and `result` to the `next` continuation
  or skip it.

  For example see `map` and `filter` functions.
  **/
  return function reducer(source, options) {
    // When return transformation function is called with a source and
    // `options`
    return reducible(function reduceReducer(next, initial) {
      // When actual result is 
      reduce(source, function reduceReducerSource(value, result) {
        // If value is `end` of source or an error just propagate through,
        // otherwise call `process` with all the curried `options` and `next`
        // continuation function.
        return value === end ? next(value, result) :
               isError(value) ? next(value, result) :
               process(options, next, value, result)
      })
    })
  }
}

module.exports = reducer

})(require("__browserify_process"))
},{"reducible/reduce":19,"reducible/reducible":9,"reducible/is-error":20,"reducible/end":10,"__browserify_process":24}],12:[function(require,module,exports){
"use strict";

var reduce = require("reducible/reduce")
var reducible = require("reducible/reducible")
var end = require("reducible/end")
var isError = require("reducible/is-error")

function merge(source) {
  /**
  Merges given collection of collections to a collection with items of
  all nested collections. Note that items in the resulting collection
  are ordered by the time rather then index, in other words if item from
  the second nested collection is deliver earlier then the item
  from first nested collection it will in appear earlier in the resulting
  collection.

  print(merge([ [1, 2], [3, 4] ]))  // => < 1 2 3 4 >
  **/
  return reducible(function accumulateMerged(next, initial) {
    var state = initial
    var open = 1

    function forward(value) {
      if (value === end) {
        open = open - 1
        if (open === 0) return next(end)
      } else {
        state = next(value, state)
      }
      return state
    }


    reduce(source, function accumulateMergeSource(nested) {
      // If there is an error or end of `source` collection just pass it
      // to `forward` it will take care of detecting weather it's error
      // or `end`. In later case it will also figure out if it's `end` of
      // result to and act appropriately.
      if (nested === end) return forward(end)
      if (isError(nested)) return forward(nested)
      // If `nested` item is not end nor error just `accumulate` it via
      // `forward` that keeps track of all collections that are bing forwarded
      // to it.
      open = open + 1
      reduce(nested, forward, null)
    }, initial)
  })
}

module.exports = merge

},{"reducible/reduce":19,"reducible/reducible":9,"reducible/end":10,"reducible/is-error":20}],19:[function(require,module,exports){
"use strict";

var method = require("method")

var isReduced = require("./is-reduced")
var isError = require("./is-error")
var end = require("./end")

var reduce = method("reduce@reducible")

// Implementation of `reduce` for the empty collections, that immediately
// signals reducer that it's ended.
reduce.empty = function reduceEmpty(empty, next, initial) {
  next(end, initial)
}

// Implementation of `reduce` for the singular values which are treated
// as collections with a single element. Yields a value and signals the end.
reduce.singular = function reduceSingular(value, next, initial) {
  next(end, next(value, initial))
}

// Implementation of `reduce` for the array (and alike) values, such that it
// will call accumulator function `next` each time with next item and
// accumulated state until it's exhausted or `next` returns marked value
// indicating that it's reduced. Either way signals `end` to an accumulator.
reduce.indexed = function reduceIndexed(indexed, next, initial) {
  var state = initial
  var index = 0
  var count = indexed.length
  while (index < count) {
    var value = indexed[index]
    state = next(value, state)
    index = index + 1
    if (value === end) return end
    if (isError(value)) return state
    if (isReduced(state)) return state.value
  }
  next(end, state)
}

// Both `undefined` and `null` implement accumulate for empty sequences.
reduce.define(void(0), reduce.empty)
reduce.define(null, reduce.empty)

// Array and arguments implement accumulate for indexed sequences.
reduce.define(Array, reduce.indexed)

function Arguments() { return arguments }
Arguments.prototype = Arguments()
reduce.define(Arguments, reduce.indexed)

// All other built-in data types are treated as single value collections
// by default. Of course individual types may choose to override that.
reduce.define(reduce.singular)

// Errors just yield that error.
reduce.define(Error, function(error, next) { next(error) })
module.exports = reduce

},{"./is-reduced":21,"./is-error":20,"./end":10,"method":29}],18:[function(require,module,exports){
"use strict";

var method = require("method")
var when = method("when")

when.define(function(value, onRealize) {
  return typeof(onRealize) === "function" ? onRealize(value) : value
})
when.define(Error, function(error, onRealize, onError) {
  return typeof(onError) === "function" ? onError(error) : error
})

module.exports = when

},{"method":30}],29:[function(require,module,exports){
"use strict";

var defineProperty = Object.defineProperty || function(object, name, property) {
  object[name] = property.value
  return object
}

// Shortcut for `Object.prototype.toString` for faster access.
var typefy = Object.prototype.toString

// Map to for jumping from typeof(value) to associated type prefix used
// as a hash in the map of builtin implementations.
var types = { "function": "Object", "object": "Object" }

// Array is used to save method implementations for the host objects in order
// to avoid extending them with non-primitive values that could cause leaks.
var host = []
// Hash map is used to save method implementations for builtin types in order
// to avoid extending their prototypes. This also allows to share method
// implementations for types across diff contexts / frames / compartments.
var builtin = {}

function Primitive() {}
function ObjectType() {}
ObjectType.prototype = new Primitive()
function ErrorType() {}
ErrorType.prototype = new ObjectType()

var Default = builtin.Default = Primitive.prototype
var Null = builtin.Null = new Primitive()
var Void = builtin.Void = new Primitive()
builtin.String = new Primitive()
builtin.Number = new Primitive()
builtin.Boolean = new Primitive()

builtin.Object = ObjectType.prototype
builtin.Error = ErrorType.prototype

builtin.EvalError = new ErrorType()
builtin.InternalError = new ErrorType()
builtin.RangeError = new ErrorType()
builtin.ReferenceError = new ErrorType()
builtin.StopIteration = new ErrorType()
builtin.SyntaxError = new ErrorType()
builtin.TypeError = new ErrorType()
builtin.URIError = new ErrorType()


function Method(id) {
  /**
  Private Method is a callable private name that dispatches on the first
  arguments same named Method:

      method(object, ...rest) => object[method](...rest)

  It is supposed to be given **unique** `id` preferably in `"jump@package"`
  like form so it won't collide with `id's` other users create. If no argument
  is passed unique id is generated, but it's proved to be problematic with
  npm where it's easy to end up with a copies of same module where each copy
  will have a different name.

  ## Example

      var foo = Method("foo@awesomeness")

      // Implementation for any types
      foo.define(function(value, arg1, arg2) {
        // ...
      })

      // Implementation for a specific type
      foo.define(BarType, function(bar, arg1, arg2) {
        // ...
      })
  **/

  // Create an internal unique name if one is not provided, also prefix it
  // to avoid collision with regular method names.
  var name = "λ:" + String(id || Math.random().toString(32).substr(2))

  function dispatch(value) {
    // Method dispatches on type of the first argument.
    // If first argument is `null` or `void` associated implementation is
    // looked up in the `builtin` hash where implementations for built-ins
    // are stored.
    var type = null
    var method = value === null ? Null[name] :
                 value === void(0) ? Void[name] :
                 // Otherwise attempt to use method with a generated private
                 // `name` that is supposedly in the prototype chain of the
                 // `target`.
                 value[name] ||
                 // Otherwise assume it's one of the built-in type instances,
                 // in which case implementation is stored in a `builtin` hash.
                 // Attempt to find a implementation for the given built-in
                 // via constructor name and method name.
                 ((type = builtin[(value.constructor || "").name]) &&
                  type[name]) ||
                 // Otherwise assume it's a host object. For host objects
                 // actual method implementations are stored in the `host`
                 // array and only index for the implementation is stored
                 // in the host object's prototype chain. This avoids memory
                 // leaks that otherwise could happen when saving JS objects
                 // on host object.
                 host[value["!" + name]] ||
                 // Otherwise attempt to lookup implementation for builtins by
                 // a type of the value. This basically makes sure that all
                 // non primitive values will delegate to an `Object`.
                 ((type = builtin[types[typeof(value)]]) && type[name])


    // If method implementation for the type is still not found then
    // just fallback for default implementation.
    method = method || Default[name]

    // If implementation is still not found (which also means there is no
    // default) just throw an error with a descriptive message.
    if (!method) throw TypeError("Type does not implements method: " + name)

    // If implementation was found then just delegate.
    return method.apply(method, arguments)
  }

  // Make `toString` of the dispatch return a private name, this enables
  // method definition without sugar:
  //
  //    var method = Method()
  //    object[method] = function() { /***/ }
  dispatch.toString = function toString() { return name }

  // Copy utility methods for convenient API.
  dispatch.implement = implementMethod
  dispatch.define = defineMethod

  return dispatch
}

// Create method shortcuts form functions.
var defineMethod = function defineMethod(Type, lambda) {
  return define(this, Type, lambda)
}
var implementMethod = function implementMethod(object, lambda) {
  return implement(this, object, lambda)
}

// Define `implement` and `define` polymorphic methods to allow definitions
// and implementations through them.
var implement = Method("implement@method")
var define = Method("define@method")


function _implement(method, object, lambda) {
  /**
  Implements `Method` for the given `object` with a provided `implementation`.
  Calling `Method` with `object` as a first argument will dispatch on provided
  implementation.
  **/
  return defineProperty(object, method.toString(), {
    enumerable: false,
    configurable: false,
    writable: false,
    value: lambda
  })
}

function _define(method, Type, lambda) {
  /**
  Defines `Method` for the given `Type` with a provided `implementation`.
  Calling `Method` with a first argument of this `Type` will dispatch on
  provided `implementation`. If `Type` is a `Method` default implementation
  is defined. If `Type` is a `null` or `undefined` `Method` is implemented
  for that value type.
  **/

  // Attempt to guess a type via `Object.prototype.toString.call` hack.
  var type = Type && typefy.call(Type.prototype)

  // If only two arguments are passed then `Type` is actually an implementation
  // for a default type.
  if (!lambda) Default[method] = Type
  // If `Type` is `null` or `void` store implementation accordingly.
  else if (Type === null) Null[method] = lambda
  else if (Type === void(0)) Void[method] = lambda
  // If `type` hack indicates built-in type and type has a name us it to
  // store a implementation into associated hash. If hash for this type does
  // not exists yet create one.
  else if (type !== "[object Object]" && Type.name) {
    var Bulitin = builtin[Type.name] || (builtin[Type.name] = new ObjectType())
    Bulitin[method] = lambda
  }
  // If `type` hack indicates an object, that may be either object or any
  // JS defined "Class". If name of the constructor is `Object`, assume it's
  // built-in `Object` and store implementation accordingly.
  else if (Type.name === "Object")
    builtin.Object[method] = lambda
  // Host objects are pain!!! Every browser does some crazy stuff for them
  // So far all browser seem to not implement `call` method for host object
  // constructors. If that is a case here, assume it's a host object and
  // store implementation in a `host` array and store `index` in the array
  // in a `Type.prototype` itself. This avoids memory leaks that could be
  // caused by storing JS objects on a host objects.
  else if (Type.call === void(0)) {
    var index = host.indexOf(lambda)
    if (index < 0) index = host.push(lambda) - 1
    // Prefix private name with `!` so it can be dispatched from the method
    // without type checks.
    implement("!" + method, Type.prototype, index)
  }
  // If Got that far `Type` is user defined JS `Class`. Define private name
  // as hidden property on it's prototype.
  else
    implement(method, Type.prototype, lambda)
}

// And provided implementations for a polymorphic equivalents.
_define(define, _define)
_define(implement, _implement)

// Define exports on `Method` as it's only thing being exported.
Method.implement = implement
Method.define = define
Method.Method = Method
Method.method = Method
Method.builtin = builtin
Method.host = host

module.exports = Method

},{}],30:[function(require,module,exports){
"use strict";

var defineProperty = Object.defineProperty || function(object, name, property) {
  object[name] = property.value
  return object
}

// Shortcut for `Object.prototype.toString` for faster access.
var typefy = Object.prototype.toString

// Map to for jumping from typeof(value) to associated type prefix used
// as a hash in the map of builtin implementations.
var types = { "function": "Object", "object": "Object" }

// Array is used to save method implementations for the host objects in order
// to avoid extending them with non-primitive values that could cause leaks.
var host = []
// Hash map is used to save method implementations for builtin types in order
// to avoid extending their prototypes. This also allows to share method
// implementations for types across diff contexts / frames / compartments.
var builtin = {}

function Primitive() {}
function ObjectType() {}
ObjectType.prototype = new Primitive()
function ErrorType() {}
ErrorType.prototype = new ObjectType()

var Default = builtin.Default = Primitive.prototype
var Null = builtin.Null = new Primitive()
var Void = builtin.Void = new Primitive()
builtin.String = new Primitive()
builtin.Number = new Primitive()
builtin.Boolean = new Primitive()

builtin.Object = ObjectType.prototype
builtin.Error = ErrorType.prototype

builtin.EvalError = new ErrorType()
builtin.InternalError = new ErrorType()
builtin.RangeError = new ErrorType()
builtin.ReferenceError = new ErrorType()
builtin.StopIteration = new ErrorType()
builtin.SyntaxError = new ErrorType()
builtin.TypeError = new ErrorType()
builtin.URIError = new ErrorType()


function Method(hint) {
  /**
  Private Method is a callable private name that dispatches on the first
  arguments same named Method:

      method(object, ...rest) => object[method](...rest)

  Optionally hint string may be provided that will be used in generated names
  to ease debugging.

  ## Example

      var foo = Method()

      // Implementation for any types
      foo.define(function(value, arg1, arg2) {
        // ...
      })

      // Implementation for a specific type
      foo.define(BarType, function(bar, arg1, arg2) {
        // ...
      })
  **/

  // Create an internal unique name if `hint` is provided it is used to
  // prefix name to ease debugging.
  var name = (hint || "") + "#" + Math.random().toString(32).substr(2)

  function dispatch(value) {
    // Method dispatches on type of the first argument.
    // If first argument is `null` or `void` associated implementation is
    // looked up in the `builtin` hash where implementations for built-ins
    // are stored.
    var type = null
    var method = value === null ? Null[name] :
                 value === void(0) ? Void[name] :
                 // Otherwise attempt to use method with a generated private
                 // `name` that is supposedly in the prototype chain of the
                 // `target`.
                 value[name] ||
                 // Otherwise assume it's one of the built-in type instances,
                 // in which case implementation is stored in a `builtin` hash.
                 // Attempt to find a implementation for the given built-in
                 // via constructor name and method name.
                 ((type = builtin[(value.constructor || "").name]) &&
                  type[name]) ||
                 // Otherwise assume it's a host object. For host objects
                 // actual method implementations are stored in the `host`
                 // array and only index for the implementation is stored
                 // in the host object's prototype chain. This avoids memory
                 // leaks that otherwise could happen when saving JS objects
                 // on host object.
                 host[value["!" + name]] ||
                 // Otherwise attempt to lookup implementation for builtins by
                 // a type of the value. This basically makes sure that all
                 // non primitive values will delegate to an `Object`.
                 ((type = builtin[types[typeof(value)]]) && type[name])


    // If method implementation for the type is still not found then
    // just fallback for default implementation.
    method = method || Default[name]


    // If implementation is still not found (which also means there is no
    // default) just throw an error with a descriptive message.
    if (!method) throw TypeError("Type does not implements method: " + name)

    // If implementation was found then just delegate.
    return method.apply(method, arguments)
  }

  // Make `toString` of the dispatch return a private name, this enables
  // method definition without sugar:
  //
  //    var method = Method()
  //    object[method] = function() { /***/ }
  dispatch.toString = function toString() { return name }

  // Copy utility methods for convenient API.
  dispatch.implement = implementMethod
  dispatch.define = defineMethod

  return dispatch
}

// Create method shortcuts form functions.
var defineMethod = function defineMethod(Type, lambda) {
  return define(this, Type, lambda)
}
var implementMethod = function implementMethod(object, lambda) {
  return implement(this, object, lambda)
}

// Define `implement` and `define` polymorphic methods to allow definitions
// and implementations through them.
var implement = Method("implement")
var define = Method("define")


function _implement(method, object, lambda) {
  /**
  Implements `Method` for the given `object` with a provided `implementation`.
  Calling `Method` with `object` as a first argument will dispatch on provided
  implementation.
  **/
  return defineProperty(object, method.toString(), {
    enumerable: false,
    configurable: false,
    writable: false,
    value: lambda
  })
}

function _define(method, Type, lambda) {
  /**
  Defines `Method` for the given `Type` with a provided `implementation`.
  Calling `Method` with a first argument of this `Type` will dispatch on
  provided `implementation`. If `Type` is a `Method` default implementation
  is defined. If `Type` is a `null` or `undefined` `Method` is implemented
  for that value type.
  **/

  // Attempt to guess a type via `Object.prototype.toString.call` hack.
  var type = Type && typefy.call(Type.prototype)

  // If only two arguments are passed then `Type` is actually an implementation
  // for a default type.
  if (!lambda) Default[method] = Type
  // If `Type` is `null` or `void` store implementation accordingly.
  else if (Type === null) Null[method] = lambda
  else if (Type === void(0)) Void[method] = lambda
  // If `type` hack indicates built-in type and type has a name us it to
  // store a implementation into associated hash. If hash for this type does
  // not exists yet create one.
  else if (type !== "[object Object]" && Type.name) {
    var Bulitin = builtin[Type.name] || (builtin[Type.name] = new ObjectType())
    Bulitin[method] = lambda
  }
  // If `type` hack indicates an object, that may be either object or any
  // JS defined "Class". If name of the constructor is `Object`, assume it's
  // built-in `Object` and store implementation accordingly.
  else if (Type.name === "Object")
    builtin.Object[method] = lambda
  // Host objects are pain!!! Every browser does some crazy stuff for them
  // So far all browser seem to not implement `call` method for host object
  // constructors. If that is a case here, assume it's a host object and
  // store implementation in a `host` array and store `index` in the array
  // in a `Type.prototype` itself. This avoids memory leaks that could be
  // caused by storing JS objects on a host objects.
  else if (Type.call === void(0)) {
    var index = host.indexOf(lambda)
    if (index < 0) index = host.push(lambda) - 1
    // Prefix private name with `!` so it can be dispatched from the method
    // without type checks.
    implement("!" + method, Type.prototype, index)
  }
  // If Got that far `Type` is user defined JS `Class`. Define private name
  // as hidden property on it's prototype.
  else
    implement(method, Type.prototype, lambda)
}

// And provided implementations for a polymorphic equivalents.
_define(define, _define)
_define(implement, _implement)

// Define exports on `Method` as it's only thing being exported.
Method.implement = implement
Method.define = define
Method.Method = Method
Method.method = Method
Method.builtin = builtin
Method.host = host

module.exports = Method

},{}],27:[function(require,module,exports){
"use strict";

var method = require("method")

// Method is supposed to return array of watchers for the given
// value.
var watchers = method("watchers")
module.exports = watchers

},{"method":30}],28:[function(require,module,exports){
"use strict";

var method = require("method")
var watchers = require("./watchers")

var watch = method("watch")
watch.define(function(value, watcher) {
  // Registers a `value` `watcher`, unless it"s already registered.
  var registered = watchers(value)
  if (registered && registered.indexOf(watcher) < 0)
    registered.push(watcher)
  return value
})

module.exports = watch

},{"./watchers":27,"method":30}],26:[function(require,module,exports){
"use strict";

var method = require("method")

// Returns `true` if given `value` is pending, otherwise returns
// `false`. All types will return false unless type specific
// implementation is provided to do it otherwise.
var isPending = method("is-pending")

isPending.define(function() { return false })

module.exports = isPending

},{"method":30}],25:[function(require,module,exports){
"use strict";

var method = require("method")

// Set's up a callback to be called once pending
// value is realized. All object by default are realized.
var await = method("await")
await.define(function(value, callback) { callback(value) })

module.exports = await

},{"method":30}],23:[function(require,module,exports){
"use strict";

var method = require("method")
// Method delivers pending value.
var deliver = method("deliver")

module.exports = deliver

},{"method":30}]},{},[1])
;