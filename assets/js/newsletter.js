(function () {
  "use strict";

  const controls = document.getElementById("newsletter-controls");
  if (!controls) return;
  const search = document.getElementById("newsletter-search");
  const year = document.getElementById("newsletter-year");
  const type = document.getElementById("newsletter-type");
  const count = document.getElementById("newsletter-count");
  const empty = document.getElementById("newsletter-empty");
  const reset = document.getElementById("newsletter-reset");
  const normalize = value => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const cards = [...document.querySelectorAll("[data-newsletter-card]")].map(element => ({ element, text: normalize(element.dataset.search) }));
  const sections = [...document.querySelectorAll("[data-newsletter-section]")];
  const numberFormat = new Intl.NumberFormat(document.documentElement.lang);

  function restore() {
    const params = new URL(location.href).searchParams;
    search.value = (params.get("q") || "").slice(0, search.maxLength);
    for (const [key, select] of [["year", year], ["type", type]]) {
      const value = params.get(key) || "";
      select.value = [...select.options].some(option => option.value === value) ? value : "";
    }
  }

  function update(writeUrl) {
    const words = normalize(search.value.trim()).split(/\s+/u).filter(Boolean);
    let visible = 0;
    for (const { element, text } of cards) {
      const show = (!year.value || element.dataset.year === year.value) &&
        (!type.value || element.dataset.type === type.value) && words.every(word => text.includes(word));
      element.hidden = !show;
      visible += Number(show);
    }
    for (const section of sections) section.hidden = !section.querySelector("[data-newsletter-card]:not([hidden])");
    count.textContent = count.dataset.countTemplate.replace("{n}", numberFormat.format(visible));
    empty.hidden = visible !== 0;
    if (writeUrl) {
      const url = new URL(location.href);
      for (const [key, value] of [["q", search.value.trim()], ["year", year.value], ["type", type.value]]) {
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
      }
      history.replaceState(null, "", url);
    }
  }

  search.addEventListener("input", () => update(true));
  year.addEventListener("change", () => update(true));
  type.addEventListener("change", () => update(true));
  reset.addEventListener("click", () => {
    search.value = "";
    year.value = "";
    type.value = "";
    update(true);
    search.focus();
  });
  addEventListener("popstate", () => { restore(); update(false); });
  restore();
  update(false);
  controls.hidden = false;
})();
