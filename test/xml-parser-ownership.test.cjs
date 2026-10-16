'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const probe = require('./helpers/probe-ownership.cjs');
const baselineRoot = path.dirname(require.resolve('xml-js-upstream/package.json'));
const candidateRoot = path.resolve(__dirname, '..');

for (const representation of ['noncompact', 'compact']) {
  for (const mode of ['success', 'malformed', 'callback', 'live']) {
    test(`ownership: ${mode}, ${representation}; upstream negative control`, () => {
      const baseline = probe(baselineRoot, mode, 'main', representation);
      const candidate = probe(candidateRoot, mode, 'main', representation);
      assert.equal(baseline.alive.root, true, 'Probe must detect original parser retention');
      assert.equal(baseline.alive.callback, true);
      assert.equal(baseline.alive.payload, true);
      for (const [name, alive] of Object.entries(candidate.alive)) assert.equal(alive, false, `${name} is retained`);
      if (mode === 'live') {
        assert.equal(baseline.liveContentPreserved, true);
        assert.equal(candidate.liveContentPreserved, true);
      }
    });
  }
}
