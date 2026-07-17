// /video/ page row filter + sort. Filters the server-rendered #video-table-mount
// rows by matching visible cell text against a query and/or a selected Type, and
// reorders rows when a sortable column header is clicked. No fetch, no external
// index — the full table is already in the DOM (CSP-safe, matches
// search-page.js's zero-network pattern).
(function () {
  "use strict";
  var mount = document.getElementById("video-table-mount");
  var input = document.getElementById("video-table-filter");
  var typeSelect = document.getElementById("video-table-type");
  var topicSelect = document.getElementById("video-table-topic");
  var status = document.getElementById("video-table-filter-status");
  var tbody = mount ? mount.querySelector("tbody") : null;
  if (!mount || !input || !status || !tbody) {
    return;
  }
  var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
  var total = rows.length;
  var sortButtons = Array.prototype.slice.call(mount.querySelectorAll("button.th-sort"));

  function normalize(value) {
    return String(value || "").toLowerCase();
  }

  function applyFilter() {
    var terms = normalize(input.value).split(/\s+/).filter(Boolean);
    var type = typeSelect ? typeSelect.value : "";
    var topic = topicSelect ? topicSelect.value : "";
    var visible = 0;
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      // Base haystack is the visible cell text plus the row's humanized topic
      // labels (topics are not a rendered column but must be searchable).
      var haystack = row.dataset.filterText;
      if (haystack === undefined) {
        haystack = normalize(row.textContent) + " " + (row.dataset.topicText || "");
        row.dataset.filterText = haystack;
      }
      var matchesText = true;
      for (var t = 0; t < terms.length; t += 1) {
        if (haystack.indexOf(terms[t]) === -1) {
          matchesText = false;
          break;
        }
      }
      var rowTypes = (row.dataset.types || "").split("|").filter(Boolean);
      var matchesType = !type || rowTypes.indexOf(type) !== -1;
      var rowTopics = (row.dataset.topics || "").split("|").filter(Boolean);
      var matchesTopic = !topic || rowTopics.indexOf(topic) !== -1;
      var show = matchesText && matchesType && matchesTopic;
      row.hidden = !show;
      if (show) {
        visible += 1;
      }
    }
    if (terms.length === 0 && !type && !topic) {
      status.textContent = total + " videos";
    } else {
      var suffix = [];
      if (type) {
        suffix.push("type “" + type + "”");
      }
      if (topic && topicSelect) {
        var opt = topicSelect.options[topicSelect.selectedIndex];
        suffix.push("topic “" + (opt ? opt.text.replace(/\s*\(\d+\)\s*$/, "") : topic) + "”");
      }
      if (terms.length) {
        suffix.push("“" + input.value + "”");
      }
      status.textContent = visible + " of " + total + " videos match " + suffix.join(" and ");
    }
  }

  function datasetSortKey(sortKey) {
    return "sort" + sortKey.charAt(0).toUpperCase() + sortKey.slice(1);
  }

  function sortRows(sortKey, direction) {
    var attr = datasetSortKey(sortKey);
    rows.sort(function (a, b) {
      var av = a.dataset[attr] || "";
      var bv = b.dataset[attr] || "";
      if (av === bv) {
        return 0;
      }
      var ascending = av < bv;
      return direction === "ascending" ? (ascending ? -1 : 1) : ascending ? 1 : -1;
    });
    for (var i = 0; i < rows.length; i += 1) {
      tbody.appendChild(rows[i]);
    }
  }

  function clearOtherIndicators(exceptButton) {
    for (var i = 0; i < sortButtons.length; i += 1) {
      if (sortButtons[i] !== exceptButton) {
        sortButtons[i].parentElement.setAttribute("aria-sort", "none");
      }
    }
  }

  function handleSortClick() {
    var button = this;
    var th = button.parentElement;
    var current = th.getAttribute("aria-sort");
    var direction = current === "ascending" ? "descending" : "ascending";
    clearOtherIndicators(button);
    th.setAttribute("aria-sort", direction);
    sortRows(button.dataset.sortKey, direction);
  }

  for (var s = 0; s < sortButtons.length; s += 1) {
    sortButtons[s].addEventListener("click", handleSortClick);
  }

  input.addEventListener("input", applyFilter);
  if (typeSelect) {
    typeSelect.addEventListener("change", applyFilter);
  }
  if (topicSelect) {
    topicSelect.addEventListener("change", applyFilter);
  }
  applyFilter();
})();
