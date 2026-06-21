import { siteData } from "../data.mjs";
import {
  sanitizePublicProse,
  title_case_token_js,
} from "../lib/text.mjs";
import { resolveInternalHref } from "./urls.mjs";
import { sectionHeading } from "./components.mjs";
import { hrefForSlug } from "../url-taxonomy.mjs";

// Flatten a node meta object (or scalar) into a single readable string, since
// graphs.js renders node.meta via String(node.meta).
export function flattenGraphMeta(meta) {
  if (meta === null || meta === undefined) {
    return undefined;
  }
  if (typeof meta === "string" || typeof meta === "number") {
    return String(meta);
  }
  if (typeof meta === "object") {
    const parts = Object.entries(meta)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${title_case_token_js(k)}: ${v}`);
    return parts.length ? parts.join(" · ") : undefined;
  }
  return undefined;
}

// Project a raw graph dataset (nodes/edges) into the embedded JSON contract:
// node = {id,label,type,href?,meta?}; edge = {source,target,relation}. meta is
// flattened to a string and href is preserved when present.
export function projectGraphData({ nodes = [], edges = [] } = {}, currentDir = "") {
  const projectedNodes = nodes.map((node) => {
    const out = {
      id: node.id,
      label: sanitizePublicProse(node.label ?? node.id),
      type: node.type ?? "node",
    };
    if (node.href) {
      // graphs.js renders node.href as a real anchor relative to the page, so
      // resolve internal references to a caller-relative clean URL here.
      out.href = resolveInternalHref(node.href, currentDir);
    }
    const meta = flattenGraphMeta(node.meta);
    if (meta) {
      out.meta = meta;
    }
    return out;
  });
  const projectedEdges = edges
    .filter((edge) => edge && edge.source && edge.target)
    .map((edge) => ({ source: edge.source, target: edge.target, relation: edge.relation ?? "related" }));
  return { nodes: projectedNodes, edges: projectedEdges };
}

// Emit one graph instance per the GRAPH EMBEDDING CONTRACT: a .graph-figure
// wrapper containing an empty .graph-mount (data-graph-source) plus a data
// island whose textContent is the graph JSON. graphs.js discovers each mount,
// reads document.getElementById(source).textContent, and JSON.parses it (it is
// element-type agnostic — it never requires a <script> holder).
//
// The data island is a hidden, non-executable element rather than a
// <script type="application/json"> tag: the static-security gate
// (scripts/check_static_security.py) rejects ANY <script> without a src that
// carries body text, so a JSON <script> would be (incorrectly) flagged as
// inline script. A hidden element is not a <script>, is never executed, and is
// still only readable as embedded data — fully inside script-src/connect-src
// 'none' (no fetch, build-time data only).
//
// JSON is HTML-escaped so the element's textContent survives HTML parsing
// verbatim: "<" -> < (left as literal text; JSON.parse decodes it), and
// "&" -> &amp; (the HTML parser decodes it back to "&" in textContent).
export function graphFigure(name, rawData, currentDir = "") {
  const id = `graph-data-${name}`;
  const data = projectGraphData(rawData, currentDir);
  const json = JSON.stringify(data).replace(/&/g, "&amp;").replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return `<div class="graph-figure">
    <div class="graph-mount" data-graph-source="${id}"></div>
    <div class="graph-data" id="${id}" hidden>${json}</div>
  </div>`;
}

// Tech-tree explorer: an interactive node-link graph plus a relation legend.
export function techTreeExplorerSection(currentDir = "") {
  const graph = siteData.instituteos.techTreeGraph;
  return `<section class="content-band" id="tech-tree-explorer">
    ${sectionHeading({
      eyebrow: "Tech-tree explorer",
      title: "Explore the Active Inference learning graph",
      text: "An interactive map of concepts, methods, and tools across the Active Inference and Free Energy Principle tech trees. Select a node to highlight its neighbors; filter by relationship type.",
    })}
    ${graphFigure("tech-tree", graph, currentDir)}
    <p class="section-link"><a href="${hrefForSlug("knowledge", currentDir, "ideas-table")}">Open the full idea and ontology tables</a></p>
  </section>`;
}

// Ontology graph view for the knowledge page (companion to the ontology table).
export function ontologyGraphSection(currentDir = "") {
  const graph = siteData.instituteos.ontologyGraph;
  return `<section class="content-band" id="ontology-graph">
    ${sectionHeading({
      eyebrow: "Graph view",
      title: "Ontology relationships as a graph",
      text: "The same public ontology relationships shown in the table below, rendered as an interactive node-link graph. Select a concept to highlight what it connects to.",
    })}
    ${graphFigure("ontology", graph, currentDir)}
    <p class="section-link"><a href="#ontology-table">Jump to the ontology relationship table</a></p>
  </section>`;
}

// Governance network graph for the structure page (entities, policies, processes).
export function governanceGraphSection(currentDir = "") {
  const graph = siteData.instituteos.governanceGraph;
  return `<section class="content-band" id="governance-graph">
    ${sectionHeading({
      eyebrow: "Governance network",
      title: "How entities, policies, and processes connect",
      text: "A public-safe network of governance entities, policies, and processes with their RACI-style relationships. Select a node to trace its accountable, responsible, consulted, and informed links.",
    })}
    ${graphFigure("governance", graph, currentDir)}
    <p class="section-link"><a href="${hrefForSlug("knowledge", currentDir, "policies-table")}">Open the full governance registry tables</a></p>
  </section>`;
}
