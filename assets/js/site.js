const header = document.querySelector(".site-header");

if (header) {
  window.addEventListener(
    "scroll",
    () => {
      header.toggleAttribute("data-scrolled", window.scrollY > 12);
    },
    { passive: true },
  );
}

const navGroups = [...document.querySelectorAll(".nav-group")];

function closeNavGroups(exceptGroup = null) {
  for (const group of navGroups) {
    if (group === exceptGroup) {
      continue;
    }
    group.removeAttribute("data-open");
    group.querySelector("[data-nav-toggle]")?.setAttribute("aria-expanded", "false");
  }
}

for (const group of navGroups) {
  const button = group.querySelector("[data-nav-toggle]");
  if (!button) {
    continue;
  }
  button.addEventListener("click", () => {
    const nextOpen = !group.hasAttribute("data-open");
    closeNavGroups(group);
    group.toggleAttribute("data-open", nextOpen);
    button.setAttribute("aria-expanded", String(nextOpen));
  });
  // Keep aria-expanded in sync with keyboard focus so it matches the
  // :focus-within CSS that visually opens the menu (otherwise screen-reader
  // users hear "collapsed" while the menu is visibly open).
  group.addEventListener("focusin", () => {
    button.setAttribute("aria-expanded", "true");
  });
  group.addEventListener("focusout", (event) => {
    if (!group.contains(event.relatedTarget)) {
      button.setAttribute("aria-expanded", "false");
    }
  });
}

// Mobile nav disclosure (hamburger). CSP-safe: the listener lives here, the
// collapse styles live in styles.css. Progressive enhancement: data-nav-js is
// stamped only when this script runs — without JS the header never collapses
// and the toggle stays hidden, so the nav remains reachable.
const navToggle = document.querySelector("#nav-toggle");
const siteNav = document.querySelector("#site-nav");

function closeMobileNav() {
  if (header?.hasAttribute("data-nav-open")) {
    header.removeAttribute("data-nav-open");
    navToggle?.setAttribute("aria-expanded", "false");
    return true;
  }
  return false;
}

if (header && navToggle && siteNav) {
  header.setAttribute("data-nav-js", "");
  navToggle.addEventListener("click", () => {
    const open = header.toggleAttribute("data-nav-open");
    navToggle.setAttribute("aria-expanded", String(open));
    if (!open) {
      closeNavGroups();
    }
  });
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".nav")) {
    closeNavGroups();
  }
  // Tapping outside the header also collapses the mobile drawer (but not when
  // the tap is the toggle itself — its own listener owns that transition).
  if (!event.target.closest(".site-header")) {
    closeMobileNav();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeNavGroups();
    // Escape also collapses the mobile drawer and hands focus back to the
    // toggle so keyboard users are not left on a hidden element.
    if (closeMobileNav()) {
      navToggle?.focus();
    }
  }
});

// Back-to-top control for long pages (created client-side; CSP-safe, no inline).
const toTop = document.createElement("button");
toTop.type = "button";
toTop.className = "to-top";
toTop.setAttribute("aria-label", "Back to top");
toTop.textContent = "↑";
toTop.hidden = true;
document.body.appendChild(toTop);
window.addEventListener(
  "scroll",
  () => {
    toTop.hidden = window.scrollY < 600;
  },
  { passive: true },
);
toTop.addEventListener("click", () => {
  // Respect prefers-reduced-motion: the smooth scroll behavior option is not
  // governed by the CSS scroll-behavior rule, so honor the preference here.
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
});

const resourceSearch = document.querySelector("#resource-search");
const resourceType = document.querySelector("#resource-type");
const resourceCategory = document.querySelector("#resource-category");
const resourceAudience = document.querySelector("#resource-audience");
const resourceTag = document.querySelector("#resource-tag");
const resourceCount = document.querySelector("#resource-count");
const resourceCards = [...document.querySelectorAll(".resource-card[data-category]")];
const categoryCounts = [...document.querySelectorAll("[data-category-count]")];
const tagButtons = [...document.querySelectorAll("[data-tag-filter]")];
const repoSort = document.querySelector("#repo-sort");
const repositoryList = document.querySelector("[data-repository-list]");
const knowledgeSearch = document.querySelector("#knowledge-search");
const knowledgeKind = document.querySelector("#knowledge-kind");
const knowledgeCount = document.querySelector("#knowledge-count");
const knowledgeRows = [...document.querySelectorAll("[data-knowledge-row]")];
const knowledgeSectionCounts = [...document.querySelectorAll("[data-knowledge-count]")];

function cardMatchesFilters(card, filters) {
  const tags = (card.dataset.tags || "").split(/\s+/).filter(Boolean);
  const matchesQuery = !filters.query || (card.dataset.search || "").includes(filters.query);
  const matchesType = !filters.type || card.dataset.type === filters.type;
  const matchesCategory = !filters.category || card.dataset.category === filters.category;
  const matchesAudience = !filters.audience || card.dataset.audience === filters.audience;
  const matchesTag = !filters.tag || tags.includes(filters.tag);
  return matchesQuery && matchesType && matchesCategory && matchesAudience && matchesTag;
}

function updateCategoryCounts() {
  for (const count of categoryCounts) {
    const category = count.dataset.categoryCount;
    const visible = resourceCards.filter((card) => card.dataset.category === category && !card.hidden).length;
    count.textContent = `${visible} ${visible === 1 ? "resource" : "resources"} shown in this group`;
  }
}

function syncTagButtons(value = "") {
  for (const button of tagButtons) {
    button.setAttribute("aria-pressed", String((button.dataset.tagFilter || "") === value));
  }
}

function updateResourceFilters() {
  if (!resourceCards.length) {
    return;
  }
  const filters = {
    query: (resourceSearch?.value || "").trim().toLowerCase(),
    type: resourceType?.value || "",
    category: resourceCategory?.value || "",
    audience: resourceAudience?.value || "",
    tag: resourceTag?.value || "",
  };
  let visible = 0;

  for (const card of resourceCards) {
    const show = cardMatchesFilters(card, filters);
    card.hidden = !show;
    if (show) {
      visible += 1;
    }
  }

  if (resourceCount) {
    resourceCount.textContent = `${visible} ${visible === 1 ? "resource" : "resources"} shown`;
  }
  syncTagButtons(filters.tag);
  updateCategoryCounts();
}

function sortRepositories() {
  if (!repositoryList || !repoSort) {
    return;
  }
  const cards = [...repositoryList.querySelectorAll("[data-repo-card]")];
  const mode = repoSort.value;
  cards.sort((a, b) => {
    if (mode === "stars") {
      return Number(b.dataset.repoStars || 0) - Number(a.dataset.repoStars || 0) || a.dataset.repoLabel.localeCompare(b.dataset.repoLabel);
    }
    if (mode === "language") {
      return (a.dataset.repoLanguage || "").localeCompare(b.dataset.repoLanguage || "") || a.dataset.repoLabel.localeCompare(b.dataset.repoLabel);
    }
    if (mode === "category") {
      return (a.dataset.repoCategory || "").localeCompare(b.dataset.repoCategory || "") || a.dataset.repoLabel.localeCompare(b.dataset.repoLabel);
    }
    return (b.dataset.repoUpdated || "").localeCompare(a.dataset.repoUpdated || "") || a.dataset.repoLabel.localeCompare(b.dataset.repoLabel);
  });
  for (const card of cards) {
    repositoryList.append(card);
  }
}

function updateKnowledgeFilters() {
  if (!knowledgeRows.length) {
    return;
  }
  const query = (knowledgeSearch?.value || "").trim().toLowerCase();
  const kind = knowledgeKind?.value || "";
  let visible = 0;

  for (const row of knowledgeRows) {
    const matchesQuery = !query || (row.dataset.knowledgeSearch || "").includes(query);
    const matchesKind = !kind || row.dataset.knowledgeKind === kind;
    const show = matchesQuery && matchesKind;
    row.hidden = !show;
    if (show) {
      visible += 1;
    }
  }

  if (knowledgeCount) {
    knowledgeCount.textContent = `${visible} ${visible === 1 ? "row" : "rows"} shown`;
  }

  for (const count of knowledgeSectionCounts) {
    const section = count.closest("section");
    const sectionRows = [...(section?.querySelectorAll("[data-knowledge-row]") || [])];
    const visibleRows = sectionRows.filter((row) => !row.hidden).length;
    const label = count.dataset.knowledgeCount || "rows";
    const sectionLabel = {
      "people-table": "people",
      "projects-table": "repositories",
      "ideas-table": "ideas",
      "ontology-table": "relationships",
      "research-table": "research links",
    }[label] || "rows";
    count.textContent = `${visibleRows} ${sectionLabel} shown`;
  }
}

resourceSearch?.addEventListener("input", updateResourceFilters);
resourceType?.addEventListener("change", updateResourceFilters);
resourceCategory?.addEventListener("change", updateResourceFilters);
resourceAudience?.addEventListener("change", updateResourceFilters);
resourceTag?.addEventListener("change", () => {
  syncTagButtons(resourceTag.value);
  updateResourceFilters();
});
for (const button of tagButtons) {
  button.addEventListener("click", () => {
    if (resourceTag) {
      resourceTag.value = button.dataset.tagFilter || "";
    }
    updateResourceFilters();
  });
}
const calendarSearch = document.querySelector("#calendar-search");
const calendarKind = document.querySelector("#calendar-kind");
const calendarCount = document.querySelector("#calendar-count");
const calendarRows = [...document.querySelectorAll("[data-calendar-row]")];

function updateCalendarFilters() {
  if (!calendarRows.length) {
    return;
  }
  const query = (calendarSearch?.value || "").trim().toLowerCase();
  const kind = calendarKind?.value || "upcoming";
  let visible = 0;

  for (const row of calendarRows) {
    const matchesQuery = !query || (row.dataset.calendarSearch || "").includes(query);
    // A non-empty query searches across every event; an empty query respects the
    // kind selector (default: upcoming) so the page opens clean, not 277 rows.
    const matchesKind = query ? true : kind === "all" || row.dataset.calendarKind === kind;
    const show = matchesQuery && matchesKind;
    row.hidden = !show;
    if (show) {
      visible += 1;
    }
  }

  // Hide a whole group (heading + list) once every row inside it is filtered out,
  // so choosing "Past" cannot leave an "upcoming events" heading over nothing.
  for (const group of document.querySelectorAll("[data-calendar-group]")) {
    const rows = [...group.querySelectorAll("[data-calendar-row]")];
    group.hidden = rows.length > 0 && rows.every((row) => row.hidden);
  }

  if (calendarCount) {
    const scope = query ? "match" : kind === "all" ? "event" : `${kind} event`;
    calendarCount.textContent = `${visible} ${scope}${visible === 1 ? "" : "s"} shown`;
  }
}

repoSort?.addEventListener("change", sortRepositories);
knowledgeSearch?.addEventListener("input", updateKnowledgeFilters);
knowledgeKind?.addEventListener("change", updateKnowledgeFilters);
calendarSearch?.addEventListener("input", updateCalendarFilters);
calendarKind?.addEventListener("change", updateCalendarFilters);
updateResourceFilters();
sortRepositories();
updateKnowledgeFilters();
updateCalendarFilters();

// Activities page — filter the searchable "active projects" table.
const activitiesProjectSearch = document.querySelector("#activities-project-search");
const activitiesProjectRows = [...document.querySelectorAll("[data-activity-row]")];
const activitiesProjectCount = document.querySelector("#activities-project-count");
if (activitiesProjectSearch && activitiesProjectRows.length) {
  const applyActivitiesProjectFilter = () => {
    const query = (activitiesProjectSearch.value || "").trim().toLowerCase();
    let shown = 0;
    for (const row of activitiesProjectRows) {
      const match = !query || (row.dataset.search || "").includes(query);
      row.hidden = !match;
      if (match) {
        shown += 1;
      }
    }
    if (activitiesProjectCount) {
      activitiesProjectCount.textContent = `${shown} project${shown === 1 ? "" : "s"} shown`;
    }
  };
  activitiesProjectSearch.addEventListener("input", applyActivitiesProjectFilter);
  applyActivitiesProjectFilter();
}

// Projects page — the catalog is two totally separate tables, one per
// canonical affiliation (Institute-hosted, Ecosystem), each split again into
// Active and Archived & completed. Every section owns its search box, topic
// filter, per-table counts, empty states, and total; filtering one section never
// touches the other's rows or numbers.
const catalogSections = ["catalog-institute", "catalog-ecosystem"]
  .map((anchor) => ({
    anchor,
    search: document.querySelector(`#${anchor}-search`),
    topic: document.querySelector(`#${anchor}-topic`),
    total: document.querySelector(`#${anchor}-count`),
    tables: ["active", "archived"]
      .map((status) => ({
        body: document.querySelector(`#${anchor}-${status}-body`),
        wrap: document.querySelector(`#${anchor}-${status}-table`)?.closest(".table-wrap") || null,
        count: document.querySelector(`#${anchor}-${status}-count`),
        empty: document.querySelector(`#${anchor}-${status}-empty`),
      }))
      .filter((table) => table.body),
  }))
  .filter((section) => section.tables.length);
for (const section of catalogSections) {
  const pluralize = (n) => `${n} project${n === 1 ? "" : "s"}`;
  const applyCatalogFilter = () => {
    const query = (section.search?.value || "").trim().toLowerCase();
    const topic = section.topic?.value || "";
    let shown = 0;
    for (const table of section.tables) {
      let tableShown = 0;
      for (const row of table.body.querySelectorAll("[data-catalog-row]")) {
        const matchesQuery = !query || (row.dataset.search || "").includes(query);
        const matchesTopic = !topic || ` ${row.dataset.topics || ""} `.includes(` ${topic} `);
        const match = matchesQuery && matchesTopic;
        row.hidden = !match;
        if (match) tableShown += 1;
      }
      shown += tableShown;
      if (table.count) table.count.textContent = pluralize(tableShown);
      if (table.empty) table.empty.hidden = tableShown !== 0;
      if (table.wrap) table.wrap.hidden = tableShown === 0;
    }
    // Only speak when a filter is actually narrowing something; at rest the
    // section's own static count already states the total, and repeating it
    // here just prints the same number twice.
    if (section.total) section.total.textContent = query || topic ? `${pluralize(shown)} shown` : "";
  };
  section.search?.addEventListener("input", applyCatalogFilter);
  section.topic?.addEventListener("change", applyCatalogFilter);
  applyCatalogFilter();
}
