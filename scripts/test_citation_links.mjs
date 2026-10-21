import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { normalizeDoi, doiFromUrl, resolveCitationSource } from "../src/lib/citation-links.mjs";
import { citationsTable } from "../src/render/tables.mjs";
import { citationRows } from "../src/lib/instituteos.mjs";
import { escapeHtml } from "../src/lib/text.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const citation = {
  id: "sample-work", rowId: "citation-sample-work", title: "A specific work",
  authors: ["A. Author"], year: 2026, venue: "Example", doi: "10.1234/Exact.Work",
  sourceIds: ["citation-sample-work"],
};
const source = { id: "citation-sample-work", url: "https://doi.org/10.1234/Exact.Work", ok: true };
const render = (record = citation, sources = [source]) => citationsTable([record], sources);
const links = (html) => [...html.matchAll(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/gs)].map((match) => [match[1], match[2]]);

test("DOI comparison is exact, case-insensitive, and percent-decoded once", () => {
  assert.equal(normalizeDoi(" 10.1234%2FExact%2EWork "), "10.1234/exact.work");
  assert.equal(doiFromUrl("HTTPS://DOI.ORG/10.1234%2FEXACT.Work"), "10.1234/exact.work");
  for (const value of ["not-a-doi", "10.12/no", "10.1234/", "10.1234/a b", "10.1234/%zz", "10.1234/%FF", "10.1234/<tag>", "10.1234/%00"]) {
    assert.equal(normalizeDoi(value), null, value);
  }
  for (const url of ["https://doi.org.evil.test/10.1234/Exact.Work", "https://evil.test/doi.org/10.1234/Exact.Work", "https://doi.org/10.1234/Exact.Work?other=1", "https://doi.org/10.1234/Exact.Work#other", "https://doi.org:8443/10.1234/Exact.Work"]) {
    assert.equal(doiFromUrl(url), null, url);
  }
});

test("registered matching DOI URL links the title and DOI", () => {
  const encoded = { ...source, url: "https://DOI.org/10.1234%2fEXACT.Work" };
  assert.equal(resolveCitationSource(citation, new Map([[encoded.id, encoded]])), encoded);
  assert.deepEqual(links(render(citation, [encoded])), [[encoded.url, citation.title], [encoded.url, citation.doi]]);
});

test("paper-specific metadata binds an alternative work link and keeps DOI as plain text", () => {
  const paper = { ...source, doi: "10.1234%2FEXACT.WORK", url: "https://pubmed.ncbi.nlm.nih.gov/12345678/" };
  assert.equal(resolveCitationSource(citation, [paper]), paper);
  assert.deepEqual(links(render(citation, [paper])), [[paper.url, citation.title]]);
  assert.match(render(citation, [paper]), /<td>10\.1234\/Exact.Work<\/td>/);
});

const rejected = [
  ["wrong DOI", { ...source, url: "https://doi.org/10.1234/Exact.Work.other", doi: citation.doi }],
  ["HTTP credentials", { ...source, url: "https://user:password@doi.org/10.1234/Exact.Work" }],
  ["unsupported URL scheme", { ...source, url: "javascript:alert(1)" }],
  ["relative URL", { ...source, url: "/10.1234/Exact.Work" }],
  ["URL parser repair", { ...source, url: "https://doi.org\\@evil.test/10.1234/Exact.Work" }],
  ["URL whitespace", { ...source, url: "https://doi.org/10.1234/Exact.Work\n" }],
  ["URL control character", { ...source, url: "https://doi.org/10.1234/Exact.Work\u0000" }],
  ["spoofed DOI host", { ...source, url: "https://doi.org.evil.test/10.1234/Exact.Work" }],
  ["collection link", { ...source, url: "https://arxiv.org/" }],
  ["unreachable", { ...source, ok: false }],
  ["truthy reachability", { ...source, ok: "true" }],
  ["unpromoted", { ...source, promoted: false }],
  ["wrong metadata DOI", { ...source, url: "https://pubmed.ncbi.nlm.nih.gov/12345678/", doi: "10.1234/other" }],
];
for (const [name, rejectedSource] of rejected) {
  test(`${name} cannot become a DOI or work anchor`, () => {
    assert.equal(resolveCitationSource(citation, [rejectedSource]), null);
    const html = render(citation, [rejectedSource]);
    assert.deepEqual(links(html), []);
    assert.match(html, /10\.1234\/Exact.Work/);
    assert.match(html, /data-citation-link="unavailable">Verified work link unavailable/);
  });
}

test("generic first source and unknown source never override citation identity", () => {
  const generic = { id: "journal", url: "https://example.org/journal", doi: citation.doi, ok: true };
  const record = { ...citation, sourceIds: ["journal", "unknown", source.id], href: "https://evil.test/" };
  assert.equal(resolveCitationSource(record, [generic, source]), source);
  assert.deepEqual(links(render({ ...record, sourceIds: ["journal", "unknown"] }, [generic])), []);
  assert.deepEqual(links(render({ ...record, sourceIds: ["unknown"] }, [generic])), []);
  const similarlyNamed = { ...generic, id: `${source.id}spoof` };
  assert.equal(resolveCitationSource({ ...citation, sourceIds: [similarlyNamed.id] }, [similarlyNamed]), null);
});

test("non-DOI works link their first reachable registered source by title", () => {
  const record = { ...citation, doi: "", sourceIds: ["unknown", "collection"] };
  const collection = { id: "collection", url: "https://arxiv.org/", ok: true };
  assert.deepEqual(links(render(record, [collection])), [[collection.url, citation.title]]);
  assert.match(render(record, []), /Verified work link unavailable/);
});

test("a malformed DOI is retained as escaped text without falling back to a work link", () => {
  const record = { ...citation, title: '<img src=x onerror="bad"> & work', doi: '<script>"&</script>' };
  const html = render(record);
  assert.deepEqual(links(html), []);
  assert.ok(html.includes(escapeHtml(record.title)));
  assert.ok(html.includes(escapeHtml(record.doi)));
  assert.doesNotMatch(html, /<script>|<img/);
});

test("registered alternative URL attributes and linked text are HTML-escaped", () => {
  const record = { ...citation, title: 'Work <b>"&</b>' };
  const paper = { ...source, doi: citation.doi, url: 'https://example.org/paper?title="work"&part=1' };
  const html = render(record, [paper]);
  assert.deepEqual(links(html), [[escapeHtml(paper.url), escapeHtml(record.title)]]);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});

function contractCases(cases) {
  const program = [
    "import json, runpy, sys",
    "module = runpy.run_path('scripts/check_site_contract.py')",
    "results = []",
    "for case in json.load(sys.stdin):",
    "    errors = []",
    "    module['check_citation_anchors'](case['html'], case['citations'], case['sources'], errors, 'fixture')",
    "    results.append(errors)",
    "print(json.dumps(results))",
  ].join("\n");
  const result = spawnSync(process.env.PYTHON || "python3", ["-B", "-c", program], {
    cwd: root, input: JSON.stringify(cases), encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return JSON.parse(result.stdout);
}

test("site contract rejects wrong, missing, collection, and mislabeled citation anchors", () => {
  const html = render();
  const unavailable = render(citation, []);
  const paper = { ...source, doi: citation.doi, url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12345678/" };
  const valid = [
    { html, citations: [citation], sources: [source] },
    { html: render(citation, [paper]), citations: [citation], sources: [paper] },
    { html: unavailable, citations: [citation], sources: [] },
  ];
  const invalid = [
    html.replaceAll(source.url, "https://example.org/journal"),
    html.replaceAll(source.url, "https://doi.org/10.1234/other"),
    unavailable,
    html.replace(citation.title, "Wrong work"),
    html.replace(`>${citation.doi}</a>`, ">Wrong DOI</a>"),
    html.replace(/<td><a .*?<\/a><\/td>/s, "<td></td>"),
  ].map((mutated) => ({ html: mutated, citations: [citation], sources: [source] }));
  invalid.push({ html: unavailable.replace("Verified work link unavailable", ""), citations: [citation], sources: [] });
  invalid.push({ html: unavailable.replace(citation.doi, citation.doi + "wrong"), citations: [citation], sources: [] });
  const results = contractCases([...valid, ...invalid]);
  for (const errors of results.slice(0, valid.length)) assert.deepEqual(errors, []);
  for (const errors of results.slice(valid.length)) assert.ok(errors.length > 0, "mutated citation must fail");
});

test("site contract independently agrees with rejected-source and non-DOI cases", () => {
  const cases = rejected.map(([, rejectedSource]) => ({
    html: render(citation, [rejectedSource]), citations: [citation], sources: [rejectedSource],
  }));
  const record = { ...citation, doi: "" };
  const collection = { ...source, url: "https://arxiv.org/" };
  cases.push({ html: render(record, [collection]), citations: [record], sources: [collection] });
  const escaped = { ...citation, title: 'Work <b>"&</b>' };
  const paper = { ...source, doi: citation.doi, url: 'https://example.org/paper?title="work"&part=1' };
  cases.push({ html: render(escaped, [paper]), citations: [escaped], sources: [paper] });
  const malformed = { ...citation, doi: '<script>"&</script>' };
  cases.push({ html: render(malformed), citations: [malformed], sources: [source] });
  for (const errors of contractCases(cases)) assert.deepEqual(errors, []);
});

test("every current bibliography record resolves to its registered verified work", () => {
  const sources = JSON.parse(readFileSync(new URL("../src/content/live-sources.json", import.meta.url), "utf8")).sources;
  const rows = citationRows();
  assert.ok(rows.length > 0, "bibliography must not be empty");
  const html = citationsTable(rows, sources);
  const unresolved = [];
  for (const row of rows) {
    const resolved = resolveCitationSource(row, sources);
    if (!resolved) unresolved.push(row.id);
    else assert.ok(html.includes(`href="${escapeHtml(resolved.url)}"`), row.id);
  }
  assert.deepEqual(contractCases([{ html, citations: rows, sources }]), [[]]);
  assert.deepEqual(unresolved, [], "register reachable DOI-bound sources for these current records");
});
