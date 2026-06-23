import { urlDirForSlug, hrefForSlug } from "../url-taxonomy.mjs";
import { escapeHtml } from "../lib/text.mjs";
import { sectionHeading } from "../render/components.mjs";
import { layout } from "../render/layout.mjs";

// Interactive simulations index (/simulations/). Emitted programmatically like
// the search/directory/sitemap pages (NOT a curated src/content/pages JSON), so
// it is not subject to the curated-page contract. The simulation pages it links
// to are vendored third-party demos under /simulations/<file>.html, mirrored
// from activeinference.org; that directory is intentionally excluded from the
// first-party site/security/link contracts (see scripts/check_*.py). Card links
// are hand-built to literal files on purpose: routing them through the clean-URL
// resolver would mis-parse filenames like "Ink.html" as page slugs.
const TIERS = [
  {
    id: "beginner",
    label: "Beginner",
    blurb: "Start here. Intuitive, visual entry points into Active Inference and the Free Energy Principle.",
    sims: [
      {
        file: "Ink.html",
        title: "Life Emerges — Living Ink",
        text: "Watch particles self-organise from chaos into a living system by toggling between entropy and free-energy minimization.",
      },
      {
        file: "Apple-Frog.html",
        title: "Apple or Frog? — Perception as Inference",
        text: "See how the brain resolves ambiguous sensory data through Bayesian inference by adjusting beliefs and likelihoods.",
      },
      {
        file: "fep_surprise.html",
        title: "Surprise Minimisation — The Fish Predicts",
        text: "Control the environment while a fish minimizes surprise, demonstrating prediction error and belief updating in real time.",
      },
      {
        file: "school6.html",
        title: "Collective Active Inference — Fish Schooling",
        text: "Multiple fish self-organize into group-level agents, demonstrating Markov blankets and collective behavior.",
      },
    ],
  },
  {
    id: "intermediate",
    label: "Intermediate",
    blurb: "Step through the full inference loop and watch self-organization unfold across agents and structure.",
    sims: [
      {
        file: "fep_tutorial.html",
        title: "From Beliefs to Action — The Complete Loop",
        text: "An eight-step guided tutorial through the complete Active Inference cycle, from generative models to policy selection.",
      },
      {
        file: "self_evidencing_tree.html",
        title: "The Self-Evidencing Tree — Morphogenesis as Inference",
        text: "A tree that grows by minimizing free energy, exploring the explore–exploit trade-off through structural adaptation.",
      },
      {
        file: "ant_colony.html",
        title: "The Colony as Inference — Active InferAnts",
        text: "An ant colony where individuals minimize expected free energy through pheromone communication and niche construction.",
      },
      {
        file: "active_inference_network.html",
        title: "Active Inference Network — Collective Autonomy",
        text: "Scale a complete graph from one agent to 150 and watch Markov blankets and collective autonomy emerge.",
      },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    blurb: "The canonical and hierarchical demonstrations, including precision, expected free energy, and nested blankets.",
    sims: [
      {
        file: "t_maze_fep.html",
        title: "T-Maze — Expected Free Energy",
        text: "The canonical Active Inference demonstration: an agent navigates by balancing information-seeking against reward.",
      },
      {
        file: "hierarchical_blankets.html",
        title: "Hierarchical Markov Blankets",
        text: "Visualize nested Markov blankets from cells to organisms, showing recursive self-organization.",
      },
      {
        file: "dopamine_daniel.html",
        title: "The Dopamine Dial — Neuromodulation as Precision",
        text: "Adjust four neurotransmitter channels in a harvester ant brain to demonstrate precision-weighted behavior control.",
      },
      {
        file: "tree_with_quiz.html",
        title: "Tree Morphology Quiz — Precision, Preferences & Hierarchy",
        text: "An interactive quiz on how branching growth expresses precision, prior preferences, and hierarchical inference.",
      },
    ],
  },
];

function simCard(sim) {
  return `<article class="info-card">
        <h3>${escapeHtml(sim.title)}</h3>
        <p>${escapeHtml(sim.text)}</p>
        <div class="link-chips"><a href="${escapeHtml(sim.file)}"><span>Open simulation</span></a></div>
      </article>`;
}

function tierSection(tier) {
  const cards = tier.sims.map(simCard).join("");
  return `<section class="content-band" id="${escapeHtml(tier.id)}">
    ${sectionHeading({ eyebrow: `${tier.label} level`, title: tier.label, text: tier.blurb })}
    <div class="card-grid">${cards}</div>
  </section>`;
}

export function simulationsPage() {
  const currentDir = urlDirForSlug("simulations");
  const total = TIERS.reduce((sum, tier) => sum + tier.sims.length, 0);
  const tierNav = TIERS.map((tier) => `<a href="#${escapeHtml(tier.id)}">${escapeHtml(tier.label)} (${tier.sims.length})</a>`).join("");
  const body = `
  <section class="page-hero compact">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${hrefForSlug("index", currentDir)}">Home</a><span aria-hidden="true">/</span><span>Simulations</span></nav>
    <p class="eyebrow">Interactive learning</p>
    <h1>Simulations</h1>
    <p>${total} interactive, browser-based simulations of Active Inference and the Free Energy Principle — from particles self-organising into life to agents navigating a T-maze. Each one runs entirely in your browser. Explore them by difficulty, or dive straight in.</p>
    <div class="mini-links">${tierNav}</div>
  </section>
  ${TIERS.map(tierSection).join("\n  ")}
  <section class="content-band muted" id="about-simulations">
    ${sectionHeading({ eyebrow: "About these simulations", title: "Learn by doing" })}
    <p>These demonstrations make abstract Active Inference concepts tangible. They are also published on the Institute's main site at <a href="https://activeinference.org/pages/simulations.html" target="_blank" rel="noopener noreferrer">activeinference.org/pages/simulations.html</a>. To learn the theory behind them, see <a href="${hrefForSlug("active-inference", currentDir)}">Active Inference</a> and the <a href="${hrefForSlug("learning", currentDir)}">Learning and Research</a> resources.</p>
  </section>`;
  return layout({
    title: "Simulations",
    description: `${total} interactive browser-based Active Inference and Free Energy Principle simulations, organized by difficulty.`,
    currentDir,
    body,
    slug: "simulations",
  });
}
