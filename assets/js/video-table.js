// /video/ page row filter. Filters the server-rendered #video-table-mount rows
// by matching visible cell text against the query. No fetch, no external index —
// the full table is already in the DOM (CSP-safe, matches search-page.js's
// zero-network pattern).
(function () {
  "use strict";
  var mount = document.getElementById("video-table-mount");
  var input = document.getElementById("video-table-filter");
  var status = document.getElementById("video-table-filter-status");
  if (!mount || !input || !status) {
    return;
  }
  var rows = Array.prototype.slice.call(mount.querySelectorAll("tbody tr"));
  var total = rows.length;

  function normalize(value) {
    return String(value || "").toLowerCase();
  }

  function applyFilter() {
    var terms = normalize(input.value).split(/\s+/).filter(Boolean);
    var visible = 0;
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var haystack = row.dataset.filterText || normalize(row.textContent);
      row.dataset.filterText = haystack;
      var matches = true;
      for (var t = 0; t < terms.length; t += 1) {
        if (haystack.indexOf(terms[t]) === -1) {
          matches = false;
          break;
        }
      }
      row.hidden = !matches;
      if (matches) {
        visible += 1;
      }
    }
    status.textContent =
      terms.length === 0
        ? total + " videos"
        : visible + " of " + total + " videos match “" + input.value + "”";
  }

  input.addEventListener("input", applyFilter);
  applyFilter();
})();
