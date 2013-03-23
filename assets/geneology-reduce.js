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
