'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const checkApi = require('./helpers/api-contract.cjs');

const root = fs.realpathSync(path.resolve(process.argv[2] || path.join(__dirname, '..')));
const chrome = process.env.CHROME_BIN || 'chromium';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'xml-js-browser-'));
(async () => {
  let html;
  const server = http.createServer((request, response) => {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(html);
    } else if (['/xml-js.js', '/xml-js.min.js'].includes(request.url)) {
      response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      response.end(fs.readFileSync(path.join(root, 'dist', request.url.slice(1))));
    } else { response.statusCode = 404; response.end(); }
  });
  try {
  const version = spawnSync(chrome, ['--version'], { encoding: 'utf8', timeout: 10000 });
  assert.ifError(version.error);
  assert.equal(version.status, 0, version.stderr);
  console.log(version.stdout.trim());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  for (const bundle of ['xml-js.js', 'xml-js.min.js']) {
    // Serve only the installed bundle; the browser gets no Node modules or source fallback.
    html = `<!doctype html><meta charset="utf-8"><body>RUNNING
<script src="./${bundle}"></script><script>
try {
  (${checkApi.toString()})(window);
  document.body.textContent = 'XML_JS_BROWSER_PASS';
} catch (error) { document.body.textContent = 'FAIL: ' + error.stack; }
</script>`;
    const args = ['--headless', '--disable-gpu', '--no-first-run', '--dump-dom',
      '--user-data-dir=' + path.join(temporary, 'profile'), 'http://127.0.0.1:' + server.address().port + '/'];
    if (process.env.CHROME_NO_SANDBOX === '1') args.unshift('--no-sandbox');
    const run = await new Promise((resolve, reject) => {
      const child = spawn(chrome, args, { timeout: 30000 });
      let stdout = '', stderr = '';
      child.stdout.on('data', data => { stdout += data; });
      child.stderr.on('data', data => { stderr += data; });
      child.on('error', reject);
      child.on('close', status => resolve({ status, stdout, stderr }));
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /<body>XML_JS_BROWSER_PASS<\/body>/, run.stdout + run.stderr);
    console.log('BROWSER PASS:', bundle);
  }
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  console.log('Verified package root:', root);
})().catch(error => { console.error(error); process.exitCode = 1; });
