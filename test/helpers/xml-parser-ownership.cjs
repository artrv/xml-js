'use strict';
// Isolated diagnostic only. Never load this helper in a product process.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createHash } = require('node:crypto');
const loadApi = require('./load-api.cjs');

const [root, mode = 'success', entry = 'main', representation = 'noncompact'] = process.argv.slice(2);
assert.ok(global.gc, 'Run this diagnostic with --expose-gc');
assert.ok(['success', 'malformed', 'callback', 'live'].includes(mode));
const api = loadApi(path.resolve(root), entry);
const parse = api.xml2js;
const compact = representation === 'compact';
const hash = value => createHash('sha256').update(value).digest('hex');
const contentHash = tree => hash(JSON.stringify(tree, (key, value) => key === 'up' ? undefined : value));
const tick = () => new Promise(resolve => setImmediate(resolve));
async function collect() {
  // WeakRef targets survive the current JS job. Do not dereference in this loop.
  for (let i = 0; i < 8; i++) { await tick(); global.gc(); }
  await tick();
}

function callbackFor(payload, probes, fail) {
  return (name, current) => {
    assert.ok(payload.input.length > 0);
    probes.root ??= new WeakRef(current);
    if (name === 'text') probes.partial ??= new WeakRef(current);
    if (name === 'retention-probe-failure' && fail) throw new Error('ownership-callback-failure');
    return name;
  };
}

function parseLarge(failureMode, asCompact) {
  let xml = '<root>' + '<item key="value"><text>retention &amp; content</text></item>'.repeat(12000) + '</root>';
  if (failureMode === 'malformed') xml = xml.slice(0, -7) + '</wrong>';
  if (failureMode === 'callback') xml = xml.slice(0, -7) + '<retention-probe-failure/></root>';
  const probes = {};
  const payload = { input: xml, values: Array(8192).fill('callback-owned') };
  const callback = callbackFor(payload, probes, failureMode === 'callback');
  const options = { compact: asCompact, addParent: true, parentKey: 'up', elementNameFn: callback, invocationPayload: payload };
  probes.callback = new WeakRef(callback);
  probes.payload = new WeakRef(payload);
  probes.options = new WeakRef(options);
  let tree, failure;
  try { tree = parse(xml, options); } catch (error) { failure = { name: error.name, message: error.message }; }
  if (failureMode === 'malformed' || failureMode === 'callback') assert.ok(failure, 'Input must throw');
  else assert.ok(tree, 'A usable tree must be returned');
  if (tree) probes.result = new WeakRef(tree);
  return { probes, tree, failure, input: { bytes: Buffer.byteLength(xml), sha256: hash(xml) } };
}

function prepare() {
  if (mode === 'live') {
    const first = parseLarge('success', compact);
    const firstHash = contentHash(first.tree);
    const second = parseLarge('success', !compact);
    return { probes: { first: new WeakRef(first.tree), second: new WeakRef(second.tree), ...second.probes },
      live: [first.tree, second.tree], hashes: [firstHash, contentHash(second.tree)], input: second.input };
  }
  const result = parseLarge(mode, compact);
  delete result.tree;
  return result;
}

(async () => {
  await collect();
  const empty = process.memoryUsage();
  const state = prepare();
  await collect();
  let liveContentPreserved;
  if (state.live) {
    assert.deepEqual(state.live.map(contentHash), state.hashes);
    assert.equal((compact ? state.live[0].root : state.live[0].elements[0]).up, state.live[0]);
    assert.equal((compact ? state.live[1].elements[0] : state.live[1].root).up, state.live[1]);
    assert.equal(state.probes.first.deref(), state.live[0]);
    assert.equal(state.probes.second.deref(), state.live[1]);
    liveContentPreserved = true;
    delete state.live;
    await collect();
  }
  const after = process.memoryUsage();
  const alive = Object.fromEntries(Object.entries(state.probes).map(([name, ref]) => [name, ref.deref() !== undefined]));
  console.log(JSON.stringify({ mode, entry, representation, versions: { node: process.versions.node, v8: process.versions.v8 },
    scope: 'isolated Node heap; WeakRef reachability after event-loop-separated GC rounds',
    lastParse: 'large synthetic XML; no subsequent parse', input: state.input, failure: state.failure,
    empty, after, heapDelta: after.heapUsed - empty.heapUsed, alive, liveContentPreserved }));
})().catch(error => { console.error(error); process.exitCode = 1; });
