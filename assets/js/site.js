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
const resourceCategory = document.querySelector("#resource-category");
const resourceCount = document.querySelector("#resource-count");
const resourceCards = [...document.querySelectorAll(".resource-card[data-category]")];

function updateResourceFilters() {
  if (!resourceCards.length) {
    return;
  }
  const query = (resourceSearch?.value || "").trim().toLowerCase();
  const category = resourceCategory?.value || "";
  let visible = 0;

  for (const card of resourceCards) {
    const matchesQuery = !query || card.dataset.search.includes(query);
    const matchesCategory = !category || card.dataset.category === category;
    const show = matchesQuery && matchesCategory;
    card.hidden = !show;
    if (show) {
      visible += 1;
    }
  }

  if (resourceCount) {
    resourceCount.textContent = `${visible} ${visible === 1 ? "resource" : "resources"} shown`;
  }
}

resourceSearch?.addEventListener("input", updateResourceFilters);
resourceCategory?.addEventListener("change", updateResourceFilters);
updateResourceFilters();
