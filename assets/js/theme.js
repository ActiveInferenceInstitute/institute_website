// Light/dark/system theme toggle. CSP-safe: external self-origin script, no
// inline, no fetch — only localStorage + classList. The InstituteOS design
// system (instituteos-ds.css) ships a complete light-token block keyed on
// html.theme-light, so toggling that class re-themes the whole site.
(function () {
  "use strict";
  var KEY = "aii-theme";
  var root = document.documentElement;
  var lightMq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  function systemPrefersLight() {
    return !!(lightMq && lightMq.matches);
  }

  function stored() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function save(mode) {
    try {
      if (mode === "system") {
        localStorage.removeItem(KEY);
      } else {
        localStorage.setItem(KEY, mode);
      }
    } catch (e) {
      /* storage may be unavailable (private mode) — toggle still works per page */
    }
  }

  function effectiveLight(mode) {
    return mode === "light" || (mode === "system" && systemPrefersLight());
  }

  function apply(mode) {
    var light = effectiveLight(mode);
    root.classList.toggle("theme-light", light);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", light ? "#f9fafb" : "#0a0a0a");
    }
  }

  function syncButton(button, mode) {
    var light = effectiveLight(mode);
    button.setAttribute("aria-pressed", light ? "true" : "false");
    button.setAttribute("data-theme-mode", mode);
    button.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
  }

  var current = stored() || "system";
  apply(current);

  var button = document.getElementById("theme-toggle");
  if (button) {
    syncButton(button, current);
    button.addEventListener("click", function () {
      // Binary toggle keyed on the current effective theme.
      current = effectiveLight(current) ? "dark" : "light";
      save(current);
      apply(current);
      syncButton(button, current);
    });
  }

  if (lightMq) {
    var onChange = function () {
      if (current === "system") {
        apply(current);
        if (button) {
          syncButton(button, current);
        }
      }
    };
    if (lightMq.addEventListener) {
      lightMq.addEventListener("change", onChange);
    } else if (lightMq.addListener) {
      lightMq.addListener(onChange);
    }
  }
})();
