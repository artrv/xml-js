'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const loadApi = require('./helpers/load-api.cjs');
const checkApi = require('./helpers/api-contract.cjs');
const probe = require('./helpers/probe-ownership.cjs');

const root = fs.realpathSync(path.resolve(process.argv[2] || path.join(__dirname, '..')));
const manifest = require(path.join(root, 'package.json'));
assert.equal(manifest.main, 'lib/index.js');
assert.equal(manifest.types, './types/index.d.ts');
assert.equal(manifest.browser, undefined, 'No browser field: browser users load dist scripts or bundle main');
assert.equal(require(require.resolve('sax/package.json', { paths: [root] })).version, '1.4.1');
for (const entry of ['main', 'index.js', 'lib/index.js', 'dist/xml-js.js', 'dist/xml-js.min.js']) {
  checkApi(loadApi(root, entry));
  console.log('API PASS:', entry);
}
assert.equal(require(path.join(root, 'lib/xml2js.js')), loadApi(root).xml2js);
for (const entry of ['main', 'lib/xml2js.js', 'dist/xml-js.js', 'dist/xml-js.min.js']) {
  for (const mode of ['success', 'malformed', 'callback', 'live']) {
    const result = probe(root, mode, entry);
    for (const [name, alive] of Object.entries(result.alive)) assert.equal(alive, false, `${entry}: ${mode}: ${name}`);
    if (mode === 'live') assert.equal(result.liveContentPreserved, true);
    console.log('OWNERSHIP PASS:', entry, mode);
  }
}
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'xml-js-types-'));
try {
  const compiler = process.argv[3] || require.resolve('typescript/bin/tsc');
  fs.writeFileSync(path.join(temporary, 'consumer.ts'), `
import * as convert from ${JSON.stringify(root)};
const options: convert.Options.XML2JS = { compact: false, addParent: true };
const tree: convert.Element | convert.ElementCompact = convert.xml2js('<root/>', options);
const compact: convert.Element | convert.ElementCompact = convert.xml2js('<root/>', { compact: true });
const json: string = convert.xml2json('<root/>', { spaces: 2 });
const xml: string = convert.js2xml(tree);
const other: string = convert.json2xml(json);
`);
  fs.writeFileSync(path.join(temporary, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'es5', module: 'commonjs', strict: true, noEmit: true, types: [] },
    files: ['consumer.ts'],
  }));
  const types = spawnSync(process.execPath, [compiler, '-p', temporary], { encoding: 'utf8', timeout: 30000 });
  assert.ifError(types.error);
  assert.equal(types.status, 0, types.stdout + types.stderr);
  console.log('TYPES PASS:', manifest.types);
  const fixture = path.join(temporary, 'input.xml');
  fs.writeFileSync(fixture, '<root>ok</root>');
  const cli = spawnSync(process.execPath, [path.join(root, 'bin/cli.js'), fixture, '--compact'], { encoding: 'utf8' });
  assert.ifError(cli.error);
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout), { root: { _text: 'ok' } });
  console.log('CLI PASS');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
console.log('Verified package root:', root);
