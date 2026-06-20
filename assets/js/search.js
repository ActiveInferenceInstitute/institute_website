// Global site search. Reads window.__SEARCH_INDEX__ (loaded from search-data.js,
// same 'self' origin — no fetch, CSP-safe) and renders ranked results inline.
(function () {
  "use strict";
  var input = document.getElementById("site-search-input");
  var results = document.getElementById("site-search-results");
  var index = window.__SEARCH_INDEX__;
  var searchPageUrl = window.__SEARCH_PAGE_URL__ || "";
  var synonyms = window.__SEARCH_SYNONYMS__ || {};
  if (!input || !results || !index) {
    return;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char];
    });
  }

  // Expand a query term into its aliases (both directions: a term that is a
  // synonym key contributes its values; a term that appears among the values
  // contributes the canonical key). Used only to BOOST matches.
  function expandTerm(term) {
    var out = [];
    var canonical = synonyms[term];
    if (canonical) {
      for (var i = 0; i < canonical.length; i += 1) {
        out.push(canonical[i]);
      }
    }
    for (var key in synonyms) {
      if (Object.prototype.hasOwnProperty.call(synonyms, key)) {
        var values = synonyms[key];
        for (var j = 0; j < values.length; j += 1) {
          if (values[j] === term) {
            out.push(key);
            break;
          }
        }
      }
    }
    return out;
  }

  // In-order subsequence test: every char of term appears in hay in order.
  // Used only as a last-resort fallback when a direct substring match misses.
  function fuzzyContains(hay, term) {
    var p = 0;
    for (var i = 0; i < hay.length && p < term.length; i += 1) {
      if (hay.charAt(i) === term.charAt(p)) {
        p += 1;
      }
    }
    return p === term.length;
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Wrap matched substrings in <mark>. Escapes the source text FIRST, then only
  // inserts literal <mark>/</mark> tags — no raw query content reaches innerHTML.
  function highlight(text, terms) {
    var out = escapeHtml(text);
    var sorted = terms.slice().sort(function (a, b) {
      return b.length - a.length;
    });
    for (var i = 0; i < sorted.length; i += 1) {
      if (sorted[i].length < 2) {
        continue;
      }
      var re = new RegExp(escapeRegex(escapeHtml(sorted[i])), "gi");
      out = out.replace(re, function (m) {
        return "<mark>" + m + "</mark>";
      });
    }
    return out;
  }

  function open() {
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function close() {
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
  }

  // Tiered score for a single term against one entry. Returns 0 when the term
  // cannot be satisfied (directly, via alias, or via fuzzy fallback).
  function termScore(term, title, hay) {
    if (title.indexOf(term) === 0) {
      return 6;
    }
    if (title.indexOf(term) !== -1) {
      return 4;
    }
    var aliases = expandTerm(term);
    for (var a = 0; a < aliases.length; a += 1) {
      if (hay.indexOf(aliases[a]) !== -1) {
        return 3;
      }
    }
    if (hay.indexOf(term) !== -1) {
      return 1;
    }
    if (fuzzyContains(hay, term)) {
      return 0.5;
    }
    return 0;
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
        var s = termScore(terms[t], title, hay);
        if (s === 0) {
          matched = false;
          break;
        }
        score += s;
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
    var terms = query.split(/\s+/).filter(Boolean);
    var matches = rank(query);
    if (!matches.length) {
      results.innerHTML = '<p class="site-search-empty">No matches found.</p>';
    } else {
      var list = matches
        .map(function (match) {
          return (
            '<a class="site-search-result" role="option" href="' +
            encodeURI(match.entry.u) +
            '"><span class="site-search-kind">' +
            escapeHtml(match.entry.c) +
            '</span><span class="site-search-title">' +
            highlight(match.entry.t, terms) +
            "</span></a>"
          );
        })
        .join("");
      // Offer a "See all results" link into the dedicated /search/ page (which
      // renders the FULL grouped result set), prefilled with the current query.
      var seeAll = searchPageUrl
        ? '<a class="site-search-all" href="' +
          searchPageUrl +
          "?q=" +
          encodeURIComponent(query) +
          '">See all results for &ldquo;' +
          escapeHtml(query) +
          "&rdquo;</a>"
        : "";
      results.innerHTML = list + seeAll;
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
