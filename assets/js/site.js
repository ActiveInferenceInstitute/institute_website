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

const resourceSearch = document.querySelector("#resource-search");
const resourceType = document.querySelector("#resource-type");
const resourceCategory = document.querySelector("#resource-category");
const resourceAudience = document.querySelector("#resource-audience");
const resourceTag = document.querySelector("#resource-tag");
const resourceCount = document.querySelector("#resource-count");
const resourceCards = [...document.querySelectorAll(".resource-card[data-category]")];
const categoryCounts = [...document.querySelectorAll("[data-category-count]")];

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
  updateCategoryCounts();
}

resourceSearch?.addEventListener("input", updateResourceFilters);
resourceType?.addEventListener("change", updateResourceFilters);
resourceCategory?.addEventListener("change", updateResourceFilters);
resourceAudience?.addEventListener("change", updateResourceFilters);
resourceTag?.addEventListener("change", updateResourceFilters);
updateResourceFilters();
