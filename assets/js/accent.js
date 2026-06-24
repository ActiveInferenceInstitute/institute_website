// Highlight-color picker. CSP-safe: external self-origin script, no inline, no
// fetch — only localStorage + DOM + the CSSOM (element.style.setProperty), which
// CSP does not block. The site's single non-grayscale accent flows entirely
// through the design-system tokens --ds-red / --ds-red-light / --ds-red-dark
// (and everything keyed off them: --ds-primary, --ds-accent, --red,
// --accent-text). Overriding those three on <html> re-tints the whole brand in
// both light and dark themes without touching the byte-pinned instituteos-ds.css.
(function () {
  "use strict";

  var KEY = "aii-accent";
  var root = document.documentElement;

  // base = primary accent, light = brighter (dark-theme text/hover), dark = pressed.
  // "red" mirrors the canonical design-system values, so the default selection is a
  // no-op tint identical to the shipped brand. None of these hexes collide with the
  // banned legacy-theme palette enforced by scripts/check_site_contract.py.
  var ACCENTS = {
    red: { base: "#dc2626", light: "#ef4444", dark: "#b91c1c" },
    amber: { base: "#d97706", light: "#f59e0b", dark: "#b45309" },
    green: { base: "#16a34a", light: "#22c55e", dark: "#15803d" },
    teal: { base: "#0d9488", light: "#14b8a6", dark: "#0f766e" },
    blue: { base: "#2563eb", light: "#3b82f6", dark: "#1d4ed8" },
    violet: { base: "#7c3aed", light: "#8b5cf6", dark: "#6d28d9" },
    magenta: { base: "#db2777", light: "#ec4899", dark: "#be185d" },
  };
  var DEFAULT = "red";

  function stored() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function save(name) {
    try {
      if (name === DEFAULT) {
        localStorage.removeItem(KEY);
      } else {
        localStorage.setItem(KEY, name);
      }
    } catch (e) {
      /* storage may be unavailable (private mode) — selection still applies per page */
    }
  }

  function apply(name) {
    var accent = ACCENTS[name] || ACCENTS[DEFAULT];
    root.style.setProperty("--ds-red", accent.base);
    root.style.setProperty("--ds-red-light", accent.light);
    root.style.setProperty("--ds-red-dark", accent.dark);
  }

  var current = ACCENTS[stored()] ? stored() : DEFAULT;
  apply(current);

  var toggle = document.getElementById("accent-toggle");
  var menu = document.getElementById("accent-menu");
  if (!toggle || !menu) {
    return;
  }

  var swatches = menu.querySelectorAll(".accent-swatch");
  var dot = toggle.querySelector(".accent-toggle-dot");

  // Paint the trigger dot and each swatch from the palette via the CSSOM so no
  // inline style attribute (which the strict style-src CSP would block) is needed.
  function paintDot(name) {
    if (dot) {
      dot.style.setProperty("background-color", (ACCENTS[name] || ACCENTS[DEFAULT]).base);
    }
  }
  for (var i = 0; i < swatches.length; i += 1) {
    var name = swatches[i].getAttribute("data-accent");
    if (ACCENTS[name]) {
      swatches[i].style.setProperty("background-color", ACCENTS[name].base);
    }
  }

  function syncChecked(name) {
    for (var i = 0; i < swatches.length; i += 1) {
      swatches[i].setAttribute("aria-checked", swatches[i].getAttribute("data-accent") === name ? "true" : "false");
    }
  }

  function openMenu() {
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onKeydown, true);
  }

  function closeMenu() {
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onKeydown, true);
  }

  function onDocClick(event) {
    if (!menu.contains(event.target) && !toggle.contains(event.target)) {
      closeMenu();
    }
  }

  function onKeydown(event) {
    if (event.key === "Escape" || event.key === "Esc") {
      closeMenu();
      toggle.focus();
    }
  }

  paintDot(current);
  syncChecked(current);

  toggle.addEventListener("click", function () {
    if (menu.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  for (var j = 0; j < swatches.length; j += 1) {
    swatches[j].addEventListener("click", function (event) {
      var name = event.currentTarget.getAttribute("data-accent");
      if (!ACCENTS[name]) {
        return;
      }
      current = name;
      apply(name);
      save(name);
      paintDot(name);
      syncChecked(name);
      closeMenu();
      toggle.focus();
    });
  }
})();
