import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { siteData } from "../src/data.mjs";
import { DEFAULT_LOCALE, setActiveLocale } from "../src/i18n/index.mjs";
import { fellowsSection, instituteosFeatureSections } from "../src/render/feature-sections.mjs";

const originalPeople = siteData.instituteos.entities.people;
const originalFellows = siteData.instituteos.fellows.fellows;
const originalCohorts = siteData.instituteos.sabCohorts.cohorts;

beforeEach(() => {
  setActiveLocale(DEFAULT_LOCALE);
  siteData.instituteos.entities.people = [];
  siteData.instituteos.fellows.fellows = [];
  siteData.instituteos.sabCohorts.cohorts = [];
});

afterEach(() => {
  siteData.instituteos.entities.people = originalPeople;
  siteData.instituteos.fellows.fellows = originalFellows;
  siteData.instituteos.sabCohorts.cohorts = originalCohorts;
  setActiveLocale(DEFAULT_LOCALE);
});

function person(id, name, roles, fields = {}) {
  return { id, name, roles, active: true, website: "", ...fields };
}

test("the current board excludes historical aliases, inactive people and role slots", () => {
  siteData.instituteos.entities.people = [
    person("current-board", "Current Board Person", ["Board of Directors"], { title: "Curated Public Title" }),
    person("former-director", "Former Director Person", ["Director"]),
    person("former-board", "Former Board Person", ["Board Member"]),
    person("inactive-board", "Inactive Board Person", ["Board of Directors"], { active: false }),
    person("role-slot", "Board Secretary", ["Board of Directors"]),
  ];
  const html = instituteosFeatureSections({ slug: "board-of-directors" });
  assert.match(html, /Current Board Person/);
  assert.match(html, /Curated Public Title/);
  for (const excluded of ["Former Director Person", "Former Board Person", "Inactive Board Person", "Board Secretary"]) {
    assert.ok(!html.includes(excluded), excluded);
  }
});

test("the current officer roster requires the canonical Officer membership", () => {
  siteData.instituteos.entities.people = [
    person("current-officer", "Current Officer Person", ["Officer"]),
    person("past-president", "Past President Person", ["President"]),
    person("past-treasurer", "Past Treasurer Person", ["Treasurer"]),
    person("past-secretary", "Past Secretary Person", ["Secretary"]),
    person("past-vice-president", "Past Vice President Person", ["Vice President"]),
  ];
  const html = instituteosFeatureSections({ slug: "officers" });
  assert.match(html, /Current Officer Person/);
  for (const excluded of ["Past President Person", "Past Treasurer Person", "Past Secretary Person", "Past Vice President Person"]) {
    assert.ok(!html.includes(excluded), excluded);
  }
});

test("the current advisory roster accepts the public canonical label only", () => {
  siteData.instituteos.entities.people = [
    person("current-advisor", "Current Advisor Person", ["SAB membership"]),
    person("prior-advisor", "Prior Advisor Person", ["Scientific Advisor"]),
    person("unmapped-advisor", "Unmapped Advisor Person", ["Scientific Advisory Board"]),
  ];
  const html = instituteosFeatureSections({ slug: "scientific-advisory-board" });
  assert.match(html, /Current Advisor Person/);
  assert.ok(!html.includes("Prior Advisor Person"));
  assert.ok(!html.includes("Unmapped Advisor Person"));
});

test("the fellowship section keeps current and past appointment history separate", () => {
  siteData.instituteos.fellows.fellows = [
    { id: "current-fellow", name: "Current Appointment Person", status: "current", position: "Research Fellow" },
    { id: "past-fellow", name: "Past Appointment Person", status: "past", position: "Research Fellow" },
  ];
  const html = fellowsSection();
  assert.match(html, /Current Appointment Person/);
  assert.ok(!html.includes("Past Appointment Person"));
  assert.equal(siteData.instituteos.fellows.fellows[1].status, "past");
});
