  var script = document.currentScript;
  var base = (script && script.dataset && script.dataset.base) || "/";

  var path = location.pathname;
  if (base !== "/" && path.indexOf(base) === 0) {
    path = path.slice(base.length);
  } else {
    path = path.replace(/^\/+/, "");
  }

  var key;
  try {
    key = decodeURIComponent(path);
  } catch (e) {
    key = path;
  }
  key = key.replace(/\/+$/, "").replace(/\.html?$/i, "").toLowerCase();

  var dest = null;

  if (Object.prototype.hasOwnProperty.call(MAP, key)) {
    dest = MAP[key];
  } else {
    // Strip a leading locale segment (if present) before testing prefix
    // rules, and remember it so it can be re-attached to the destination.
    var localePrefix = "";
    var rest = key;
    for (var i = 0; i < LOCALE_CODES.length; i++) {
      var code = LOCALE_CODES[i];
      if (rest === code || rest.indexOf(code + "/") === 0) {
        localePrefix = code + "/";
        rest = rest.slice(code.length + 1);
        break;
      }
    }
    for (var j = 0; j < PREFIX_REDIRECTS.length; j++) {
      var rule = PREFIX_REDIRECTS[j];
      if (rest.indexOf(rule.from) === 0) {
        var tail = rest.slice(rule.from.length);
        dest = localePrefix + rule.to + (tail ? tail + "/" : "");
        break;
      }
    }
    if (dest === null) {
      for (var k = 0; k < SET_REDIRECTS.length; k++) {
        var setRule = SET_REDIRECTS[k];
        if (rest === setRule.from) {
          dest = localePrefix + setRule.to;
          break;
        }
      }
    }
  }

  if (dest !== null) {
    var out = /^https?:\/\//.test(dest) ? dest : base + dest;
    // Avoid a no-op redirect to the same location.
    if (out !== location.pathname) {
      location.replace(out);
    }
  }
