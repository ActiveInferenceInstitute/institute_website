// Dedicated /search/ page renderer. Reads window.__SEARCH_INDEX__ (loaded from
// search-data.js, same 'self' origin — no fetch, CSP-safe) and renders the FULL
// result set (not capped), grouped by type. Prefills from the ?q= query string.
(function () {
  "use strict";
  var input = document.getElementById("search-page-input");
  var results = document.getElementById("search-page-results");
  var status = document.getElementById("search-page-status");
  var index = window.__SEARCH_INDEX__;
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

  // Rank every matching entry (no slice) using the same scoring shape as the
  // header quick-search, so ordering is consistent across both surfaces.
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
    return scored;
  }

  function groupKey(kind) {
    return GROUP_ORDER.indexOf(kind) === -1 ? "Other" : kind;
  }

  function resultCard(entry) {
    var snippet = (entry.k || "").trim();
    return (
      '<li class="search-page-result">' +
      '<a href="' +
      encodeURI(entry.u) +
      '"><span class="search-page-result-title">' +
      escapeHtml(entry.t) +
      "</span>" +
      (snippet ? '<span class="search-page-result-snippet">' + escapeHtml(snippet) + "</span>" : "") +
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
        items.map(resultCard).join("") +
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
