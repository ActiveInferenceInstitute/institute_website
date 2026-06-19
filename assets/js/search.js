// Global site search. Reads window.__SEARCH_INDEX__ (loaded from search-data.js,
// same 'self' origin — no fetch, CSP-safe) and renders ranked results inline.
(function () {
  "use strict";
  var input = document.getElementById("site-search-input");
  var results = document.getElementById("site-search-results");
  var index = window.__SEARCH_INDEX__;
  if (!input || !results || !index) {
    return;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char];
    });
  }

  function open() {
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function close() {
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
  }

  function rank(query) {
    var terms = query.split(/\s+/).filter(Boolean);
    var scored = [];
    for (var i = 0; i < index.length; i += 1) {
      var entry = index[i];
      var title = (entry.t || "").toLowerCase();
      var hay = title + " " + (entry.k || "").toLowerCase() + " " + (entry.c || "").toLowerCase();
      var score = 0;
      var matched = true;
      for (var t = 0; t < terms.length; t += 1) {
        if (hay.indexOf(terms[t]) === -1) {
          matched = false;
          break;
        }
        score += title.indexOf(terms[t]) === 0 ? 6 : title.indexOf(terms[t]) !== -1 ? 4 : 1;
      }
      if (matched) {
        scored.push({ entry: entry, score: score });
      }
    }
    scored.sort(function (a, b) {
      return b.score - a.score || a.entry.t.localeCompare(b.entry.t);
    });
    return scored.slice(0, 12);
  }

  function render(rawQuery) {
    var query = rawQuery.trim().toLowerCase();
    if (query.length < 2) {
      close();
      results.innerHTML = "";
      return;
    }
    var matches = rank(query);
    if (!matches.length) {
      results.innerHTML = '<p class="site-search-empty">No matches found.</p>';
    } else {
      results.innerHTML = matches
        .map(function (match) {
          return (
            '<a class="site-search-result" role="option" href="' +
            encodeURI(match.entry.u) +
            '"><span class="site-search-kind">' +
            escapeHtml(match.entry.c) +
            '</span><span class="site-search-title">' +
            escapeHtml(match.entry.t) +
            "</span></a>"
          );
        })
        .join("");
    }
    open();
  }

  function items() {
    return Array.prototype.slice.call(results.querySelectorAll(".site-search-result"));
  }

  input.addEventListener("input", function () {
    render(input.value);
  });
  input.addEventListener("focus", function () {
    if (input.value.trim().length >= 2) {
      render(input.value);
    }
  });
  input.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      close();
      input.blur();
    } else if (event.key === "ArrowDown") {
      var first = items()[0];
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  results.addEventListener("keydown", function (event) {
    var list = items();
    var current = list.indexOf(document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      (list[current + 1] || list[0]).focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (current <= 0) {
        input.focus();
      } else {
        list[current - 1].focus();
      }
    } else if (event.key === "Escape") {
      close();
      input.focus();
    }
  });
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".site-search")) {
      close();
    }
  });
})();
