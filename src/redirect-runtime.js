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
  }

  if (dest !== null) {
    var out = /^https?:\/\//.test(dest) ? dest : base + dest;
    // Avoid a no-op redirect to the same location.
    if (out !== location.pathname) {
      location.replace(out + (location.search || "") + (location.hash || ""));
    }
  }
