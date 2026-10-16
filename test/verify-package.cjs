'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'xml-js-package-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}

// Keep the tarball and consumer for inspection, including when a check fails.
console.log('Package verification directory:', temporary);
function pack(args) {
  const output = run(npm, ['pack', '--json', ...args], root);
  // npm 10 includes prepack's webpack stats before its JSON array.
  const start = output.search(/^\[\s*$/m);
  assert.notEqual(start, -1, output);
  return JSON.parse(output.slice(start));
}
const dryRun = pack(['--dry-run']);
const packed = pack(['--pack-destination', temporary]);
const files = packed[0].files.map(file => file.path).sort();
assert.deepEqual(files, dryRun[0].files.map(file => file.path).sort());
const expected = ['LICENSE', 'README.md', 'FORK.md', 'CHANGELOG.md', 'package.json', 'index.js',
  'bin/cli.js', 'bin/cli-helper.js', 'dist/xml-js.js', 'dist/xml-js.min.js', 'types/index.d.ts',
  ...fs.readdirSync(path.join(root, 'lib')).map(file => 'lib/' + file)].sort();
assert.deepEqual(files, expected, 'Review changes to the published file list');
fs.writeFileSync(path.join(temporary, 'pack.json'), JSON.stringify(packed, null, 2));
const tarball = path.join(temporary, packed[0].filename);
const consumer = path.join(temporary, 'consumer');
fs.mkdirSync(consumer);
fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ name: 'xml-js-tarball-consumer', version: '0.0.0', private: true }));
run(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', tarball], consumer);
const installed = path.join(consumer, 'node_modules', packed[0].name);
assert.equal(fs.lstatSync(installed).isSymbolicLink(), false, 'Must install the tarball, not a workspace link');
for (const file of ['lib/xml2js.js', 'dist/xml-js.js', 'dist/xml-js.min.js', 'types/index.d.ts']) {
  assert.deepEqual(fs.readFileSync(path.join(installed, file)), fs.readFileSync(path.join(root, file)), file);
}
// Run copied probes in the consumer; their imports cannot fall back to this checkout.
const probes = path.join(consumer, 'probes');
fs.mkdirSync(probes);
fs.cpSync(path.join(__dirname, 'helpers'), path.join(probes, 'helpers'), { recursive: true });
for (const file of ['package-smoke.cjs', 'browser-smoke.cjs']) fs.copyFileSync(path.join(__dirname, file), path.join(probes, file));
console.log(run(process.execPath, [path.join(probes, 'package-smoke.cjs'), installed, require.resolve('typescript/bin/tsc')], consumer).trim());
console.log(run(process.execPath, [path.join(probes, 'browser-smoke.cjs'), installed], consumer).trim());
console.log(run(npm, ['ls', '--omit=dev', '--all'], consumer).trim());
console.log('Tarball SHA-256:', createHash('sha256').update(fs.readFileSync(tarball)).digest('hex'));
console.log('PASS: local tarball only; no registry publication performed');
