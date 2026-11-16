// Synthetic public records exercise both independent affiliation/status tables.
export function projectCatalogFixture() {
  return [
    ["institute", "active", "alpha", ["active-inference", "institute-only"]],
    ["institute", "active", "beta", ["active-inference", "institute-only"]],
    ["institute", "archived", "gamma", ["active-inference"]],
    ["ecosystem", "active", "delta", ["active-inference", "ecosystem-only"]],
    ["ecosystem", "active", "epsilon", ["active-inference", "ecosystem-only"]],
    ["ecosystem", "completed", "zeta", ["active-inference"]],
  ].map(([affiliation, status, id, topics]) => ({
    id,
    title: `Active Inference ${id}`,
    affiliation,
    status,
    topics,
    summary: `Public ${id} summary <img src=x onerror=alert(1)> & evidence`,
    owner_name: `Lead ${id} <script>alert(1)</script>`,
    people: [{ name: `Lead ${id} <script>alert(1)</script>` }, { name: `Contributor ${id}` }],
    website_slug: `project-${id}`,
  }));
}
