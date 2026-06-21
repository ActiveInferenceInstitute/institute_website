import { techTreeExplorerSection, governanceGraphSection } from "./graphs.mjs";
import { narrativeSection } from "./narrative.mjs";
import { domainProjectsSection } from "../pages/ecosystem.mjs";

// ── InstituteOS feature sections (graphs, narratives, domains, related projects) ──

// InstituteOS feature blocks injected into a curated public page, keyed by slug.
// Returns markup inserted between the article stack and the key-surfaces band so
// the required curated section ordering stays intact.
export function instituteosFeatureSections(page, currentDir = "") {
  switch (page.slug) {
    case "learning":
      return techTreeExplorerSection(currentDir);
    case "structure":
      return (
        governanceGraphSection(currentDir) +
        narrativeSection({
          id: "structure-narratives",
          eyebrow: "Institute structure",
          title: "How the Institute is organized",
          text: "Public narrative content describing how the Institute is structured and organized.",
          targetPage: "structure",
        })
      );
    case "ecosystem":
      return (
        domainProjectsSection(currentDir) +
        narrativeSection({
          id: "ecosystem-narratives",
          eyebrow: "Ecosystem",
          title: "The Active Inference ecosystem",
          text: "Public narrative content describing the ecosystem and its domains of application.",
          targetPage: "ecosystem",
        })
      );
    case "about":
      return narrativeSection({
        id: "about-narratives",
        eyebrow: "Institute narrative",
        title: "Mission, history, and direction",
        text: "Public mission, vision, values, history, strategy, and focus-area prose for the Institute.",
        targetPage: "about",
      });
    case "activities":
      return narrativeSection({
        id: "activities-narratives",
        eyebrow: "Activities",
        title: "Public activities and updates",
        text: "Public narrative content describing the Institute's recurring activities.",
        targetPage: "activities",
      });
    default:
      return "";
  }
}
