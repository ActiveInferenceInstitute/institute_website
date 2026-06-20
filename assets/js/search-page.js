// Dedicated /search/ page renderer. Reads window.__SEARCH_INDEX__ (loaded from
// search-data.js, same 'self' origin — no fetch, CSP-safe) and renders the FULL
// result set (not capped), grouped by type. Prefills from the ?q= query string.
(function () {
  "use strict";
  var input = document.getElementById("search-page-input");
  var results = document.getElementById("search-page-results");
  var status = document.getElementById("search-page-status");
  var index = window.__SEARCH_INDEX__;
  var synonyms = window.__SEARCH_SYNONYMS__ || {};
  if (!input || !results || !index) {
    return;
  }

  // Stable display order for the result-type groups.
  var GROUP_ORDER = ["Page", "Repository", "Concept", "Policy", "Process", "Person"];

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char];
    });
  }

  // Alias expansion (both directions). Used only to BOOST matches.
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

  // In-order subsequence fallback when a direct substring match misses.
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

  // Wrap matches in <mark>. Escapes source text FIRST, then inserts literal tags.
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

  // Rank every matching entry (no slice) using the same scoring shape as the
  // header quick-search, so ordering is consistent across both surfaces.
  // Tiered per-term score (identical shape to search.js). 0 => unsatisfiable.
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
    return scored;
  }

  function groupKey(kind) {
    return GROUP_ORDER.indexOf(kind) === -1 ? "Other" : kind;
  }

  function resultCard(entry, terms) {
    var snippet = (entry.k || "").trim();
    return (
      '<li class="search-page-result">' +
      '<a href="' +
      encodeURI(entry.u) +
      '"><span class="search-page-result-title">' +
      highlight(entry.t, terms) +
      "</span>" +
      (snippet ? '<span class="search-page-result-snippet">' + highlight(snippet, terms) + "</span>" : "") +
      "</a></li>"
    );
  }

  function render(rawQuery) {
    var query = String(rawQuery || "").trim().toLowerCase();
    if (query.length < 2) {
      results.innerHTML = "";
      status.textContent = "Type at least two characters to search.";
      return;
    }
    var terms = query.split(/\s+/).filter(Boolean);
    var matches = rank(query);
    if (!matches.length) {
      results.innerHTML = "";
      status.textContent = 'No matches found for "' + query + '".';
      return;
    }

    var buckets = {};
    for (var i = 0; i < matches.length; i += 1) {
      var kind = groupKey(matches[i].entry.c || "Other");
      (buckets[kind] = buckets[kind] || []).push(matches[i].entry);
    }

    var order = GROUP_ORDER.slice();
    if (buckets.Other) {
      order.push("Other");
    }

    var html = "";
    for (var g = 0; g < order.length; g += 1) {
      var group = order[g];
      var items = buckets[group];
      if (!items || !items.length) {
        continue;
      }
      html +=
        '<section class="search-page-group">' +
        "<h2>" +
        escapeHtml(group) +
        ' <span class="search-page-group-count">' +
        items.length +
        "</span></h2>" +
        '<ul class="search-page-result-list">' +
        items
          .map(function (entry) {
            return resultCard(entry, terms);
          })
          .join("") +
        "</ul></section>";
    }

    results.innerHTML = html;
    status.textContent =
      matches.length + (matches.length === 1 ? " result" : " results") + ' for "' + query + '".';
  }

  // Read the ?q= prefill once at load.
  function queryFromUrl() {
    var match = /[?&]q=([^&]*)/.exec(window.location.search);
    if (!match) {
      return "";
    }
    try {
      return decodeURIComponent(match[1].replace(/\+/g, " "));
    } catch (error) {
      return "";
    }
  }

  input.addEventListener("input", function () {
    render(input.value);
  });

  var prefill = queryFromUrl();
  if (prefill) {
    input.value = prefill;
  }
  render(input.value);
  // Focus the input so a keyboard user can refine immediately.
  if (typeof input.focus === "function") {
    input.focus();
  }
})();
