// Imports
// -----------------------------------------------------------------------------

var fold = require('reducers/fold');
var filter = require('reducers/filter');
var map = require('reducers/map');
var expand = require('reducers/expand');
var merge = require('reducers/merge');
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
  return extend(state, old, update);
}

function updateState(old, update, filters) {
  // Create a new "state" object from `old` by running it through a series of
  // filter functions.
  // Start by extending a prototypal copy of `old` with `update`.
  return reduce([extendState].concat(filters), function (state, filter) {
    // Filter functions receive current state, old state and update object.
    return filter(state, old, update);
  }, {});
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

  // Append RocketBar to active screen (but not lock screen)
  var cappedScreenIndex = Math.max(state.index, 1);
  state.screenEls[cappedScreenIndex].appendChild(state.rocketbarEl);

  reduce(state.cardEls, function activateEl(activeCardEl, cardEl) {
    activeCardEl === cardEl ?
      cardEl.classList.remove('deck-card-zoomed-out') :
      cardEl.classList.add('deck-card-zoomed-out');

    return activeCardEl;
  }, state.activeCardEl);

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
var rocketbarEl = document.getElementById('rocketbar');
var cardEls = document.getElementsByClassName('deck-card');

var STATE = updateState({}, {
  index: 0,
  units: 9,
  unitWidth: 320,
  backgroundWidth: bg1El.clientWidth,
  screensEl: homeScreensEl,
  screenEls: homeScreensEl.children,
  backgroundEl: bg1El,
  rocketbarEl: rocketbarEl,
  activeCardEl: null,
  cardEls: cardEls
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

// Find geneology of tapped elements -- crawls up the dom
// finding ancestors of element (including element itself)
// Expand into flat list.
var tappedAncestorsOverTime = expand(tappedElsOverTime, geneology);

// Filter down to only card taps
var cardTapsOverTime = filter(tappedAncestorsOverTime, function isCard(el) {
  return hasClass(el, 'deck-card');
});

var activeCardStatesOverTime = map(cardTapsOverTime, function (el) {
  return updateState(STATE, {
    activeCardEl: STATE.activeCardEl === el ? null : el
  }, STATE_FILTERS);
});

var prevIndexStatesOverTime = map(prevElTapsOverTime, function (event) {
  event.preventDefault();
  return updateState(STATE, { index: STATE.index - 1 }, STATE_FILTERS);
});

var nextIndexStatesOverTime = map(nextElTapsOverTime, function (event) {
  event.preventDefault();
  return updateState(STATE, { index: STATE.index + 1 }, STATE_FILTERS);
});

var statesOverTime = merge([
  prevIndexStatesOverTime,
  nextIndexStatesOverTime,
  activeCardStatesOverTime
]);

fold(statesOverTime, function (state) {
  return STATE = render(state);
});

