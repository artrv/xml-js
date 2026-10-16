'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

module.exports = function probeOwnership(root, mode, entry = 'main', representation = 'noncompact') {
  const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'xml-parser-ownership.cjs'),
    root, mode, entry, representation], { encoding: 'utf8', timeout: 30000 });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
};
