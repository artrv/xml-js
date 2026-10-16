# Fork notes

## Origin and scope

Upstream: [nashwaan/xml-js](https://github.com/nashwaan/xml-js), MIT,
Copyright (c) 2016-2017 Yousuf Almarzooqi. Fork:
[artrv/xml-js](https://github.com/artrv/xml-js). The original [LICENSE](LICENSE)
is unchanged.

Starting checkout: **f0376f265c4f299100fb4766828ebf066a0edeec** (`Removed
BitHound badge.`), package version **1.6.11**. The npm metadata for
`xml-js@1.6.11` points to that same commit. Every file in the
[npm tarball](https://registry.npmjs.org/xml-js/-/xml-js-1.6.11.tgz) matches the
starting checkout after CRLF/LF normalization; there is no source-code delta.
The tarball SHA-1 is `927d2f6947f7f1c19a316dd8eea3614e8b18f8e9`.
Its original `lib/xml2js.js` SHA-256 (including CRLF) is
`caa06cb7720756ab3b4e8bb5f4fbf720c499c58e90e7e11e820ad4fed19438ba`.

The fix moves mutable `options`, `currentElement`, and all dependent helpers and
SAX handlers into the exported call. The helper and handler bodies are unchanged.
No module-owned parsing context survives a return or exception; recursive calls
cannot overwrite the outer invocation. There is no result cleanup, dummy parse,
cache manipulation or forced GC in library code. Requested parent links belong
to the caller's result, including cycles.

This ports a previously validated vendored implementation. The per-call body
matches it apart from whitespace; its TypeScript imports, type wrapper and
formatting conventions are not part of this fork. The fork retains upstream's
CommonJS and ES5-style library source. `lib/js2xml.js`, other library modules and
the declarations remain unchanged. This change does not repair pre-existing
malformed-input semantics or serializer state.

| Files | Purpose |
| --- | --- |
| `lib/xml2js.js` | Per-call context; function bodies preserved |
| `test/xml-parser-*.cjs`, `test/helpers/*.cjs` | Synthetic semantics, nested calls, errors and ownership regressions |
| `test/package-smoke.cjs`, `test/browser-smoke.cjs`, `test/verify-package.cjs` | Installed entrypoints, types, CLI, bundles and clean consumer verification |
| `dist/xml-js.js`, `dist/xml-js.min.js` | Rebuilt distributed window scripts |
| `test/browse-jasmine/bundle.js` | Rebuilt existing browser test bundle; not published |
| `package.json`, `package-lock.json` | Fork links, scripts, publish allowlist, pinned SAX and dev-only upstream oracle |
| `.npmrc` | Preserve the inherited toolchain's peer dependency resolution with npm 10 |
| `yarn.lock` (removed) | Obsolete second lockfile; npm lock is authoritative |
| `.gitignore`, `README.md`, `FORK.md`, `CHANGELOG.md` | Generated-file exclusions and public fork documentation |

The inherited npm lockfile's root version was 1.6.10, although the manifest was
1.6.11. The manifest and npm lock identify the published fork as
`@artrv/xml-js@1.6.12`; the lockfile has been regenerated in npm's v3 format
without changing other resolved dependency versions. Its SAX was 1.2.4 and the
manifest allowed `^1.2.4`.
Both now pin **1.4.1**, matching the validated parser, the upstream comparison
and the installed tarball. The old Yarn lock only covered SAX `^1.2.1` and did
not represent this manifest. Use `npm ci` for reproducible development. Other
locked dependency versions are retained; no general upgrade or audit fix was run.
`xml-js-upstream` is a dev-only npm alias for exactly 1.6.11 and shares SAX 1.4.1.

The v3 lock exposes incompatible peer ranges inherited from the old toolchain:
`acorn-jsx` / `acorn-dynamic-import` request Acorn 6 and `ajv-keywords` requests
AJV 5, while the existing dependency tree resolves different versions at those
locations. npm 10's default peer resolution rejects a clean install. The project
`.npmrc` sets `legacy-peer-deps=true` to reproduce the previously tested tree
without upgrading dependencies. This development setting is not shipped in the
tarball and does not change the library's SAX dependency.

## Build and development

Use **Node 20+**, **npm 10**, and Chromium for the new diagnostics. The checked
toolchain is Node 20.19.0 / npm 10.8.2. `node:test`, `WeakRef` and diagnostic GC
are test requirements only: no runtime `engines` requirement was introduced and
the library itself does not use those facilities. Older runtime versions are
not certified by these checks.

From an independent checkout:

```sh
npm ci --ignore-scripts
npm ls sax webpack typescript
npm run build
npm run build:test-browser
npm test
npm run test:package
npm run test:browser
npm run verify:package
```

`npm test` runs the inherited Jasmine/Jest suites and type tests, then the new
lifecycle and ownership suites. Jest runs in one process for repeatable resource
use. The two inherited pending namespace tests remain pending. The old Jest
coverage configuration reports no instrumented sources; that is not a coverage
claim. The historical CI configurations have not been activated or validated for
this fork.

Webpack 3.10.0 and its existing plugins build successfully on the checked Node
version; no webpack upgrade, OpenSSL override or replacement bundler is needed.
The committed browser test bundle was stale relative to current library source,
so regeneration also incorporates already-existing upstream code and the locked
Browserify dependencies. No serializer source was edited.

`prepack` rebuilds the distributed bundles. The original `prepublish` test hook
was removed so a production install does not require development test tools.
Inherited push/deploy and coverage-upload scripts targeting upstream accounts
were removed; tests and packing do not publish or send coverage anywhere.

The publish allowlist contains the library, both dist scripts, root CommonJS
entrypoint, CLI, declaration entrypoint, license and these public documents. Tests,
fixtures, development tools, lockfiles and the upstream oracle are not shipped.
`main` is `lib/index.js`, `types` is `types/index.d.ts`, and there is no `browser`
field. The unchanged window bundle contract exports `xml2js`, `xml2json`, `js2xml`
and `json2xml` directly on `window`.

## Ownership diagnostics

```sh
npm run test:lifecycle
npm run test:ownership
node --expose-gc test/helpers/xml-parser-ownership.cjs . success
node --expose-gc test/helpers/xml-parser-ownership.cjs . malformed
node --expose-gc test/helpers/xml-parser-ownership.cjs . callback
node --expose-gc test/helpers/xml-parser-ownership.cjs . live
node --expose-gc test/helpers/xml-parser-ownership.cjs . success dist/xml-js.min.js
node --expose-gc test/helpers/xml-parser-ownership.cjs node_modules/xml-js-upstream success
```

Each diagnostic runs in its own process on synthetic XML containing 12,000
repeated elements. The large input is always the last parse, including in `live`
mode. Both compact and noncompact modes are covered by the regression suite.
Weak references observe the document root, a descendant, result, callback,
callback-owned payload and supplied options after references are released.
Malformed XML and callback exceptions exercise partially built trees. The live
case holds two independent large results across collection, checks their content
and parent links, then releases both and checks collection again.

The diagnostic separates GC rounds with event-loop turns and does not dereference
targets during collection. The upstream negative control must retain the tree,
callback and payload, while the corrected parser must release every probe.
`package-smoke.cjs` repeats ownership checks for installed main, direct parser and
both dist entrypoints. The bundle ownership probes use a Node VM with the
unchanged window bundle; a separate real Chromium test checks browser execution.

RSS and heap deltas are diagnostic context, not proof of ownership or a portable
performance promise. No FinalizationRegistry timing is used as evidence. A prior
large-document measurement motivated the fix; it is not a fixed per-document
saving. These synthetic results do not claim a new measurement on that document.
If a reachability assertion fails on another engine, investigate it; do not make
the test pass by parsing a small document or clearing the module cache.

## Tarball verification

`npm run verify:package` performs `npm pack --dry-run`, builds a real tarball,
checks its file list, and installs it in a newly created OS temporary consumer
outside the checkout. It copies standalone probes there and checks the installed
package's four APIs, parent links, reentrancy, error recovery, CLI, declarations
and ownership. The compiler comes from the development toolchain; its imports
resolve to the installed package. No library imports resolve to the source tree.
The script verifies installed source/bundle bytes and prints the package root,
dependency tree, tarball SHA-256 and temporary directory for inspection.

The real browser test serves the installed dist files over loopback HTTP and
loads each using an ordinary script tag. Set `CHROME_BIN=/path/to/chromium` if it
is not named `chromium`. `CHROME_NO_SANDBOX=1` is available only for isolated test
environments that require it; it is not needed for the checked run. Browser
checks fail visibly if the executable cannot run. They cover Chromium, not a
cross-browser matrix. Retained temporary consumers can be deleted after review.

These are **local tarball checks**, not validation of a registry publication.

## Local verification recorded on 2026-10-16

The following checks ran on Linux in a standalone copy outside the original
checkout, without sibling projects: Node **20.19.0**, npm **10.8.2**, SAX
**1.4.1**, webpack **3.10.0**, TypeScript **3.2.2**, Chromium
**154.0.8037.57** (headless).

| Command / check | Result |
| --- | --- |
| `npm ci --ignore-scripts` | PASS; existing dependency versions retained except the documented SAX pin and upstream oracle |
| `npm test` | PASS; Jasmine 2,361 active specs and Jest 2,361 tests, with 2 inherited pending/skipped cases in each; existing type tests pass |
| Lifecycle regressions | PASS, 23 tests including upstream equality, nested success/failure, callback errors and recovery |
| Ownership regressions | PASS, 8 cases; upstream retains root/callback/payload and the fork releases all observed objects; two caller-held results survive before release |
| `npm run build`, `npm run build:test-browser` | PASS with the existing webpack/Browserify toolchain |
| `npm run verify:package` | PASS: dry run, real pack, publish file list and clean installation of `@artrv/xml-js@1.6.12` |
| Installed tarball API / CLI / types | PASS for four APIs, root/main entrypoints and both dist files; declaration checks respect the existing `Element \| ElementCompact` return type |
| Installed tarball ownership | PASS, 16 isolated cases across main, direct parser and two dist bundles |
| Installed tarball in Chromium | PASS for both script-tag bundles; all four APIs, nested parsing, parent links and recovery |

These are checks of this fork and its local tarball, independent of the prior
vendored implementation's results. Hosted CI, older Node runtimes and other
browsers remain **NOT_RUN**. The two inherited skipped tests were not converted
to passes. The separate registry comparison below does not turn these local
installation tests into registry installation tests.

## Published package comparison on 2026-10-16

The npm registry records `@artrv/xml-js@1.6.12` as published at
**2026-10-16T12:45:26.415Z**. Its
[registry tarball](https://registry.npmjs.org/@artrv/xml-js/-/xml-js-1.6.12.tgz)
was downloaded and compared with the locally tested implementation in commit
`9ee338d785f4c8bd9b77e8df7ac8724235d1f281`.

- All 13 distributed library, browser bundle, CLI and declaration files match
  byte for byte. `package.json` also matches, including SAX **1.4.1**.
- Only `README.md`, `FORK.md` and `CHANGELOG.md` differ within the published
  tarball; the repository versions correct publication status and documentation.
- `.npmrc`, `package-lock.json` and the browser test bundle are not published.
  The development-install adjustment does not affect package consumers.
- Registry tarball SHA-256:
  `70c21590fe3c0b2c86ef4adc415bc261ec501604bfb28b5d6546795d126b6ff4`.

The published package therefore contains the tested parsing-state fix. This
check downloaded and compared the archive; a fresh registry installation and
execution of API, ownership and browser probes against that installation are
**NOT_RUN**. The full test results above belong to the local tarball.

No new npm version is needed for the development setup and documentation
corrections. Updating documents inside the registry tarball would require a new
version; the existing 1.6.12 artifact cannot be replaced.

## Checklist for future releases

1. Confirm the package name `@artrv/xml-js`, control of the npm scope and an unused
   release version. Version **1.6.12 is already published** and cannot be reused.
   GitHub ownership alone does not establish npm authorization. Update
   manifest/lock metadata, installation examples and changelog together.
2. Review the patch and license, run the commands above, inspect the tarball file
   list and test the exact final name/version in the temporary consumer. Record
   its checksum and the source commit used to build it.
3. Confirm the registry, scope permissions and authentication. For interactive
   authentication use `npm login --registry=https://registry.npmjs.org/`, then
   `npm whoami --registry=https://registry.npmjs.org/`. Follow the current
   [npm login documentation](https://docs.npmjs.com/cli/v11/commands/npm-login/).
   Direct public publication requires account 2FA or an appropriate granular
   token with bypass 2FA; check the current
   [scoped public package requirements](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).
4. Only after approving the final identity and artifact, publish the reviewed
   tarball using `npm publish /absolute/path/to/reviewed.tgz --access public
   --registry=https://registry.npmjs.org/`. Explicit public access is necessary
   for a new scoped public package. A published name/version cannot be reused;
   see [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/).
5. Install the exact published name/version into another clean consumer and repeat
   API, ownership, types and browser probes against that installation. Check the
   registry integrity and public visibility. Only then describe registry
   verification as complete. Link the tested source commit and npm version to
   a corresponding Git tag/release, with the checksum and release notes.

The npm instructions were checked against official documentation on 2026-10-16;
recheck them at release time. Publication of `@artrv/xml-js@1.6.12` is confirmed;
the maintainer's current authentication and permissions have not been inspected.
Downstream dependency migration and removal of downstream vendored code remain
separate later steps.
