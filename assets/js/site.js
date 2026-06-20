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

document.addEventListener("click", (event) => {
  if (!event.target.closest(".nav")) {
    closeNavGroups();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeNavGroups();
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
repoSort?.addEventListener("change", sortRepositories);
knowledgeSearch?.addEventListener("input", updateKnowledgeFilters);
knowledgeKind?.addEventListener("change", updateKnowledgeFilters);
updateResourceFilters();
sortRepositories();
updateKnowledgeFilters();
