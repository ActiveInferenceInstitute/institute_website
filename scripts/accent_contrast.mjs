// Executed inside the real browser by the interaction check.
export async function measureAccentContrast() {
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll("[data-accent]")];
  const selected = buttons.find(button => button.getAttribute("aria-pressed") === "true");
  if (!selected) throw new Error("The accent picker has no selected value");
  const wasLight = root.classList.contains("theme-light");
  const transitions = [...document.querySelectorAll("*")].map(element => [element, element.style.getPropertyValue("transition"), element.style.getPropertyPriority("transition")]);
  for (const [element] of transitions) element.style.setProperty("transition", "none", "important");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d");
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  function pixel(color) {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  }
  function over(foreground, background) {
    const alpha = foreground[3] / 255;
    return foreground.slice(0, 3).map((value, index) => value * alpha + background[index] * (1 - alpha));
  }
  function background(element) {
    const layers = [];
    for (let parent = element; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.backgroundImage !== "none") throw new Error("Contrast measurement requires a solid background");
      const color = pixel(style.backgroundColor);
      layers.push(color);
      if (color[3] === 255) break;
    }
    return layers.reverse().reduce((result, layer) => over(layer, result), [255, 255, 255]);
  }
  function luminance(rgb) {
    return rgb.map(value => {
      value /= 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  }
  const rows = [];
  try {
    for (const light of [false, true]) {
      root.classList.toggle("theme-light", light);
      for (const button of buttons) {
        button.click();
        await frame();
        for (const selector of [".content-band .eyebrow", ".hero .button.primary", ".info-card a"]) {
          const element = document.querySelector(selector);
          if (!element) throw new Error("Missing contrast target: " + selector);
          const style = getComputedStyle(element);
          if (Number(style.opacity) !== 1) throw new Error("Opacity requires compositor sampling");
          let bg = background(element);
          let fg = over(pixel(style.color), bg);
          if (style.filter !== "none") {
            const brightness = style.filter.match(/^brightness\(([\d.]+)\)$/);
            if (!brightness) throw new Error("Unsupported contrast filter: " + style.filter);
            const scale = values => values.map(value => Math.min(255, value * Number(brightness[1])));
            bg = scale(bg);
            fg = scale(fg);
          }
          const a = luminance(fg), b = luminance(bg);
          rows.push({ theme: light ? "light" : "dark", accent: button.dataset.accent, selector, foreground: fg, background: bg, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) });
        }
      }
    }
    return rows;
  } finally {
    selected.click();
    root.classList.toggle("theme-light", wasLight);
    for (const [element, value, priority] of transitions) {
      if (value) element.style.setProperty("transition", value, priority);
      else element.style.removeProperty("transition");
    }
    await frame();
  }
}
