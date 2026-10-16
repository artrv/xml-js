# Changelog

## Unreleased

- Update repository documentation with the confirmed npm publication and scoped
  installation examples. The published runtime code is unchanged.
- Keep development installs reproducible with npm 10 via `.npmrc`; this setting
  and the updated browser test bundle are not part of the published package.

## 1.6.12 — 2026-10-16

- Isolate XML parsing state and SAX handlers within each `xml2js` invocation.
  Completed and failed parses no longer leave the last tree or callback-owned
  data reachable through the parser module. Nested parses have independent state.
  Caller-owned results and parent links remain intact; `xml2json` shares the fix.
- Add synthetic compatibility, error, reentrancy and ownership regressions with
  an unchanged upstream negative control. Verify CommonJS, browser bundles,
  TypeScript declarations and clean local tarball installations.
- Pin SAX to 1.4.1 to match the validated implementation and regenerate bundles.
  Preserve the original API, CommonJS source, serializer and MIT attribution.

Published as [`@artrv/xml-js@1.6.12`](https://www.npmjs.com/package/@artrv/xml-js/v/1.6.12).
The downloaded registry tarball's runtime files and manifest match the locally
verified implementation; its documentation predates the repository corrections
listed under Unreleased.
