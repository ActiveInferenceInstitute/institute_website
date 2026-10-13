"use strict";

const calendarErrors = [];
window.addEventListener("error", (event) => calendarErrors.push(event.message));
document.addEventListener("DOMContentLoaded", () => {
  const result = document.createElement("output");
  result.id = "calendar-test-result";
  const checks = [];
  const require = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  try {
    const count = document.querySelector("#calendar-count");
    const search = document.querySelector("#calendar-search");
    const kind = document.querySelector("#calendar-kind");
    const rows = [...document.querySelectorAll("[data-calendar-row]")];
    const pattern = count?.getAttribute("data-msg-count-events");
    require(count && search && kind && rows.length > 1, "Calendar controls and multiple rows required");
    require(pattern?.includes("{n}"), "Count placeholder required");
    const check = (label, expected) => {
      const shown = rows.filter((row) => !row.hidden);
      require(shown.length === expected.length && shown.every((row) => expected.includes(row)), `${label}: wrong rows`);
      require(count.textContent === pattern.replace("{n}", String(expected.length)), `${label}: stale count ${count.textContent}`);
      for (const group of document.querySelectorAll("[data-calendar-group]")) {
        const groupRows = [...group.querySelectorAll("[data-calendar-row]")];
        require(group.hidden === groupRows.every((row) => row.hidden), `${label}: wrong group visibility`);
      }
      require(!calendarErrors.length, calendarErrors.join("; "));
      checks.push(`${label}:${expected.length}`);
    };
    check("initial", rows.filter((row) => row.dataset.calendarKind === "upcoming"));
    for (const value of ["past", "all", "upcoming"]) {
      kind.value = value;
      kind.dispatchEvent(new Event("change", { bubbles: true }));
      check(value, rows.filter((row) => value === "all" || row.dataset.calendarKind === value));
    }
    search.value = "__calendar_no_match_regression__";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    check("zero", []);
    const uniquePast = rows.find((row) => row.dataset.calendarKind === "past" &&
      rows.filter((other) => other.dataset.calendarSearch.includes(row.dataset.calendarSearch)).length === 1);
    require(uniquePast, "A uniquely searchable past row is required");
    search.value = uniquePast.dataset.calendarSearch;
    search.dispatchEvent(new Event("input", { bubbles: true }));
    check("one-past-despite-upcoming-filter", [uniquePast]);
    search.value = "";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    check("cleared", rows.filter((row) => row.dataset.calendarKind === "upcoming"));
    result.dataset.status = "passed";
    result.textContent = encodeURIComponent(JSON.stringify({ locale: document.documentElement.lang, pattern, checks }));
  } catch (error) {
    result.dataset.status = "failed";
    result.textContent = encodeURIComponent(JSON.stringify({ error: error.message, errors: calendarErrors, checks }));
  }
  document.body.append(result);
});
