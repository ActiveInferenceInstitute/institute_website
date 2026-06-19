/**
 * Generates all project and unit JSON pages for the website.
 * Run: node scripts/generate-project-pages.mjs
 * All files are written to src/content/pages/.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const PAGES = join(__dir, "../src/content/pages");
mkdirSync(PAGES, { recursive: true });

// Resource groups drive which registered repositories and official pages surface
// on a page: build.mjs::recordMatchesPage renders a resource when its category is
// in the page's resourceGroups (cards are capped at 8 per section and only render
// resources already registered in live-sources.json — no new/fabricated links).
// "projects" is always included because it matches both a registered repository
// and an official page, guaranteeing the #repositories and #official-pages
// sections render cards; the rest are added from the page's evident domain.
const VALID_RESOURCE_GROUPS = new Set([
  "community", "institute", "learning", "media", "participation",
  "projects", "research", "social", "support", "tools",
]);

function resourceGroupsFor(slug, data) {
  const signal = [slug, ...(data.relatedSlugs || []), ...(data.externalSourceIds || []), data.audience || ""]
    .join(" ")
    .toLowerCase();
  const groups = new Set(["projects"]);
  if (/research|active-inference|model|science|paper|ontology|theory|cognitive/.test(signal)) groups.add("research");
  if (/learn|education|course|textbook|edactive|mentor|fellow|curriculum/.test(signal)) groups.add("learning");
  if (/repo-|tool|software|implementation|library|\bcode\b|engine/.test(signal)) groups.add("tools");
  return [...groups].filter((group) => VALID_RESOURCE_GROUPS.has(group)).slice(0, 3);
}

// Maintainer-facing taxonomy: page JSONs live in subfolders for navigability,
// but the slug stays the identity and the built output URL is always FLAT
// (<slug>.html at the site root). Project pages go to projects/; the two
// organizational units (edactive, reinference) are program pages.
function subfolderFor(slug) {
  if (slug === "edactive" || slug === "reinference") {
    return "programs";
  }
  if (slug.startsWith("project-")) {
    return "projects";
  }
  return "";
}

function write(slug, data) {
  const page = { slug, ...data };
  if (!page.resourceGroups) {
    page.resourceGroups = resourceGroupsFor(slug, data);
  }
  const dir = join(PAGES, subfolderFor(slug));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${slug}.json`), JSON.stringify(page, null, 2) + "\n");
  console.log(`  wrote ${slug}.json`);
}

// ── Unit pages ──────────────────────────────────────────────────────────────

write("edactive", {
  title: "EduActive Unit",
  subtitle: "The Active Inference Institute's education-focused organizational unit.",
  audience: "Learners, educators, course developers, textbook contributors, and anyone interested in Active Inference education.",
  lede: "EduActive is the Institute's education arm. It hosts the Textbook Group, courses, ontology work, the Active Inference Journal, audio-visual production, seasonal school, and related learning initiatives. EduActive projects connect Active Inference to learning infrastructure, pedagogy, and public educational resources.",
  primaryActions: [
    { label: "Textbook Group", sourceId: "official-textbook-group-shortlink" },
    { label: "All Projects", href: "projects.html" }
  ],
  sections: [
    {
      heading: "What EduActive Does",
      body: "EduActive provides the educational infrastructure for the Institute and Ecosystem. Its projects develop and maintain courses, textbooks, ontologies, journals, audio-visual resources, and learning groups. EduActive makes Active Inference accessible across disciplines and experience levels by creating structured, reusable, and openly licensed educational artifacts.",
      links: [{ sourceId: "official-courses" }, { sourceId: "official-education" }]
    },
    {
      heading: "Institute Projects",
      body: "EduActive hosts Institute-operated educational projects with sustained maintenance, regular outputs, and defined participation pathways. These include the Textbook Group, Active Inference Ontology, Active Inference Journal, Educational Course Development, Audio-Visual Production, Applied Active Inference Symposium, Seasonal School, Physics Course, Active Inference for Social Sciences, and the Video Improvement project.",
      links: [
        { label: "Textbook Group", href: "project-textbook-group.html" },
        { label: "Active Inference Ontology", href: "project-active-inference-ontology.html" },
        { label: "Active Inference Journal", href: "project-active-inference-journal.html" },
        { label: "Applied Active Inference Symposium", href: "project-symposium.html" },
        { label: "Seasonal School", href: "project-seasonal-school.html" },
        { label: "Educational Course Development", href: "project-educational-course-development.html" }
      ]
    },
    {
      heading: "Ecosystem Projects",
      body: "EduActive supports Ecosystem projects aligned with education, learning, and public knowledge. These include Action Research on Collective Foraging, the Active Inference Cycle Book, MathArt Conversations, Neurodivergent Learning Sessions, Numinia, Froebel's System, and others.",
      links: [
        { label: "MathArt Conversations", href: "project-mathart.html" },
        { label: "Neurodivergent Learning Sessions", href: "project-neurodivergent-learning.html" },
        { label: "Numinia", href: "project-numinia.html" }
      ]
    },
    {
      heading: "Participate in EduActive",
      body: "EduActive projects welcome learners, developers, writers, instructors, artists, and organizers at all stages. Join a Textbook Group cohort, contribute to ontology work, help produce audio-visual content, or join an ecosystem education project. No prior expertise is required.",
      links: [{ sourceId: "discord" }, { label: "Programs", href: "programs.html" }, { label: "Volunteer", href: "volunteer.html" }]
    }
  ],
  cards: [
    { title: "Textbook Group", text: "Structured cohort learning through foundational and advanced Active Inference texts.", links: [{ sourceId: "official-textbook-group-shortlink" }] },
    { title: "Active Inference Journal", text: "Knowledge, discussion, and community publication channel.", links: [{ sourceId: "journal" }] },
    { title: "Active Inference Ontology", text: "Maintaining the public ontology for decentralized science.", links: [{ sourceId: "shortlink-ontology" }] },
    { title: "Applied Symposium", text: "Annual symposium bringing researchers and practitioners together.", links: [{ sourceId: "official-symposium-shortlink" }] }
  ],
  order: 18,
  relatedSlugs: ["reinference", "projects", "structure", "programs", "learning"],
  externalSourceIds: ["official-education", "official-courses", "github-org", "discord"]
});

write("reinference", {
  title: "ReInference Unit",
  subtitle: "The Active Inference Institute's research-focused organizational unit.",
  audience: "Researchers, modelers, engineers, and contributors building Active Inference software, tools, and scientific knowledge.",
  lede: "ReInference is the Institute's research and development arm. It hosts software projects, theoretical work, applied modeling, geospatial analysis, knowledge engineering, and interdisciplinary research under the Active Inference framework. ReInference projects range from widely-used open-source tools to specialized research initiatives.",
  primaryActions: [
    { label: "GitHub", sourceId: "github-org" },
    { label: "All Projects", href: "projects.html" }
  ],
  sections: [
    {
      heading: "What ReInference Does",
      body: "ReInference develops and maintains research infrastructure, software tools, and scientific knowledge for Active Inference. Its institute projects have active development pipelines, open repositories, and regular community touchpoints. ReInference connects theoretical advances in Active Inference with concrete implementations, datasets, and application domains.",
      links: [{ sourceId: "github-org" }, { sourceId: "official-research" }]
    },
    {
      heading: "Institute Projects",
      body: "ReInference hosts 12 Institute-operated projects: Active Blockference, AICACP, the Applied Active Inference Symposium, Cognitive Agent Modeling, FarmWorks, Generalized Notation Notation (GNN), GEO-INFER, a Graphical Interface project, Knowledge Engineering, Multiagent Modeling (Active InferAnts), the RxInfer.jl learning group, and the Theoretical Neurobiology Group.",
      links: [
        { label: "Active InferAnts", href: "project-active-inferants.html" },
        { label: "GEO-INFER", href: "project-geo-infer.html" },
        { label: "GNN", href: "project-gnn.html" },
        { label: "RxInfer.jl", href: "project-rxinfer.html" },
        { label: "Knowledge Engineering", href: "project-knowledge-engineering.html" },
        { label: "Active Blockference", href: "project-active-blockference.html" }
      ]
    },
    {
      heading: "Ecosystem Projects",
      body: "ReInference supports Ecosystem projects in theoretical neuroscience, computational modeling, AI applications, and specialized domains. These include CogNarr, the Geometric Inquiry Theory, Symbolic Cognitive Robotics, Model-Centric Cognition, and over a dozen other community-driven research projects.",
      links: [
        { label: "CogNarr", href: "project-cognarn.html" },
        { label: "Geometric Inquiry Theory", href: "project-geometric-inquiry.html" },
        { sourceId: "ecosystem" }
      ]
    },
    {
      heading: "Participate in ReInference",
      body: "ReInference projects welcome researchers, engineers, students, and domain experts. Contributing can mean writing code, modeling, running experiments, producing documentation, or engaging in research discussions. Most projects are open to new participants.",
      links: [{ sourceId: "github-org" }, { sourceId: "discord" }, { label: "Programs", href: "programs.html" }]
    }
  ],
  cards: [
    { title: "Active InferAnts", text: "Multiagent modeling with prior code, papers, and development in Active Blockference.", links: [{ sourceId: "active-inferants" }] },
    { title: "GEO-INFER", text: "Geospatial modeling using Active Inference techniques.", links: [{ sourceId: "geo-infer" }] },
    { title: "GNN", text: "Generalized Notation Notation for communicating generative models.", links: [{ sourceId: "gnn" }] },
    { title: "RxInfer.jl", text: "Learning and development around the RxInfer.jl probabilistic programming system.", links: [{ sourceId: "shortlink-rxinfer" }] }
  ],
  order: 19,
  relatedSlugs: ["edactive", "projects", "structure", "active-inference", "learning"],
  externalSourceIds: ["github-org", "official-activeinference-org", "discord"]
});

// ── ReInference Institute Projects ──────────────────────────────────────────

write("project-active-blockference", {
  title: "Active Blockference",
  subtitle: "Applying Active Inference examples and tooling in blockchain-adjacent and decentralized systems contexts.",
  audience: "Developers, researchers, and modelers interested in Active Inference for decentralized and blockchain-adjacent applications.",
  lede: "Active Blockference develops Active Inference examples and tools applicable to decentralized and blockchain-adjacent systems. The project has produced a GitHub repository, blog posts, and video overviews, and serves as an integration point for multiagent modeling work from Active InferAnts.",
  primaryActions: [
    { label: "Repository", sourceId: "repo-activeblockference" },
    { label: "ReInference Unit", href: "reinference.html" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "Active Blockference explores how Active Inference can be applied to decentralized environments — systems where agents interact without centralized coordination. The project develops modeling examples, implementations, and resources showing how generative models and free energy minimization apply in blockchain and distributed system contexts.",
      links: [{ sourceId: "repo-activeblockference" }, { sourceId: "official-active-blockference" }]
    },
    {
      heading: "Past Work and Resources",
      body: "Active Blockference has produced a GitHub repository with implementations and examples, blog posts describing the conceptual framing, and video overviews from project meetings. The Active InferAnts multiagent work is developed partly within Active Blockference.",
      links: [{ sourceId: "repo-activeblockference" }, { sourceId: "active-inferants" }]
    },
    {
      heading: "How to Participate",
      body: "Participants can contribute through code, modeling, writing, or discussion. Engagement happens through the GitHub repository and project meetings in the Institute community. Background in Active Inference or distributed systems is helpful but not required.",
      links: [{ sourceId: "discord" }, { label: "ReInference Unit", href: "reinference.html" }]
    }
  ],
  order: 20,
  relatedSlugs: ["reinference", "projects", "project-active-inferants", "active-inference"],
  externalSourceIds: ["repo-activeblockference", "official-active-blockference", "active-inferants", "discord"]
});

write("project-aicacp", {
  title: "AICACP",
  subtitle: "A coalition-oriented project at the intersection of AI capabilities and care practices.",
  audience: "Researchers, practitioners, and policy-oriented contributors interested in AI alignment, capabilities, and care-oriented approaches.",
  lede: "AICACP is an Institute project organized around AI capabilities, alignment, and care practices — exploring how Active Inference principles inform responsible and care-oriented AI development. The project maintains a public information page and contributes to the Institute's research on beneficial AI.",
  primaryActions: [
    { label: "Project page", sourceId: "official-participation" },
    { label: "ReInference Unit", href: "reinference.html" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "AICACP addresses the alignment and care dimensions of advanced AI capabilities. Using Active Inference as a theoretical lens, the project examines how AI systems can be designed with attention to care, alignment, and human flourishing. The work connects theoretical frameworks with practical guidance for building AI that serves broad human interests.",
      links: [{ sourceId: "github-org" }]
    },
    {
      heading: "Participation",
      body: "AICACP welcomes contributors with backgrounds in AI, ethics, policy, philosophy of mind, and Active Inference. Engagement ranges from theoretical discussion to practical documentation and policy writing.",
      links: [{ sourceId: "discord" }, { label: "ReInference Unit", href: "reinference.html" }]
    }
  ],
  order: 21,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["github-org", "discord", "official-participation"]
});

write("project-symposium", {
  title: "Applied Active Inference Symposium",
  subtitle: "An annual gathering of Active Inference researchers, practitioners, and contributors from around the world.",
  audience: "Researchers, practitioners, speakers, sponsors, and participants interested in the annual Symposium.",
  lede: "The Applied Active Inference Symposium is a yearly event that convenes the global Active Inference community. It has run five times from 2021 through 2025, with the sixth symposium in 2026. The Symposium features research presentations, discussions, and collaborative sessions spanning computational neuroscience, AI, ecology, economics, health, and other domains.",
  primaryActions: [
    { label: "Symposium page", sourceId: "official-symposium-page" },
    { label: "Symposium shortlink", sourceId: "official-symposium-shortlink" }
  ],
  sections: [
    {
      heading: "About the Symposium",
      body: "The Applied Active Inference Symposium is the Institute's flagship annual event. It brings together researchers, educators, practitioners, and community members who are applying Active Inference across scientific and practical domains. The event features talks, panels, workshops, and community sessions, with full recordings made publicly available after each edition.",
      links: [{ sourceId: "official-symposium-page" }, { sourceId: "repo-symposium" }]
    },
    {
      heading: "Past Symposia",
      body: "Five symposia have been held from 2021 through 2025. Each edition has expanded the scope and participation of the community. Recordings, materials, and proceedings from prior symposia are accessible through the official page and the YouTube channel.",
      links: [{ sourceId: "youtube" }, { sourceId: "official-symposium-shortlink" }]
    },
    {
      heading: "Present and Future",
      body: "The 6th Applied Active Inference Symposium takes place in 2026. The Symposium is a joint project between the EduActive and ReInference units, reflecting its role at the intersection of education, research, and community building.",
      links: [{ sourceId: "official-symposium-shortlink" }, { label: "EduActive", href: "edactive.html" }, { label: "ReInference", href: "reinference.html" }]
    },
    {
      heading: "Participate",
      body: "The Symposium is open to researchers, practitioners, students, and curious community members. Presenters, session organizers, sponsors, and volunteers are welcome. Reach out through the official Symposium page or contact blanket@activeinference.institute.",
      links: [{ sourceId: "official-symposium-page" }, { sourceId: "official-partnership" }]
    }
  ],
  cards: [
    { title: "2021–2025 editions", text: "Five prior symposia with publicly available recordings and proceedings.", links: [{ sourceId: "youtube" }] },
    { title: "2026 symposium", text: "The 6th Applied Active Inference Symposium.", links: [{ sourceId: "official-symposium-shortlink" }] },
    { title: "Sponsor or present", text: "Opportunities for speakers, sponsors, and volunteers.", links: [{ sourceId: "official-symposium-page" }] }
  ],
  order: 22,
  relatedSlugs: ["edactive", "reinference", "projects", "fellowship", "partnership"],
  externalSourceIds: ["official-symposium-page", "official-symposium-shortlink", "repo-symposium", "youtube", "official-partnership"]
});

write("project-cognitive-agent-modeling", {
  title: "Cognitive Agent Modeling",
  subtitle: "Developing minimal cognitive agent models using Active Inference principles.",
  audience: "Researchers and modelers interested in computational cognitive modeling and Active Inference implementations.",
  lede: "Cognitive Agent Modeling is a ReInference Institute project focused on developing minimal cognitive agent models grounded in Active Inference. The work explores how perception, action, and learning can be formalized and implemented using the Active Inference framework.",
  primaryActions: [
    { label: "GitHub", sourceId: "github-org" },
    { label: "ReInference Unit", href: "reinference.html" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "The Cognitive Agent Modeling project builds computational models of cognitive agents using Active Inference as the theoretical foundation. Work includes model design, implementation, and evaluation across different agent environments and task contexts. The project contributes to the broader Institute effort to make Active Inference implementations accessible and well-documented.",
      links: [{ sourceId: "github-org" }, { sourceId: "repo-activeinferenceimplementations" }]
    },
    {
      heading: "Participate",
      body: "Contributors with backgrounds in computational neuroscience, cognitive science, machine learning, or software engineering are welcome. Engagement ranges from implementation and testing to theoretical discussion and documentation.",
      links: [{ sourceId: "discord" }, { label: "ReInference Unit", href: "reinference.html" }]
    }
  ],
  order: 23,
  relatedSlugs: ["reinference", "projects", "active-inference", "project-active-inferants"],
  externalSourceIds: ["github-org", "repo-activeinferenceimplementations", "discord"]
});

write("project-farmworks", {
  title: "FarmWorks",
  subtitle: "Applied Active Inference modeling for agriculture, soil biology, and ecological systems.",
  audience: "Researchers, ecologists, and practitioners working on agricultural systems, soil biology, and applied ecology.",
  lede: "FarmWorks develops miniature Active Inference models and applications for agricultural and ecological contexts. The project has produced a public FarmWorks page and a 2024 publication describing the approach of treating farm and soil systems as active inference agents.",
  primaryActions: [
    { label: "GitHub", sourceId: "github-org" },
    { label: "ReInference Unit", href: "reinference.html" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "FarmWorks applies Active Inference concepts to agricultural systems — treating farms, soil ecosystems, and crop cycles as generative models that sense and act in their environments. The project develops mini-projects, models, and publications demonstrating how Active Inference illuminates ecological decision-making and farm management.",
      links: [{ sourceId: "github-org" }]
    },
    {
      heading: "Publications and Past Work",
      body: "The project produced a 2024 publication and maintains a FarmWorks overview page describing the theoretical grounding and practical applications. Work includes model prototypes and documentation for soil and agricultural Active Inference.",
      links: [{ sourceId: "github-org" }]
    },
    {
      heading: "Participate",
      body: "FarmWorks welcomes ecologists, agricultural scientists, modelers, and anyone interested in applying Active Inference to biological and ecological systems.",
      links: [{ sourceId: "discord" }, { label: "ReInference Unit", href: "reinference.html" }]
    }
  ],
  order: 24,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["github-org", "discord"]
});

write("project-gnn", {
  title: "Generalized Notation Notation",
  subtitle: "A text-based notation system for communicating generative models and Active Inference systems.",
  audience: "Modelers, researchers, and developers working with generative models and wanting interoperable notation.",
  lede: "Generalized Notation Notation (GNN) is a text-based notation project for communicating and specifying generative models. It provides a shared language for describing Active Inference and related models in a way that is both human-readable and machine-processable, enabling interoperability across tools and codebases.",
  primaryActions: [
    { label: "GNN repository", sourceId: "gnn" },
    { label: "Repo", sourceId: "repo-gnn" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "GNN defines a notation system for generative models used in Active Inference and related frameworks. By standardizing how models are described, GNN enables clearer communication between researchers, easier translation between implementations, and more robust tooling around model specification and analysis.",
      links: [{ sourceId: "gnn" }, { sourceId: "repo-gnn" }, { sourceId: "repo-generalizednotationnotation" }]
    },
    {
      heading: "Status and Resources",
      body: "GNN has an active repository and has been used across several Institute projects. Documentation and examples are available through the repository.",
      links: [{ sourceId: "repo-gnn" }, { sourceId: "github-org" }]
    },
    {
      heading: "Participate",
      body: "Contributions include specification work, tooling development, documentation, and applying GNN to new modeling domains. Background in formal modeling or Active Inference is helpful.",
      links: [{ sourceId: "discord" }, { label: "ReInference Unit", href: "reinference.html" }]
    }
  ],
  order: 25,
  relatedSlugs: ["reinference", "projects", "project-knowledge-engineering", "active-inference"],
  externalSourceIds: ["gnn", "repo-gnn", "repo-generalizednotationnotation", "github-org", "discord"]
});

write("project-geo-infer", {
  title: "GEO-INFER",
  subtitle: "Geospatial modeling using Active Inference and spatial data analysis techniques.",
  audience: "Geospatial researchers, data scientists, and modelers interested in spatial Active Inference applications.",
  lede: "GEO-INFER develops geospatial modeling methods grounded in Active Inference. The project integrates spatial data analysis with the Active Inference framework, opening applications in ecology, urban planning, resource management, and other domains where geographic context matters.",
  primaryActions: [
    { label: "GEO-INFER", sourceId: "geo-infer" },
    { label: "Repository", sourceId: "repo-geo-infer" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "GEO-INFER combines geospatial analysis methods — including raster data, spatial statistics, and geographic information systems — with Active Inference principles. The project explores how agents operating in spatially structured environments can be modeled and understood through the free energy framework.",
      links: [{ sourceId: "geo-infer" }, { sourceId: "repo-geo-infer" }]
    },
    {
      heading: "Repository and Resources",
      body: "GEO-INFER maintains an active GitHub repository with implementations, examples, and documentation. The project is connected to broader Active Inference implementation work in the Institute.",
      links: [{ sourceId: "repo-geo-infer" }, { sourceId: "github-org" }]
    },
    {
      heading: "Participate",
      body: "Contributors with backgrounds in geography, ecology, environmental science, spatial data analysis, or Active Inference modeling are welcome.",
      links: [{ sourceId: "discord" }, { label: "ReInference Unit", href: "reinference.html" }]
    }
  ],
  order: 26,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["geo-infer", "repo-geo-infer", "github-org", "discord"]
});

write("project-graphical-interface", {
  title: "Graphical Interface",
  subtitle: "A graphical interface project for Active Inference modeling and visualization.",
  audience: "Developers, designers, and modelers working on user interfaces for Active Inference tools.",
  lede: "The Graphical Interface project develops visual and interactive tools for working with Active Inference models. It focuses on making model structure, dynamics, and outputs more accessible through well-designed graphical interfaces and visualization layers.",
  primaryActions: [
    { label: "GitHub", sourceId: "github-org" },
    { label: "ReInference Unit", href: "reinference.html" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "The Graphical Interface project creates user-facing tools for exploring, building, and visualizing Active Inference models. Good visual interfaces lower the barrier to entry for working with generative models and make model structure more interpretable to practitioners and researchers.",
      links: [{ sourceId: "github-org" }]
    },
    {
      heading: "Participate",
      body: "Contributors with interests in UI/UX design, visualization, front-end development, or Active Inference modeling are welcome.",
      links: [{ sourceId: "discord" }, { label: "ReInference Unit", href: "reinference.html" }]
    }
  ],
  order: 27,
  relatedSlugs: ["reinference", "projects", "project-rxinfer-visualization", "active-inference"],
  externalSourceIds: ["github-org", "discord"]
});

write("project-knowledge-engineering", {
  title: "Knowledge Engineering",
  subtitle: "Building the Active Inference Institute's knowledge infrastructure, public frontend, and literature meta-analysis.",
  audience: "Knowledge engineers, information scientists, researchers, and contributors working on structured knowledge resources.",
  lede: "Knowledge Engineering develops and maintains the public knowledge infrastructure for the Active Inference Institute, including the public frontend, literature meta-analysis, and organizational knowledge systems. The project connects Institute outputs to the broader literature and makes them machine-readable and navigable.",
  primaryActions: [
    { label: "Official page", sourceId: "official-knowledge-engineering" },
    { label: "Repository", sourceId: "repo-knowledge-engineering" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "Knowledge Engineering builds and maintains the structured knowledge layer of the Institute. This includes the public-facing knowledge frontend, systematic literature meta-analysis for Active Inference research, organizational knowledge graphs, and tools for navigating the growing body of Active Inference work.",
      links: [{ sourceId: "official-knowledge-engineering" }, { sourceId: "repo-knowledge-engineering" }]
    },
    {
      heading: "Past Work",
      body: "The project has produced a public frontend and literature meta-analysis accessible from the end of 2022. The work supports the Institute's mission of making Active Inference knowledge findable, reusable, and cumulative.",
      links: [{ sourceId: "repo-knowledge-engineering" }, { sourceId: "github-org" }]
    },
    {
      heading: "Participate",
      body: "Contributors with backgrounds in knowledge representation, information science, ontology, natural language processing, or library science are welcome alongside Active Inference researchers.",
      links: [{ sourceId: "discord" }, { label: "ReInference Unit", href: "reinference.html" } ]
    }
  ],
  order: 28,
  relatedSlugs: ["reinference", "projects", "project-active-inference-ontology", "project-gnn"],
  externalSourceIds: ["official-knowledge-engineering", "repo-knowledge-engineering", "github-org", "discord"]
});

write("project-active-inferants", {
  title: "Active InferAnts",
  subtitle: "Multiagent modeling of collective behavior using Active Inference, with connections to ant colony research.",
  audience: "Researchers, modelers, and engineers interested in multiagent systems, collective behavior, and Active Inference.",
  lede: "Active InferAnts is a multiagent modeling project that applies Active Inference to collective behavior, inspired by ant colony dynamics. It has produced a GitHub repository, a 2021 paper, and code developed within the Active Blockference project, with multiple realizations across different modeling contexts.",
  primaryActions: [
    { label: "Active InferAnts", sourceId: "active-inferants" },
    { label: "Repository", sourceId: "repo-activeinferants" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "Active InferAnts develops multiagent models using Active Inference to simulate and understand collective behavior. The project draws inspiration from social insect biology — particularly ant colony foraging and organization — and applies generative modeling to understand how local agent behaviors produce collective intelligence without central coordination.",
      links: [{ sourceId: "active-inferants" }, { sourceId: "repo-activeinferants" }]
    },
    {
      heading: "Past Work and Papers",
      body: "The project has a 2021 paper, a GitHub repository with multiple code realizations, and is developed in part through the Active Blockference project. The work spans individual agent models, collective foraging scenarios, and theoretical extensions.",
      links: [{ sourceId: "active-inferants" }, { sourceId: "repo-ants" }]
    },
    {
      heading: "Participate",
      body: "Contributors with backgrounds in computational biology, multiagent systems, Active Inference, or behavioral ecology are welcome. Technical contributions (code, models) and conceptual work (theory, documentation) are both valued.",
      links: [{ sourceId: "discord" }, { label: "ReInference Unit", href: "reinference.html" }]
    }
  ],
  order: 29,
  relatedSlugs: ["reinference", "projects", "project-active-blockference", "active-inference"],
  externalSourceIds: ["active-inferants", "repo-activeinferants", "repo-ants", "discord"]
});

write("project-rxinfer", {
  title: "RxInfer.jl Learning and Development Group",
  subtitle: "Learning, applying, and extending the RxInfer.jl reactive message-passing inference system.",
  audience: "Julia programmers, probabilistic modelers, and Active Inference practitioners working with RxInfer.jl.",
  lede: "The RxInfer.jl Learning and Development Group supports learning and extending RxInfer.jl, a Julia package for reactive Bayesian inference. The group produces learning resources, code examples, and contributes to the broader development of RxInfer as a platform for Active Inference.",
  primaryActions: [
    { label: "RxInfer shortlink", sourceId: "shortlink-rxinfer" },
    { label: "Official page", sourceId: "official-rxinfer" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "RxInfer.jl is a reactive message-passing probabilistic programming system developed externally and adopted by the Institute as a key platform for Active Inference implementations. The Institute's learning group focuses on understanding, applying, and extending RxInfer across Active Inference use cases — building examples, documentation, and learning pathways for community members.",
      links: [{ sourceId: "shortlink-rxinfer" }, { sourceId: "official-rxinfer" }, { sourceId: "repo-actinf-rxinfer" }]
    },
    {
      heading: "Resources",
      body: "The group maintains a project overview, learning sessions, and code in the Institute repository. Active sessions appear in the Institute's activities calendar.",
      links: [{ sourceId: "official-rxinfer" }, { sourceId: "repo-actinf-rxinfer" }, { sourceId: "official-activities-shortlink" }]
    },
    {
      heading: "Participate",
      body: "Participants can join learning sessions, contribute examples, or help improve RxInfer's visualization capabilities. Julia programming experience is helpful but structured learning sessions accommodate all levels.",
      links: [{ sourceId: "discord" }, { label: "ReInference Unit", href: "reinference.html" }]
    }
  ],
  order: 30,
  relatedSlugs: ["reinference", "projects", "project-rxinfer-visualization", "active-inference"],
  externalSourceIds: ["shortlink-rxinfer", "official-rxinfer", "repo-actinf-rxinfer", "official-activities-shortlink", "discord"]
});

write("project-theoretical-neurobiology", {
  title: "Theoretical Neurobiology Group",
  subtitle: "Supporting theoretical neurobiology conversations and model development within the Active Inference community.",
  audience: "Neuroscientists, biologists, and theoreticians interested in theoretical approaches to neural systems through Active Inference.",
  lede: "The Theoretical Neurobiology Group (TNB) supports theoretical work connecting Active Inference to neurobiology. It hosts regular meetings and discussions for participants working on mathematical and conceptual models of neural systems, bridging the free energy principle with empirical neuroscience.",
  primaryActions: [
    { label: "TNB page", sourceId: "official-tnb" },
    { label: "ReInference Unit", href: "reinference.html" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "The Theoretical Neurobiology Group convenes researchers and learners interested in applying Active Inference and the free energy principle to neurobiology. Sessions cover topics from predictive coding to interoception, allostasis, neural circuits, and the mathematical structure of active inference in biological systems.",
      links: [{ sourceId: "official-tnb" }]
    },
    {
      heading: "Activities",
      body: "The group holds regular meetings, reading sessions, and collaborative discussions. Recordings and resources from past sessions are accessible through the Institute's channels.",
      links: [{ sourceId: "official-tnb" }, { sourceId: "youtube" }]
    },
    {
      heading: "Participate",
      body: "Background in neuroscience, biology, or Active Inference is helpful. The group welcomes students, researchers, and anyone engaging seriously with theoretical neurobiology.",
      links: [{ sourceId: "discord" }, { label: "ReInference Unit", href: "reinference.html" }]
    }
  ],
  order: 31,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["official-tnb", "youtube", "discord"]
});

// ── EduActive Institute Projects ────────────────────────────────────────────

write("project-active-inference-social-sciences", {
  title: "Active Inference for Social Sciences",
  subtitle: "Developing Active Inference curricula and research for social science disciplines.",
  audience: "Social scientists, educators, and researchers connecting Active Inference to social science theory and practice.",
  lede: "Active Inference for Social Sciences develops courses, curricula, research, and writing connecting Active Inference to the social sciences. The project produced a 2023 course and continues to build educational and research resources for social scientists engaging with the Active Inference framework.",
  primaryActions: [
    { label: "Courses", sourceId: "official-courses" },
    { label: "EduActive Unit", href: "edactive.html" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "This project adapts Active Inference for social science audiences — developing conceptual translations, course materials, and research directions. It recognizes that Active Inference's account of agency, communication, and social interaction has deep implications for sociology, political science, economics, anthropology, and related fields.",
      links: [{ sourceId: "official-courses" }]
    },
    {
      heading: "Past Work",
      body: "A 2023 course — 'Active Inference for the Social Sciences' — was produced and is accessible through the Institute's course infrastructure. The project continues to generate writing, research, and curriculum.",
      links: [{ sourceId: "official-courses" }, { sourceId: "repo-courses" }]
    },
    {
      heading: "Participate",
      body: "Social scientists, educators, and interdisciplinary researchers interested in connecting Active Inference to their domains are welcome to contribute.",
      links: [{ sourceId: "discord" }, { label: "EduActive Unit", href: "edactive.html" }]
    }
  ],
  order: 32,
  relatedSlugs: ["edactive", "projects", "project-educational-course-development", "active-inference"],
  externalSourceIds: ["official-courses", "repo-courses", "discord"]
});

write("project-active-inference-journal", {
  title: "Active Inference Journal",
  subtitle: "A community publication and knowledge channel for Active Inference research and discussion.",
  audience: "Researchers, writers, and knowledge contributors producing and consuming Active Inference publications.",
  lede: "The Active Inference Journal is an Institute publication and community knowledge channel. It supports the development and dissemination of Active Inference research, discussion, and learning through volunteer-led editorial work and open publishing.",
  primaryActions: [
    { label: "Journal", sourceId: "journal" },
    { label: "Repository", sourceId: "repo-activeinferencejournal" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "The Active Inference Journal develops and publishes Active Inference knowledge through community editorial work. The journal is volunteer-led and open, creating a venue for research, analysis, and discussion that supplements traditional academic publishing.",
      links: [{ sourceId: "journal" }, { sourceId: "repo-activeinferencejournal" }]
    },
    {
      heading: "Participate",
      body: "Contribute as a writer, editor, or reviewer. Volunteers help curate, review, and produce journal content across the full range of Active Inference research and application.",
      links: [{ sourceId: "journal" }, { sourceId: "discord" }]
    }
  ],
  order: 33,
  relatedSlugs: ["edactive", "projects", "project-active-inference-ontology"],
  externalSourceIds: ["journal", "repo-activeinferencejournal", "discord"]
});

write("project-active-inference-ontology", {
  title: "Active Inference Ontology",
  subtitle: "Maintaining and developing the public ontology for Active Inference and decentralized science.",
  audience: "Ontologists, knowledge engineers, and researchers working on formal knowledge representation for Active Inference.",
  lede: "The Active Inference Ontology project maintains and extends the public ontology for the Active Inference framework. It provides structured, machine-readable definitions of concepts and their relationships, supporting decentralized science, reproducibility, and knowledge reuse.",
  primaryActions: [
    { label: "Ontology shortlink", sourceId: "shortlink-ontology" },
    { label: "Repository", sourceId: "repo-active-inference-ontology" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "The Active Inference Ontology formalizes the conceptual structure of Active Inference — defining terms, relationships, and hierarchies that enable consistent reasoning, cross-project compatibility, and machine-readable knowledge. The ontology supports the broader goal of open, decentralized Active Inference science.",
      links: [{ sourceId: "shortlink-ontology" }, { sourceId: "repo-active-inference-ontology" }]
    },
    {
      heading: "Resources",
      body: "The public ontology website and GitHub repository provide access to the current ontology, its documentation, and contribution pathways.",
      links: [{ sourceId: "repo-active-inference-ontology" }, { sourceId: "github-org" }]
    },
    {
      heading: "Participate",
      body: "Ontologists, knowledge engineers, and researchers who work with formal knowledge representation are welcome to contribute. Background in description logics, RDF/OWL, or conceptual modeling is helpful.",
      links: [{ sourceId: "discord" }, { label: "EduActive Unit", href: "edactive.html" }]
    }
  ],
  order: 34,
  relatedSlugs: ["edactive", "projects", "project-knowledge-engineering", "active-inference"],
  externalSourceIds: ["shortlink-ontology", "repo-active-inference-ontology", "github-org", "discord"]
});

write("project-audio-visual-production", {
  title: "Audio-Visual Production",
  subtitle: "Producing livestreams, podcasts, recordings, and audio-visual resources for the Active Inference community.",
  audience: "Producers, coordinators, technical contributors, and anyone interested in supporting Institute media.",
  lede: "Audio-Visual Production is a sustained Institute project responsible for planning, recording, and publishing the Institute's livestreams, podcasts, video events, and educational recordings. The project has produced a continuously updated table of all livestreams and videos from 2020 onward.",
  primaryActions: [
    { label: "Videos", sourceId: "video" },
    { label: "YouTube", sourceId: "youtube" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "The Audio-Visual Production project manages the full production pipeline for Institute media — from planning and guest curation through live recording, post-production, and publication. It produces the pragmatic video catalog for all Institute outputs, including ModelStreams, GuestStreams, project meetings, courses, and special events.",
      links: [{ sourceId: "video" }, { sourceId: "youtube" }, { sourceId: "official-livestreams" }]
    },
    {
      heading: "Past and Current Work",
      body: "A comprehensive table of all livestreams and videos from 2020 to the present is maintained by this project. The Institute has produced hundreds of hours of openly accessible recordings covering Active Inference theory, applications, project updates, and community discussions.",
      links: [{ sourceId: "youtube" }, { sourceId: "official-livestreams" }]
    },
    {
      heading: "How to Help",
      body: "The project welcomes producers, coordinators, technical contributors, and guest curators. If you enjoy the videos and want to help expand and improve production, reach out via blanket@activeinference.institute with subject [PRODUCTION].",
      links: [{ sourceId: "discord" }, { label: "Volunteer", href: "volunteer.html" }]
    }
  ],
  order: 35,
  relatedSlugs: ["edactive", "projects", "volunteer", "programs"],
  externalSourceIds: ["video", "youtube", "official-livestreams", "discord"]
});

write("project-educational-course-development", {
  title: "Educational Course Development",
  subtitle: "Developing structured Active Inference courses, curricula, and educational resources.",
  audience: "Educators, curriculum designers, instructors, and learners interested in formal Active Inference course work.",
  lede: "Educational Course Development is a sustained Institute project producing structured courses in Active Inference and related topics. It maintains an Obsidian repository and course catalog, developing educational materials for a range of backgrounds and learning goals.",
  primaryActions: [
    { label: "Courses", sourceId: "official-courses" },
    { label: "Repository", sourceId: "repo-courses" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "The Educational Course Development project designs and produces courses for Active Inference learners. This includes introductory and advanced courses, domain-specific curricula, and modular educational components that can be used across the Institute's learning programs.",
      links: [{ sourceId: "official-courses" }, { sourceId: "repo-courses" }]
    },
    {
      heading: "Resources",
      body: "Courses are accessible through the Institute's course page and Obsidian repository. Materials are openly licensed and designed for reuse.",
      links: [{ sourceId: "official-courses" }, { sourceId: "shortlink-obsidian" }]
    },
    {
      heading: "Participate",
      body: "Educators, instructional designers, subject matter experts, and learners interested in contributing to course development are welcome.",
      links: [{ sourceId: "discord" }, { label: "EduActive Unit", href: "edactive.html" }]
    }
  ],
  order: 36,
  relatedSlugs: ["edactive", "projects", "project-textbook-group", "project-seasonal-school", "learning"],
  externalSourceIds: ["official-courses", "repo-courses", "shortlink-obsidian", "discord"]
});

write("project-physics-course", {
  title: "Physics Course",
  subtitle: "A course connecting physics, thermodynamics, and the theoretical foundations of Active Inference.",
  audience: "Physics-oriented learners and researchers exploring the physical basis of the Free Energy Principle.",
  lede: "The Physics Course is an Institute education project developing course materials on the physical foundations of Active Inference and the Free Energy Principle — covering thermodynamics, information theory, and the physics underlying biological self-organization.",
  primaryActions: [
    { label: "Courses", sourceId: "official-courses" },
    { label: "EduActive Unit", href: "edactive.html" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "The Physics Course explores Active Inference from a physics perspective, covering how thermodynamics, information theory, and statistical mechanics underpin the Free Energy Principle. It develops course materials connecting these foundations to biological and cognitive systems.",
      links: [{ sourceId: "official-courses" }]
    },
    {
      heading: "Participate",
      body: "Physicists, mathematicians, and quantitatively-oriented learners interested in the theoretical foundations of Active Inference are welcome.",
      links: [{ sourceId: "discord" }, { label: "EduActive Unit", href: "edactive.html" }]
    }
  ],
  order: 37,
  relatedSlugs: ["edactive", "projects", "project-educational-course-development", "active-inference"],
  externalSourceIds: ["official-courses", "discord"]
});

write("project-seasonal-school", {
  title: "Seasonal School",
  subtitle: "An intensive in-person or online school for deep engagement with Active Inference.",
  audience: "Students, researchers, and practitioners seeking an immersive Active Inference learning experience.",
  lede: "The Seasonal School is an Institute educational program providing intensive, structured, and in-depth engagement with Active Inference theory, modeling, and applications. It has run multiple cohorts and developed a track record as a concentrated learning experience for participants from varied backgrounds.",
  primaryActions: [
    { label: "Seasonal School page", sourceId: "official-education" },
    { label: "EduActive Unit", href: "edactive.html" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "The Seasonal School delivers concentrated Active Inference education through structured sessions over days or weeks. It combines lectures, workshops, modeling practice, and discussion — creating a learning environment that accelerates understanding for participants at multiple levels of prior background.",
      links: [{ sourceId: "official-education" }]
    },
    {
      heading: "Past Editions",
      body: "The Seasonal School has run several cohorts, each producing recordings and resources for the broader community. Past recordings are accessible through the Institute's video channels.",
      links: [{ sourceId: "youtube" }, { sourceId: "official-livestreams" }]
    },
    {
      heading: "Participate",
      body: "The Seasonal School accepts applications from students, researchers, and practitioners. Follow the Institute's communications for upcoming editions.",
      links: [{ sourceId: "official-newsletter" }, { sourceId: "discord" }]
    }
  ],
  order: 38,
  relatedSlugs: ["edactive", "projects", "project-educational-course-development", "project-textbook-group", "programs"],
  externalSourceIds: ["official-education", "youtube", "official-livestreams", "official-newsletter", "discord"]
});

write("project-textbook-group", {
  title: "Textbook Group",
  subtitle: "Structured cohort learning through Active Inference textbooks, with 5.5 completed cohorts since 2022.",
  audience: "Learners, students, and researchers working through Active Inference textbooks in a structured group setting.",
  lede: "The Textbook Group is a sustained Institute educational program running structured cohort-based learning through Active Inference textbooks. Since 2022 it has completed 5.5 cohorts, including the current 'Fundamentals of Active Inference: Principles, Algorithms, and Applications of the Free Energy Principle for Engineers' cohort.",
  primaryActions: [
    { label: "Textbook Group", sourceId: "official-textbook-group-shortlink" },
    { label: "Register", sourceId: "official-textbook-group" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "The Textbook Group brings participants together in structured cohorts to work through Active Inference textbooks with guidance and peer support. Each cohort runs regular sessions with discussion, exercises, and collaborative work through key texts.",
      links: [{ sourceId: "official-textbook-group-shortlink" }, { sourceId: "official-textbook-group" }]
    },
    {
      heading: "Current and Past Cohorts",
      body: "The Textbook Group has completed 5.5 cohorts since 2022. The current cohort is working through 'Fundamentals of Active Inference: Principles, Algorithms, and Applications of the Free Energy Principle for Engineers.' Recordings and materials from prior cohorts are accessible through the repository and course pages.",
      links: [{ sourceId: "official-textbook-group" }, { sourceId: "repo-parr-et-al-2022-actinf-textbook" }, { sourceId: "repo-fundamentals" }]
    },
    {
      heading: "Participate",
      body: "Register for upcoming cohorts through the Textbook Group page. No prior expertise in Active Inference is required — the group provides structure for participants at all levels.",
      links: [{ sourceId: "official-textbook-group-shortlink" }, { sourceId: "discord" }]
    }
  ],
  cards: [
    { title: "5.5 cohorts since 2022", text: "Structured learning through core Active Inference texts.", links: [{ sourceId: "official-textbook-group" }] },
    { title: "Current cohort", text: "Fundamentals of Active Inference: Principles, Algorithms, and Applications.", links: [{ sourceId: "official-textbook-group-shortlink" }] },
    { title: "Open enrollment", text: "Register for the next cohort.", links: [{ sourceId: "official-textbook-group-shortlink" }] }
  ],
  order: 39,
  relatedSlugs: ["edactive", "projects", "project-educational-course-development", "project-seasonal-school", "learning"],
  externalSourceIds: ["official-textbook-group-shortlink", "official-textbook-group", "repo-parr-et-al-2022-actinf-textbook", "repo-fundamentals", "discord"]
});

write("project-video-improvement", {
  title: "Video Improvement Project",
  subtitle: "Improving the quality, accessibility, and discoverability of Active Inference Institute video content.",
  audience: "Media contributors, editors, and community members working to improve the Institute's video catalog.",
  lede: "The Video Improvement Project focuses on enhancing the quality, organization, and accessibility of the Institute's extensive video library — covering hundreds of livestreams, educational sessions, and project recordings from 2020 onward.",
  primaryActions: [
    { label: "YouTube", sourceId: "youtube" },
    { label: "EduActive Unit", href: "edactive.html" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "The Video Improvement Project works to improve the Institute's video content along multiple dimensions: production quality, metadata and discoverability, accessibility features (captions, transcripts), and organization of the video catalog. The Institute has produced hundreds of hours of content since 2020.",
      links: [{ sourceId: "youtube" }, { sourceId: "video" }]
    },
    {
      heading: "Participate",
      body: "Editors, producers, metadata specialists, and media organizers are welcome. Even small contributions — improving descriptions, adding timestamps, or reviewing captions — make a meaningful difference.",
      links: [{ sourceId: "discord" }, { label: "Audio-Visual Production", href: "project-audio-visual-production.html" }]
    }
  ],
  order: 40,
  relatedSlugs: ["edactive", "projects", "project-audio-visual-production"],
  externalSourceIds: ["youtube", "video", "discord"]
});

// ── ReInference Ecosystem Projects ──────────────────────────────────────────

write("project-belief-updating-ptsd", {
  title: "Active Inference Account of Belief Updating in PTSD",
  subtitle: "Developing a theoretical Active Inference account of belief updating processes in post-traumatic stress disorder.",
  audience: "Clinical researchers, neuroscientists, and practitioners interested in computational psychiatry and Active Inference.",
  lede: "This Ecosystem project develops a formal Active Inference account of belief updating in PTSD. It applies predictive processing and free energy frameworks to model how traumatic experience disrupts normal belief updating, offering a principled theoretical basis for understanding and potentially treating PTSD.",
  primaryActions: [{ label: "GitHub", sourceId: "github-org" }, { label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project writes theory and develops models showing how Active Inference principles illuminate the belief updating processes disrupted in PTSD. This computational psychiatry approach connects formal neuroscience with clinical relevance.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Researchers in clinical neuroscience, psychiatry, and computational modeling are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 41,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["github-org", "ecosystem", "discord"]
});

write("project-translation-agent", {
  title: "Active Inference Agent for Modeling Human Translation",
  subtitle: "Modeling human translation processes using Active Inference agent architectures.",
  audience: "Cognitive scientists, linguists, and AI researchers interested in computational models of translation.",
  lede: "This Ecosystem project develops an Active Inference agent model of human translation processes. It applies the free energy framework to the cognitive and linguistic tasks involved in translating between languages, producing models of human translation behavior.",
  primaryActions: [{ label: "GitHub", sourceId: "github-org" }, { label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "Using Active Inference as a modeling framework, the project models translation as an inference problem — where the translator minimizes prediction error about target language representations given source language inputs. Work includes theoretical development and agent implementations.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Linguists, cognitive scientists, and NLP researchers interested in Active Inference models are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 42,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["github-org", "ecosystem", "discord"]
});

write("project-anima", {
  title: "Anima",
  subtitle: "Exploring Active Inference in the context of current LLM-based AI interactions and policy-based behavior.",
  audience: "AI researchers and practitioners interested in Active Inference approaches to LLM behavior and alignment.",
  lede: "Anima is an Ecosystem project exploring how Active Inference principles apply to interactions with large language models. It examines how policy-based, blanket-aware Active Inference architectures can inform the design and understanding of current AI systems.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "Anima investigates the intersection of Active Inference and current LLM-based AI — examining how Active Inference models of perception, policy, and action relate to LLM behavior, and how the framework can guide AI design for coherent, aligned behavior.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "AI researchers, cognitive scientists, and practitioners interested in Active Inference approaches to AI systems are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 43,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-artificial-sentience", {
  title: "Artificial Sentience",
  subtitle: "Exploring the conditions for and implications of sentience in artificial systems through an Active Inference lens.",
  audience: "Philosophers, AI researchers, and consciousness scientists interested in machine sentience and phenomenology.",
  lede: "Artificial Sentience is an Ecosystem project examining the theoretical conditions for sentience in artificial systems. Drawing on Active Inference, it explores what it would mean for a machine to be sentient, using the free energy principle as a framework for understanding experience and self-organization.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project develops theoretical accounts of sentience using Active Inference — examining whether and how the formal properties of active inference systems relate to phenomenal experience. It connects philosophy of mind, computational neuroscience, and AI research.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Philosophers, neuroscientists, and AI researchers interested in consciousness and Active Inference are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 44,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-clinical-waveform", {
  title: "Clinical Waveform Data Based Agent",
  subtitle: "Developing Active Inference agents for bedside clinical waveform data analysis and real-time decision support.",
  audience: "Clinical researchers, biomedical engineers, and healthcare AI practitioners.",
  lede: "Clinical Waveform Data Based Agent develops Active Inference systems for bedside clinical monitoring. It applies the free energy framework to real-time waveform data — EEG, ECG, and other physiological signals — to support clinical decision-making.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project develops Active Inference agent architectures for processing and interpreting clinical waveform data in real time. The goal is to create principled, uncertainty-aware models that can assist clinicians at the bedside by continuously updating belief states from physiological sensor streams.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Clinical researchers, biomedical engineers, and AI practitioners with healthcare interests are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 45,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-cognarn", {
  title: "CogNarr Ecosystem",
  subtitle: "Facilitating group cognition at scale through cognitive narrative infrastructure.",
  audience: "Researchers, practitioners, and developers interested in collective intelligence, group cognition, and narrative infrastructure.",
  lede: "CogNarr (Cognitive Narrative) is an Ecosystem project developing infrastructure for facilitating group cognition at scale. It builds tools and frameworks that enable communities to coordinate shared understanding through structured narrative and cognitive scaffolding, with an initial focus on minimal viable incubation.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "CogNarr develops infrastructure for collective sense-making — creating shared cognitive scaffolds that help groups coordinate attention, update beliefs, and maintain coherent action. The initial mission is a minimal viable incubation platform that can serve as a coordination layer for community cognition.",
      links: [{ sourceId: "ecosystem" }]
    },
    {
      heading: "Meetings and Activity",
      body: "CogNarr holds regular project meetings visible in the Institute's activities calendar. The project has an active community on the Discord.",
      links: [{ sourceId: "official-activities-shortlink" }, { sourceId: "discord" }]
    },
    { heading: "Participate", body: "Developers, researchers, and practitioners interested in group cognition and narrative infrastructure are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 46,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "official-activities-shortlink", "discord"]
});

write("project-brain-metabolism", {
  title: "Energy Modeling Human Brain Metabolism",
  subtitle: "Applying Active Inference to model metabolic energy dynamics in the human brain.",
  audience: "Neuroscientists, biophysicists, and researchers studying brain metabolism and the Free Energy Principle.",
  lede: "Energy Modeling Human Brain Metabolism applies Active Inference and the Free Energy Principle to model metabolic processes in the human brain. The project develops quantitative models of how the brain manages energy resources as an inference problem.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The brain is the body's most metabolically expensive organ. This project models how it manages energy — framing metabolic regulation as an active inference process where the brain predicts and minimizes surprises about its own metabolic state. The work connects neuroscience, physiology, and the Free Energy Principle.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Neuroscientists, biophysicists, and modelers with interests in brain metabolism and Active Inference are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 47,
  relatedSlugs: ["reinference", "projects", "active-inference", "project-theoretical-neurobiology"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-robotic-microscopy", {
  title: "From Instrument to Intelligent Agent: Robotic Microscopy",
  subtitle: "Deploying Active Inference and AI to automate robotic microscopy and manage soil biology at scale.",
  audience: "Robotics researchers, biologists, and AI practitioners interested in autonomous scientific instrumentation.",
  lede: "This Ecosystem project turns a robotic microscope into an Active Inference-driven intelligent agent for managing soil biology at scale. It develops AI systems that autonomously operate microscopy hardware, acquire data, and make decisions — treating the instrument as an inference agent in a biological environment.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project develops Active Inference architectures for autonomous robotic microscopy — creating systems that observe, plan, and act in order to characterize biological samples with minimal human intervention. The application domain is soil biology, supporting FarmWorks-adjacent ecological research.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Roboticists, biologists, and AI engineers interested in autonomous instrumentation are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 48,
  relatedSlugs: ["reinference", "projects", "project-farmworks", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-geometric-inquiry", {
  title: "Geometric Inquiry Theory",
  subtitle: "Establishing geometric bases for inquiry through Q-State Dynamics and the structural basis of inquiry.",
  audience: "Mathematicians, physicists, and theoreticians working on the geometric and formal foundations of inquiry and cognition.",
  lede: "Geometric Inquiry Theory develops a geometric framework for understanding inquiry as a structured dynamic process — establishing Q-State Dynamics and the structural basis of inquiry as a coherent mathematical theory, drawing on a multi-decade background spanning paramedicine, network engineering, and culinary arts as informal laboratories.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project establishes geometric and algebraic foundations for inquiry — treating the act of asking questions as a structured, consequence-laden process with formal properties. Q-State Dynamics provides the theoretical core, with protocols documenting the empirical and epistemological basis of the work.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Mathematicians, physicists, and formally-oriented theoreticians interested in the foundations of inquiry are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 49,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-graphspeak", {
  title: "Graphspeak / Blorbbe",
  subtitle: "Popularizing open-source graph-based communication and knowledge representation tools.",
  audience: "Knowledge workers, developers, and communities interested in graph-based communication and open knowledge tools.",
  lede: "Graphspeak / Blorbbe is an Ecosystem project developing open-source tools for graph-based communication and knowledge representation, aiming to make structured, relational knowledge more accessible and usable for broad audiences.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project develops graph-based communication tools — enabling people to express ideas, relationships, and knowledge in structured, visual, and interoperable formats. The work connects to Active Inference through shared interests in generative model-based communication.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Developers, knowledge workers, and communication researchers interested in graph-based tools are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 50,
  relatedSlugs: ["reinference", "projects", "project-gnn"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-humanitys-story", {
  title: "Humanity's Story of an Uncertain Self",
  subtitle: "Producing an account of human self-understanding through the lens of Active Inference and free energy.",
  audience: "Philosophers, cognitive scientists, humanists, and anyone interested in the intersection of science and human narrative.",
  lede: "Humanity's Story of an Uncertain Self is an Ecosystem project developing a broad account of human self-knowledge as an inference problem. Drawing on Active Inference, it examines how humans construct and maintain stories about themselves as agents in an uncertain world.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project produces an integrated account of human self-understanding from the perspective of Active Inference — combining philosophical analysis, cognitive science, and narrative theory to examine how agents model themselves and generate coherent self-narratives under uncertainty.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Philosophers, cognitive scientists, humanists, and narrative researchers are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 51,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-rxinfer-visualization", {
  title: "Improving RxInfer.jl Model Visualization",
  subtitle: "Developing visualization capabilities for RxInfer.jl probabilistic models.",
  audience: "Julia developers, probabilistic modelers, and visualization specialists working with RxInfer.jl.",
  lede: "This Ecosystem project improves the model visualization capabilities of RxInfer.jl — developing tools that make it easier to see, explore, and understand the structure and dynamics of generative models built with the RxInfer system.",
  primaryActions: [{ label: "GitHub", sourceId: "github-org" }, { label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "Good visualization tools make probabilistic models more interpretable and accessible. This project develops visualization infrastructure for RxInfer.jl, contributing to a growing ecosystem of tooling around the system. Work includes graph rendering, inference visualization, and interactive exploration interfaces.",
      links: [{ sourceId: "github-org" }, { sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Julia programmers, visualization specialists, and Active Inference practitioners are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 52,
  relatedSlugs: ["reinference", "projects", "project-rxinfer", "project-graphical-interface"],
  externalSourceIds: ["github-org", "ecosystem", "discord"]
});

write("project-m-theory-hdpls", {
  title: "M-Theory as Function of Hyper Dimensional Prismatic Light Scattering (HDPLS-TARS)",
  subtitle: "Testing the limits of M-Theory through hyper-dimensional field interconnections and active inference.",
  audience: "Theoretical physicists and mathematicians working at the frontiers of M-Theory and information geometry.",
  lede: "HDPLS-TARS is a speculative and exploratory Ecosystem project testing the limits and foundations of M-Theory through the lens of hyper-dimensional field interconnections. It examines new functional and experiential insights by treating M-Theory as a function of prismatic light scattering dynamics.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project explores whether M-Theory can be reformulated or extended through the lens of active inference and hyper-dimensional geometry. It addresses philosophical and empirical fallacies, delineates theoretical consequences, and develops new functional insights at the edge of current physics.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Theoretical physicists, mathematicians, and formally-oriented researchers are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 53,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-model-centric-cognition", {
  title: "Model-Centric Cognition",
  subtitle: "Developing the Wave Hypothesis and model-centric approaches to cognition and knowledge representation.",
  audience: "Cognitive scientists, AI researchers, and philosophers working on model-centric theories of mind.",
  lede: "Model-Centric Cognition is an Ecosystem project developing a model-centric theory of cognition anchored in the Wave Hypothesis. It examines how cognitive systems represent and update internal models, drawing on Active Inference and existing wave-based theoretical traditions.",
  primaryActions: [{ label: "Wave Hypothesis", sourceId: "shortlink-wave-hypothesis" }, { label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project develops a theoretical account of cognition centered on model structure and dynamics. The Wave Hypothesis provides the theoretical core, departing from existing approaches and addressing pushback through formal development and empirical grounding.",
      links: [{ sourceId: "shortlink-wave-hypothesis" }, { sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Cognitive scientists, philosophers, and AI theoreticians are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 54,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["shortlink-wave-hypothesis", "ecosystem", "discord"]
});

write("project-sweet-dogg", {
  title: "Project Sweet (Sus) Dogg",
  subtitle: "Helping warm relations by strengthening alignment in human-animal interactions.",
  audience: "Researchers, practitioners, and animal behavior scientists interested in Active Inference approaches to human-animal alignment.",
  lede: "Project Sweet (Sus) Dogg applies Active Inference principles to understanding and improving human-animal relationships — particularly focusing on alignment and trust-building in interactions between humans and domestic animals.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project develops Active Inference models of human-animal interaction, examining how mutual inference and alignment processes shape relationships and behaviors across species boundaries.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Animal behavior researchers, ethologists, and Active Inference modelers are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 55,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-symbolic-robotics", {
  title: "Symbolic Cognitive Robotics",
  subtitle: "Exploring symbolic and embodied cognitive robotics through Active Inference and Bayesian reasoning.",
  audience: "Roboticists, AI researchers, and cognitive scientists interested in symbolic reasoning, embodied cognition, and robotics.",
  lede: "Symbolic Cognitive Robotics is an Ecosystem project applying Active Inference to robotic systems that combine symbolic reasoning with embodied action. Work draws on papers in robotics and embodied cognition, and includes implementation on physical robot platforms.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project explores how symbolic cognitive architectures and embodied Active Inference can be integrated in robotic systems. Implementation work uses rover-class robots and extends Active Inference with symbolic reasoning capabilities for exploration, planning, and learning.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Roboticists, AI researchers, and cognitive scientists with interests in symbolic AI and embodied Active Inference are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 56,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-einstein-model", {
  title: "The Einstein Model of a Solid as a Model of the Mental Apparatus",
  subtitle: "Bridging psychoanalytic theory and Active Inference through the economic perspective of psychoanalytic theory.",
  audience: "Psychoanalytic researchers, neuroscientists, and theoreticians interested in formal bridges between psychoanalysis and Active Inference.",
  lede: "This Ecosystem project develops a formal bridge between the Einstein model of a solid and the mental apparatus, viewed through the economic perspective of psychoanalytic theory. It applies Active Inference to bridge psychoanalytic concepts with modern neuroscience and artificial intelligence.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project develops theoretical connections between classical psychoanalytic models of the mind and the Active Inference framework, using the Einstein model as a structural analogy. The work bridges the economic (energy-based) perspective in psychoanalysis with the free energy formalism.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Psychoanalytic researchers, neuroscientists, and formally-oriented theoreticians are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 57,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-universal-basic-income", {
  title: "The Universal Basic Income Experiment",
  subtitle: "Studying universal basic income through Active Inference modeling and simulation.",
  audience: "Economists, social scientists, and policy researchers interested in Active Inference approaches to economic policy.",
  lede: "The Universal Basic Income Experiment applies Active Inference to study Universal Basic Income (UBI) — using token economics, policy simulation, and behavioral modeling to examine UBI's effects on human flourishing and economic dynamics.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project develops simulation and modeling approaches for UBI using Active Inference principles — modeling economic agents, their belief updating, and policy responses to study how UBI interventions propagate through socioeconomic systems.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Economists, social scientists, policy researchers, and modelers interested in Active Inference approaches to economic policy are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 58,
  relatedSlugs: ["reinference", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

// ── EduActive Ecosystem Projects ────────────────────────────────────────────

write("project-collective-foraging", {
  title: "Action Research on Collective Foraging",
  subtitle: "Studying collective foraging dynamics, negotiation affordances, and sustainability through Active Inference.",
  audience: "Ecologists, behavioral scientists, and researchers interested in collective behavior and negotiation.",
  lede: "Action Research on Collective Foraging (Negotiation Affordances) applies Active Inference to collective foraging behavior — studying how groups form coalitions, negotiate opportunities, and sustain value exchanges. The project has a focus on long-term sustainability and social dynamics.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project develops Active Inference models of collective foraging — treating groups of agents as inference systems that jointly minimize surprise about resource availability and social coordination. The work addresses sustainability, formation dynamics, and value exchange in collective settings.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Ecologists, behavioral scientists, and Active Inference modelers interested in collective behavior are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 59,
  relatedSlugs: ["edactive", "projects", "project-active-inferants", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-cycle-book", {
  title: "Active Inference Cycle Book for Self-Knowing",
  subtitle: "A reflective book project applying Active Inference as a framework for self-knowledge and personal development.",
  audience: "Reflective practitioners, educators, and individuals interested in applying Active Inference to personal understanding.",
  lede: "The Active Inference Cycle Book for Self-Knowing develops a practical framework for personal growth and self-knowledge grounded in Active Inference. It uses the inference cycle — perceiving, modeling, acting, learning — as a scaffold for reflective practice and long-term personal development.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The book applies Active Inference concepts — prediction, action, free energy minimization, and belief updating — as a practical guide for self-understanding. The aim is to make the theoretical framework accessible as a living tool for personal development and population-level wellbeing.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Writers, educators, and practitioners interested in Active Inference as personal development framework are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 60,
  relatedSlugs: ["edactive", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-creativity-fep", {
  title: "Creativity and Creators Under the Free Energy Principle",
  subtitle: "Designing and researching creative processes and creative agents through the Free Energy Principle.",
  audience: "Artists, cognitive scientists, and researchers interested in computational creativity and Active Inference.",
  lede: "This Ecosystem project develops accounts of creativity and creative agents under the Free Energy Principle — examining how generative models and free energy minimization explain, predict, and enhance creative behavior.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project designs and researches creativity as an Active Inference process — asking how creative agents update beliefs, explore possibility spaces, and produce novel outputs. The work connects theoretical accounts with practical research on creative practice.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Artists, cognitive scientists, and creativity researchers interested in Active Inference are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 61,
  relatedSlugs: ["edactive", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-froebel", {
  title: "Froebel's System",
  subtitle: "Studying Friedrich Froebel's pedagogical system through Active Inference and integral studies.",
  audience: "Education researchers, historians of pedagogy, and anyone interested in connecting classical educational philosophy with Active Inference.",
  lede: "Froebel's System studies the educational philosophy and methods of Friedrich Froebel — the inventor of kindergarten — through the lens of Active Inference and integral studies. The project captures and analyzes Froebel's approach as a cohort-based study, using Common Concepts as a prototyping platform.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "Friedrich Froebel developed a systematic approach to early childhood education centered on play, creativity, and self-directed exploration. This project applies Active Inference as a theoretical framework for analyzing and extending Froebel's system, capturing his pedagogical principles and testing their alignment with current educational models.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Education researchers, historians, and pedagogically-oriented Active Inference practitioners are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 62,
  relatedSlugs: ["edactive", "projects", "project-educational-course-development", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-fundamentals-active-inference", {
  title: "Fundamentals of Active Inference",
  subtitle: "Assisting the development and dissemination of the Fundamentals of Active Inference textbook.",
  audience: "Learners, educators, and engineers working through the Fundamentals of Active Inference textbook.",
  lede: "Fundamentals of Active Inference is an Ecosystem project supporting the development and dissemination of the Fundamentals of Active Inference textbook — a comprehensive introduction to Active Inference principles, algorithms, and applications for engineers. The Institute hosts a Textbook Group cohort working through this book.",
  primaryActions: [
    { label: "Textbook Group", sourceId: "official-textbook-group-shortlink" },
    { label: "Repository", sourceId: "repo-fundamentals" }
  ],
  sections: [
    {
      heading: "Overview",
      body: "The project supports educational engagement with the Fundamentals of Active Inference book — building learning pathways, study materials, exercises, and community resources for those learning from this text.",
      links: [{ sourceId: "repo-fundamentals" }, { sourceId: "official-textbook-group-shortlink" }]
    },
    { heading: "Participate", body: "Join the current Textbook Group cohort or contribute to supplementary materials.", links: [{ sourceId: "official-textbook-group-shortlink" }, { sourceId: "discord" }] }
  ],
  order: 63,
  relatedSlugs: ["edactive", "projects", "project-textbook-group", "learning"],
  externalSourceIds: ["repo-fundamentals", "official-textbook-group-shortlink", "discord"]
});

write("project-mathart", {
  title: "MathArt Conversations",
  subtitle: "Exploring profound connections between mathematics and the arts through collaborative conversation.",
  audience: "Mathematicians, artists, educators, and anyone interested in mathematical aesthetics and art-science dialogue.",
  lede: "MathArt Conversations is an Ecosystem project creating a space for exploring the profound connections between mathematics and the arts. Through collaborative conversations, streams, and shared inquiry, it surfaces deep structural resonances between mathematical structures and artistic creativity.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "MathArt Conversations hosts dialogues and collaborative sessions at the intersection of mathematics and art — examining how theorems, proofs, and mathematical structures resonate with and inform artistic creation, and vice versa. The project produces conversation recordings accessible through the MathArt Streams.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Mathematicians, artists, educators, and anyone drawn to math-art dialogue are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 64,
  relatedSlugs: ["edactive", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-neurodivergent-learning", {
  title: "Neurodivergent Learning Sessions",
  subtitle: "Creating Active Inference learning resources and sessions tailored for neurodivergent participants.",
  audience: "Neurodivergent learners, educators, and advocates for inclusive Active Inference education.",
  lede: "Neurodivergent Learning Sessions develops Active Inference learning resources and sessions designed for neurodivergent participants — building curriculum, milestones, and community structures that support autistic, ADHD, and other neurodivergent learners in engaging deeply with Active Inference.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project creates learning environments and materials that recognize neurodiversity as a resource — developing curriculum and milestones adapted for neurodivergent engagement styles, from auditory and visual presentation to pacing and community structures.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Neurodivergent learners, educators, and accessibility advocates are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 65,
  relatedSlugs: ["edactive", "projects", "project-educational-course-development", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-numinia", {
  title: "Numinia",
  subtitle: "Embedding Active Inference values in an autonomous AI and educational adventure game.",
  audience: "Game developers, AI researchers, and educators interested in Active Inference embedded in game environments.",
  lede: "Numinia is an Ecosystem project developing an autonomous AI and educational adventure game grounded in Active Inference principles. The first mission embeds Active Inference in the values of the Numinia agent, creating an environment where players and agents co-learn through play.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "Numinia builds an educational game environment where Active Inference principles shape agent behavior and player interaction. The first mission centers on the Numinia AI embodying Active Inference values — learning, adapting, and acting in a game world that reflects the free energy principle.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Game developers, AI researchers, and educators interested in Active Inference in educational environments are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 66,
  relatedSlugs: ["edactive", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-tower-of-babel", {
  title: "Project Development for Solving the Tower of Babel Problem",
  subtitle: "UniFysica Philo-sophia: developing a universal language framework bridging scientific and humanistic inquiry.",
  audience: "Linguists, philosophers, scientists, and anyone interested in universal knowledge frameworks and cross-domain translation.",
  lede: "This Ecosystem project develops a framework for solving the Tower of Babel Problem — the challenge of cross-domain knowledge communication and translation. Drawing on philosophical and physical principles, it outlines, develops, and implements UniFysica Philo-sophia as a universal conceptual bridge.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project aims to develop a shared conceptual and linguistic framework — UniFysica Philo-sophia — that enables communication across scientific, humanistic, and cultural domains. It draws on the Blombos-to-present history of human symbolic communication and applies Active Inference as a unifying formalism.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Linguists, philosophers, scientists, and cross-domain thinkers are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 67,
  relatedSlugs: ["edactive", "projects", "active-inference"],
  externalSourceIds: ["ecosystem", "discord"]
});

write("project-three-mosqueteers", {
  title: "The Three Mosqueteers",
  subtitle: "Creating a livestream making science accessible to people without a scientific background.",
  audience: "Science communicators, educators, and public audiences interested in accessible science content.",
  lede: "The Three Mosqueteers is an Ecosystem project creating a live science communication show for people without a scientific background. It develops a format that makes scientific information — including Active Inference and related work — engaging and genuinely accessible.",
  primaryActions: [{ label: "Ecosystem", sourceId: "ecosystem" }],
  sections: [
    {
      heading: "Overview",
      body: "The project creates a science communication livestream format — The Three Mosqueteers — that brings scientific concepts to audiences who wouldn't typically encounter them. The show aims to make Active Inference and the broader world of complex adaptive systems accessible through story, conversation, and collaborative exploration.",
      links: [{ sourceId: "ecosystem" }]
    },
    { heading: "Participate", body: "Science communicators, educators, and live stream contributors are welcome.", links: [{ sourceId: "discord" }] }
  ],
  order: 68,
  relatedSlugs: ["edactive", "projects", "project-audio-visual-production"],
  externalSourceIds: ["ecosystem", "discord"]
});

console.log("\nDone. All pages written.");
