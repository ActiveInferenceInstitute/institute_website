// Self-hosted, CSP-safe, dependency-free node-link graph renderer.
//
// Contract (must match build.mjs output):
//   <div class="graph-figure">
//     <div class="graph-mount" data-graph-source="graph-data-<NAME>"></div>
//     <script type="application/json" id="graph-data-<NAME>">{"nodes":[...],"edges":[...]}</script>
//   </div>
// node = {id, label, type, href?, meta?}; edge = {source, target, relation}.
//
// No fetch, no external libs, no inline styles, no Math.random. Layout is
// deterministic (seeded). All styling lives in assets/css/graphs.css.

(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const WIDTH = 760;
  const HEIGHT = 480;
  const MARGIN = 48;
  const NODE_R = 9;

  // Deterministic PRNG (mulberry32) seeded from a string — no Math.random.
  function makeRng(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i += 1) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function slug(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function parseData(mount) {
    const sourceId = mount.getAttribute("data-graph-source");
    if (!sourceId) {
      return null;
    }
    const holder = document.getElementById(sourceId);
    if (!holder) {
      return null;
    }
    let parsed;
    try {
      parsed = JSON.parse(holder.textContent || "{}");
    } catch (err) {
      return null;
    }
    const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    const edges = Array.isArray(parsed.edges) ? parsed.edges : [];
    if (nodes.length === 0) {
      return null;
    }
    return { nodes, edges };
  }

  // Deterministic force-directed layout run to a fixed iteration count.
  function computeLayout(nodes, edges, seed) {
    const rng = makeRng(seed);
    const index = new Map();
    const pos = nodes.map((node, i) => {
      index.set(node.id, i);
      // Seed positions on a circle plus a deterministic jitter.
      const angle = (i / nodes.length) * Math.PI * 2;
      const radius = Math.min(WIDTH, HEIGHT) / 2.6;
      return {
        x: WIDTH / 2 + Math.cos(angle) * radius + (rng() - 0.5) * 24,
        y: HEIGHT / 2 + Math.sin(angle) * radius + (rng() - 0.5) * 24,
      };
    });

    const links = [];
    for (const edge of edges) {
      const s = index.get(edge.source);
      const t = index.get(edge.target);
      if (s !== undefined && t !== undefined && s !== t) {
        links.push([s, t]);
      }
    }

    const iterations = 320;
    const k = Math.sqrt((WIDTH * HEIGHT) / Math.max(nodes.length, 1)) * 0.62;
    let temp = WIDTH / 8;
    const cool = temp / (iterations + 1);

    for (let step = 0; step < iterations; step += 1) {
      const disp = pos.map(() => ({ x: 0, y: 0 }));

      // Repulsion between every pair.
      for (let a = 0; a < pos.length; a += 1) {
        for (let b = a + 1; b < pos.length; b += 1) {
          let dx = pos[a].x - pos[b].x;
          let dy = pos[a].y - pos[b].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const force = (k * k) / dist;
          const ux = (dx / dist) * force;
          const uy = (dy / dist) * force;
          disp[a].x += ux;
          disp[a].y += uy;
          disp[b].x -= ux;
          disp[b].y -= uy;
        }
      }

      // Attraction along edges.
      for (const [s, t] of links) {
        const dx = pos[s].x - pos[t].x;
        const dy = pos[s].y - pos[t].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (dist * dist) / k;
        const ux = (dx / dist) * force;
        const uy = (dy / dist) * force;
        disp[s].x -= ux;
        disp[s].y -= uy;
        disp[t].x += ux;
        disp[t].y += uy;
      }

      // Apply displacement capped by temperature, then clamp to bounds.
      for (let i = 0; i < pos.length; i += 1) {
        const d = disp[i];
        const len = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
        pos[i].x += (d.x / len) * Math.min(len, temp);
        pos[i].y += (d.y / len) * Math.min(len, temp);
        pos[i].x = Math.max(MARGIN, Math.min(WIDTH - MARGIN, pos[i].x));
        pos[i].y = Math.max(MARGIN, Math.min(HEIGHT - MARGIN, pos[i].y));
      }
      temp = Math.max(temp - cool, 1);
    }

    return { pos, index };
  }

  function el(name, attrs, parent) {
    const node = document.createElementNS(SVG_NS, name);
    if (attrs) {
      for (const key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) {
          node.setAttribute(key, attrs[key]);
        }
      }
    }
    if (parent) {
      parent.appendChild(node);
    }
    return node;
  }

  function renderGraph(mount, data) {
    const seed = mount.getAttribute("data-graph-source") || "graph";
    const { nodes, edges } = data;
    const { pos, index } = computeLayout(nodes, edges, seed);

    // Stable, type-ordered palette indices for distinct node styling.
    const types = [...new Set(nodes.map((n) => n.type || "default"))];
    const typeClass = new Map();
    types.forEach((t, i) => typeClass.set(t, "graph-type-" + (i % 8)));

    const relations = [...new Set(edges.map((e) => e.relation || "related"))];
    const relationClass = new Map();
    relations.forEach((r, i) => relationClass.set(r, "graph-rel-" + (i % 8)));

    // Neighbor adjacency for highlight on click.
    const neighbors = new Map();
    nodes.forEach((n) => neighbors.set(n.id, new Set()));
    for (const edge of edges) {
      if (neighbors.has(edge.source) && neighbors.has(edge.target)) {
        neighbors.get(edge.source).add(edge.target);
        neighbors.get(edge.target).add(edge.source);
      }
    }

    const figure = mount.closest(".graph-figure") || mount;

    const svg = el("svg", {
      class: "graph-svg",
      viewBox: "0 0 " + WIDTH + " " + HEIGHT,
      preserveAspectRatio: "xMidYMid meet",
      role: "img",
      "aria-label": "Node-link diagram with " + nodes.length + " nodes",
    });

    const edgeLayer = el("g", { class: "graph-edges" }, svg);
    const labelLayer = el("g", { class: "graph-edge-labels" }, svg);
    const nodeLayer = el("g", { class: "graph-nodes" }, svg);

    const edgeEls = [];
    for (const edge of edges) {
      const s = index.get(edge.source);
      const t = index.get(edge.target);
      if (s === undefined || t === undefined) {
        continue;
      }
      const relation = edge.relation || "related";
      const line = el(
        "line",
        {
          class: "graph-edge " + relationClass.get(relation),
          x1: pos[s].x,
          y1: pos[s].y,
          x2: pos[t].x,
          y2: pos[t].y,
          "data-relation": relation,
          "data-source": edge.source,
          "data-target": edge.target,
        },
        edgeLayer,
      );
      const title = el("title", null, line);
      title.textContent = edge.source + " " + relation + " " + edge.target;
      edgeEls.push({ line, relation, source: edge.source, target: edge.target });

      const label = el(
        "text",
        {
          class: "graph-edge-label",
          x: (pos[s].x + pos[t].x) / 2,
          y: (pos[s].y + pos[t].y) / 2,
          "data-relation": relation,
        },
        labelLayer,
      );
      label.textContent = relation;
    }

    const nodeEls = [];
    nodes.forEach((node) => {
      const i = index.get(node.id);
      const type = node.type || "default";
      const group = el(
        "g",
        {
          class: "graph-node " + typeClass.get(type),
          transform: "translate(" + pos[i].x + "," + pos[i].y + ")",
          tabindex: "0",
          role: "button",
          "data-id": node.id,
          "aria-label": (node.label || node.id) + " (" + type + ")",
        },
        nodeLayer,
      );
      el("circle", { class: "graph-node-dot", r: NODE_R }, group);
      const text = el(
        "text",
        { class: "graph-node-label", x: NODE_R + 5, y: 4 },
        group,
      );
      text.textContent = node.label || node.id;
      nodeEls.push({ group, node });
    });

    // Detail panel (built with DOM API, classes only — no inline styles).
    const panel = document.createElement("div");
    panel.className = "graph-panel";
    panel.setAttribute("aria-live", "polite");
    const panelDefault = document.createElement("p");
    panelDefault.className = "graph-panel-empty";
    panelDefault.textContent = "Select a node to see details.";
    panel.appendChild(panelDefault);

    function clearHighlight() {
      figure.removeAttribute("data-active");
      for (const ne of nodeEls) {
        ne.group.classList.remove("is-active", "is-neighbor", "is-dim");
      }
      for (const ee of edgeEls) {
        ee.line.classList.remove("is-active", "is-dim");
      }
    }

    function showDetail(node) {
      panel.textContent = "";
      const heading = document.createElement("h4");
      heading.className = "graph-panel-title";
      heading.textContent = node.label || node.id;
      panel.appendChild(heading);

      const typeTag = document.createElement("span");
      typeTag.className = "graph-panel-type " + typeClass.get(node.type || "default");
      typeTag.textContent = node.type || "default";
      panel.appendChild(typeTag);

      if (node.meta) {
        const meta = document.createElement("p");
        meta.className = "graph-panel-meta";
        meta.textContent = String(node.meta);
        panel.appendChild(meta);
      }
      if (node.href) {
        const link = document.createElement("a");
        link.className = "graph-panel-link";
        link.href = node.href;
        link.textContent = "Open";
        panel.appendChild(link);
      }
    }

    function activate(node) {
      clearHighlight();
      figure.setAttribute("data-active", node.id);
      const nbrs = neighbors.get(node.id) || new Set();
      for (const ne of nodeEls) {
        if (ne.node.id === node.id) {
          ne.group.classList.add("is-active");
        } else if (nbrs.has(ne.node.id)) {
          ne.group.classList.add("is-neighbor");
        } else {
          ne.group.classList.add("is-dim");
        }
      }
      for (const ee of edgeEls) {
        if (ee.source === node.id || ee.target === node.id) {
          ee.line.classList.add("is-active");
        } else {
          ee.line.classList.add("is-dim");
        }
      }
      showDetail(node);
    }

    for (const ne of nodeEls) {
      ne.group.addEventListener("click", () => activate(ne.node));
      ne.group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate(ne.node);
        } else if (event.key === "Escape") {
          clearHighlight();
          panel.textContent = "";
          panel.appendChild(panelDefault);
        }
      });
    }

    // Relation legend that toggles edge visibility per relation type.
    const legend = document.createElement("div");
    legend.className = "graph-legend";
    const hidden = new Set();
    relations.forEach((relation) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "graph-legend-item " + relationClass.get(relation);
      item.setAttribute("aria-pressed", "true");
      const swatch = document.createElement("span");
      swatch.className = "graph-legend-swatch";
      const text = document.createElement("span");
      text.className = "graph-legend-label";
      text.textContent = relation;
      item.appendChild(swatch);
      item.appendChild(text);
      item.addEventListener("click", () => {
        const nowHidden = !hidden.has(relation);
        if (nowHidden) {
          hidden.add(relation);
        } else {
          hidden.delete(relation);
        }
        item.setAttribute("aria-pressed", String(!nowHidden));
        item.classList.toggle("is-off", nowHidden);
        for (const ee of edgeEls) {
          if (ee.relation === relation) {
            ee.line.classList.toggle("is-hidden", nowHidden);
          }
        }
        for (const label of labelLayer.querySelectorAll('[data-relation="' + relation.replace(/"/g, "") + '"]')) {
          label.classList.toggle("is-hidden", nowHidden);
        }
      });
      legend.appendChild(item);
    });

    // Assemble: SVG + side panel in a canvas wrapper, legend below.
    const canvas = document.createElement("div");
    canvas.className = "graph-canvas";
    const svgWrap = document.createElement("div");
    svgWrap.className = "graph-svg-wrap";
    svgWrap.appendChild(svg);
    canvas.appendChild(svgWrap);
    canvas.appendChild(panel);

    mount.textContent = "";
    mount.classList.add("is-rendered");
    mount.appendChild(canvas);
    if (relations.length > 0) {
      mount.appendChild(legend);
    }
  }

  function init() {
    const mounts = document.querySelectorAll(".graph-mount");
    for (const mount of mounts) {
      if (mount.classList.contains("is-rendered")) {
        continue;
      }
      const data = parseData(mount);
      if (!data) {
        // Graceful no-op: leave the mount empty/untouched.
        mount.classList.add("is-empty");
        continue;
      }
      renderGraph(mount, data);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
