import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const names = ['governance_graph', 'ontology_graph', 'tech_tree_graph', 'domain_projects', 'narratives_public', 'communications_public', 'newsletter', 'programs', 'citations', 'calendar', 'videos'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'website-export-'));
  cpSync(new URL('.', import.meta.url), join(root, 'scripts'), { recursive: true });
  const files = names.map(name => ({ name: `${name}.json`, output_path: `src/content/instituteos/${name}.json`, target: 'content', record_count: 1 }));
  files.push({ name: 'projects.json', output_path: 'data/projects.json', target: 'data', record_count: 1 });
  files.push({ name: 'demo.json', output_path: 'src/content/pages/domains/demo.json', target: 'pages_domains', record_count: 1 });
  files.push({ name: 'newsletter-media/demo.png', output_path: 'assets/img/newsletters/demo.png', target: 'newsletter_assets', record_count: 1 });
  for (const entry of files) {
    const bytes = entry.target === 'newsletter_assets' ? Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6L8AAAAASUVORK5CYII=', 'base64') : Buffer.from(JSON.stringify({ records: [{ title: 'Public sample' }] }));
    mkdirSync(join(root, entry.output_path, '..'), { recursive: true });
    writeFileSync(join(root, entry.output_path), bytes);
    entry.sha256 = hash(bytes);
  }
  const manifest = { files, gate_version: '1.0.0', generated_at: '2026-10-05T00:00:00+00:00', source_fingerprint: '012345abcdef' };
  const save = (fingerprint = true) => {
    if (fingerprint) manifest.source_fingerprint = hash(manifest.files.map(entry => entry.sha256).sort().join('\n')).slice(0, 12);
    writeFileSync(join(root, 'data/export-manifest.json'), JSON.stringify(manifest));
  };
  save();
  for (const name of ['projects', 'ideas', 'ontology', 'entities', 'fellows', 'sab_cohorts', 'policies', 'assets']) {
    writeFileSync(join(root, `src/content/instituteos/${name}.json`), '{}');
  }
  mkdirSync(join(root, 'assets/img/instituteos'), { recursive: true });
  for (const name of ['ActInferServe.png', 'Dark_ActInfServe.png']) writeFileSync(join(root, `assets/img/instituteos/${name}`), 'synthetic brand');
  const run = (args = ['--check']) => {
    const env = { ...process.env }; delete env.INSTITUTEOS_ROOT;
    return spawnSync('python3', ['scripts/sync_instituteos_public_data.py', ...args], { cwd: root, env, encoding: 'utf8' });
  };
  return { root, manifest, save, run };
}
const cases = [
  ['missing manifest', f => rmSync(join(f.root, 'data/export-manifest.json'))],
  ['unclaimed payload', f => writeFileSync(join(f.root, 'src/content/instituteos/unclaimed.json'), '{}')],
  ['empty inventory', f => { f.manifest.files = []; f.save(); }],
  ['missing producer', f => rmSync(join(f.root, f.manifest.files[0].output_path))],
  ['partial inventory', f => { f.manifest.files.shift(); f.save(); }],
  ['duplicate entry', f => { f.manifest.files.push(f.manifest.files[0]); f.save(); }],
  ['stale bytes', f => writeFileSync(join(f.root, f.manifest.files[0].output_path), '{}')],
  ['image hash mismatch', f => writeFileSync(join(f.root, 'assets/img/newsletters/demo.png'), 'tampered')],
  ['count mismatch', f => { f.manifest.files[0].record_count = 2; f.save(); }],
  ['private manifest field', f => { f.manifest.internal_notes = 'synthetic secret'; f.save(); }],
  ['private entry field', f => { f.manifest.files[0].notes = 'synthetic secret'; f.save(); }],
  ['invalid version', f => { f.manifest.gate_version = '0'; f.save(); }],
  ['invalid provenance', f => { f.manifest.source_fingerprint = 'unverified'; f.save(false); }],
  ['wrong fingerprint', f => { f.manifest.source_fingerprint = '000000000000'; f.save(false); }],
  ['invalid timestamp', f => { f.manifest.generated_at = 'yesterday'; f.save(); }],
  ['traversal', f => { f.manifest.files[0].output_path = 'src/content/instituteos/../outside.json'; f.save(); }],
  ['symlink', f => { const p = join(f.root, f.manifest.files[0].output_path); rmSync(p); symlinkSync(join(f.root, 'data/projects.json'), p); }],
  ['newsletter local path', f => poison(f, 'newsletter.json', '/Users/synthetic/private.md')],
  ['domain private content', f => poison(f, 'demo.json', 'synthetic@example.test')],
  ['telephone URI', f => poison(f, 'newsletter.json', 'tel:+15551234567')],
  ['contextual compact phone', f => poison(f, 'newsletter.json', 'call 5551234567')],
  ['camel-case private key', f => poison(f, 'newsletter.json', { privateNotes: 'Synthetic private memo' })],
  ['home address key', f => poison(f, 'newsletter.json', { homeAddress: 'Synthetic private address' })],
  ['hyphen private key', f => poison(f, 'newsletter.json', { 'primary-contact': 'Synthetic person' })],
  ['nested domain page', f => unexpected(f, 'src/content/pages/domains/nested/demo.json')],
  ['nested registry', f => unexpected(f, 'src/content/instituteos/nested/private.json')],
  ['registry markdown', f => unexpected(f, 'src/content/instituteos/scratch.md')],
  ['extensionless newsletter asset', f => unexpected(f, 'assets/img/newsletters/notes')],
  ['nested newsletter asset', f => unexpected(f, 'assets/img/newsletters/nested/private.png')],
  ['SVG disguised as PNG', f => {
    const entry = f.manifest.files.find(item => item.target === 'newsletter_assets');
    const bytes = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    writeFileSync(join(f.root, entry.output_path), bytes); entry.sha256 = hash(bytes); f.save();
  }],
  ['scripted newsletter SVG', f => {
    const output_path = 'assets/img/newsletters/unsafe.svg';
    const bytes = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    writeFileSync(join(f.root, output_path), bytes);
    f.manifest.files.push({ name: 'newsletter-media/unsafe.svg', output_path, target: 'newsletter_assets', record_count: 1, sha256: hash(bytes) }); f.save();
  }],
  ['catalog private content', f => poison(f, 'projects.json', 'https://coda.io/private')],
];
function unexpected(f, path) {
  mkdirSync(join(f.root, path, '..'), { recursive: true });
  writeFileSync(join(f.root, path), JSON.stringify({ slug: 'synthetic-nested-domain', title: 'source atlas' }));
}
function poison(f, name, value) {
  const entry = f.manifest.files.find(item => item.name === name);
  const bytes = JSON.stringify({ records: [{ title: value }] });
  writeFileSync(join(f.root, entry.output_path), bytes);
  entry.sha256 = hash(bytes); f.save();
}
test('valid complete public export passes', () => {
  const f = fixture(); try { const r = f.run(); assert.equal(r.status, 0, r.stderr); } finally { rmSync(f.root, { recursive: true }); }
});
test('public Authorea link passes, adjacent local path fails', () => {
  const f = fixture(); try {
    poison(f, 'newsletter.json', 'https://www.authorea.com/users/123/articles/456-public');
    assert.equal(f.run().status, 0);
    poison(f, 'newsletter.json', 'https://www.authorea.com/users/123/articles/456-public /Users/synthetic/private.md');
    assert.equal(f.run().status, 1);
  } finally { rmSync(f.root, { recursive: true }); }
});
for (const [name, mutate] of cases) test(`reject ${name}`, () => {
  const f = fixture(); try {
    assert.equal(f.run().status, 0, 'positive control');
    mutate(f);
    const r = f.run(); assert.equal(r.status, 1, `${r.stdout}\n${r.stderr}`);
    assert.match(r.stderr, /export manifest|public-safety validation|unclaimed public payload/);
  } finally { rmSync(f.root, { recursive: true }); }
});

test('source-present check and write reject poisoned exports without changing registry slices', () => {
  const f = fixture(); try {
    const source = join(f.root, 'source');
    mkdirSync(join(source, 'library/registries'), { recursive: true });
    mkdirSync(join(source, 'library/assets'), { recursive: true });
    for (const name of ['tech_trees', 'entities', 'policies', 'sab_cohorts']) writeFileSync(join(source, `library/registries/${name}.json`), '{}');
    for (const name of ['ActInferServe.png', 'Dark_ActInfServe.png']) writeFileSync(join(source, `library/assets/${name}`), 'synthetic brand');
    writeFileSync(join(f.root, 'src/content/repositories.json'), '{}');
    writeFileSync(join(f.root, 'src/content/live-sources.json'), '{}');
    writeFileSync(join(source, 'library/registries/entities.json'), JSON.stringify({ entities: [
      { id: 'synthetic-safe', name: 'Public sample', entity_type: 'person', fellowship: { focus: 'Public research' } },
      { id: 'synthetic-phone', name: 'Phone sample', entity_type: 'person', fellowship: { focus: 'call 5551234567' } },
    ] }));
    const args = ['--instituteos-root', source];
    let r = f.run(args); assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /warning: dropped fellow record 'synthetic-phone'/);
    const fellows = JSON.parse(readFileSync(join(f.root, 'src/content/instituteos/fellows.json'), 'utf8'));
    assert.deepEqual(fellows.fellows.map(item => item.id), ['synthetic-safe']);
    r = f.run([...args, '--check']); assert.equal(r.status, 0, r.stderr);
    poison(f, 'demo.json', 'synthetic@example.test');
    r = f.run([...args, '--check']); assert.equal(r.status, 1, r.stderr);
    const registry = join(f.root, 'src/content/instituteos/projects.json');
    writeFileSync(registry, 'sentinel unchanged');
    r = f.run(args); assert.equal(r.status, 1, r.stderr);
    assert.equal(readFileSync(registry, 'utf8'), 'sentinel unchanged');
  } finally { rmSync(f.root, { recursive: true }); }
});

test('per-record phone rejection mirrors final privacy validation', () => {
  const result = spawnSync('python3', ['-c', `
import sys
sys.path.insert(0, 'scripts')
from sync_instituteos_public_data import record_public_unsafe_reason, validate_public_payload
record = {'focus': '555-123-4567'}
try:
    validate_public_payload(record, 'synthetic.json')
except ValueError:
    pass
else:
    raise AssertionError('final payload control did not reject phone')
assert record_public_unsafe_reason(record) is not None
`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('compact telephone matching covers rendered text but preserves identifiers', () => {
  const result = spawnSync('python3', ['-c', `
import sys
sys.path.insert(0, 'scripts')
from check_static_security import find_pii
from sync_instituteos_public_data import validate_public_payload
assert find_pii('tel:+15551234567')
assert find_pii('call 5551234567')
assert find_pii('+15551234567')
assert not find_pii('s42003-021-02994-2 5551234567')
validate_public_payload({'doi': 's42003-021-02994-2', 'identifier': '5551234567'}, 'public.json')
`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
