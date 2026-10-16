'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

module.exports = function loadApi(root, entry = 'main') {
  root = fs.realpathSync(root);
  if (entry.startsWith('dist/')) {
    // Exercise the shipped window bundle unchanged, with no Node loader in it.
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, entry), 'utf8'), context, { filename: entry });
    return context.window;
  }
  const loaded = require(entry === 'main' ? root : path.join(root, entry));
  return typeof loaded === 'function' ? { xml2js: loaded } : loaded;
};
