# Changelog

## Unreleased

- Isolate XML parsing state and SAX handlers within each `xml2js` invocation.
  Completed and failed parses no longer leave the last tree or callback-owned
  data reachable through the parser module. Nested parses have independent state.
  Caller-owned results and parent links remain intact; `xml2json` shares the fix.
- Add synthetic compatibility, error, reentrancy and ownership regressions with
  an unchanged upstream negative control. Verify CommonJS, browser bundles,
  TypeScript declarations and clean local tarball installations.
- Pin SAX to 1.4.1 to match the validated implementation and regenerate bundles.
  Preserve the original API, CommonJS source, serializer and MIT attribution.

The package is prepared as `@artrv/xml-js@1.6.12` with public npm publication
configured. Registry publication and scope authorization remain unverified;
this entry does not announce a completed release.
