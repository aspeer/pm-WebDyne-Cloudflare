# Tests

## Contract tests

- `t/00-load.t`: load every installed Perl module.
- `t/01-d1.t`: capability validation, prepared/bound calls, immutable
  statements, BLOB encoding/decoding, Future results, and structured errors.
- `t/02-kv.t`: KV capability validation, text/JSON/byte operations, metadata,
  listing, Future results, and structured errors.
- `t/03-r2.t`: R2 capability validation, object metadata, byte bodies, ranges,
  listing, single/multiple delete, Future results, and structured errors.
- `test-js/d1-host.test.mjs`: binding allow-list, capability lifecycle,
  prepared calls, BLOB conversion, result modes, registration, errors, and the
  npm extension wrapper.
- `test-js/kv-host.test.mjs` and `test-js/r2-host.test.mjs`: independent
  binding allow-lists, capability lifecycle, provider option mapping, byte
  limits, registration, and errors.
- `test-js/cloudflare.test.mjs`: combined lifecycle without merging the three
  service capabilities.
- `tools/check-package.mjs`: exact npm identity and 21-file public package
  allow-list.

## Integration gates

- `perl Makefile.PL && make test`
- `wdlint examples/htdocs/d1.psp`
- local Wrangler D1 schema initialization and query
- WebDyne/ZeroPerl request against local D1
- failed query followed by a successful warm-interpreter query
- repeated and concurrent request batches
- the same fixture against the non-production remote D1 database
- generated-Worker KV and R2 PSP smokes against isolated local Wrangler state
- the KV smoke against an isolated remote namespace, followed by key cleanup
  verification

## 2026-09-01 initial vertical slice

- MakeMaker: 16 Perl assertions passed.
- JavaScript adapter: 8 Node tests passed.
- Both PSP examples passed `wdlint` against the WebDyne development tree.
- Local D1 schema creation and direct query passed under Wrangler 4.127.1.
- The Perl 5.44 Worker returned the D1-backed HTML page and extensionless JSON
  API, inserted parameterized apostrophe/Unicode text plus NULL and BLOB data,
  rendered exact UTF-8 text, and returned exact BLOB bytes.
- A deliberate missing-table query returned HTTP 500 with a structured D1
  error; the same warm interpreter served the next request successfully.
- The automated smoke passed 24 concurrent D1-backed reads.
- Remote D1 `webdyne-cloudflare-m2` was created in region OC, initialized, and
  queried successfully. Its fixture BLOB was `0001FF` and the query was served
  by the BNE colo.
- An explicitly approved Wrangler remote preview passed the full smoke suite
  against that database: HTML, JSON, parameterized insert, failure/recovery,
  and 24 concurrent reads. The inserted row preserved `D1 bridge O'Brien π`,
  SQL `NULL`, and BLOB hex `0057656244796E65FF` exactly.
- The remote preview was stopped cleanly after verification. No persistent
  Worker was deployed.

## 2026-09-03 npm extension integration

- The exact eleven-file npm allow-list passed for
  `@webdyne/webdyne-cloudflare@1.0.0`.
- The independent `psp-WebDyne-Time` application installed local npm tarballs
  for the extension and `@webdyne/webdyne-zeroperl-5.44.0@1.0.0`.
- Its generated Worker statically imported the extension, mounted all five
  Perl modules below `/perl5/lib`, and generated the configured D1 binding.
- Wrangler's deployment dry run passed. A live local Worker rendered both the
  Perl server-local time and `SELECT datetime('now')` returned through D1.
- `app/app.psp` passed `wdlint` against the WebDyne development tree. Direct
  native `wdrender` is not applicable because the page deliberately requires
  a request-scoped Cloudflare D1 capability; the live Worker is its rendering
  gate.

## 2026-09-03 KV and R2 storage integration

- MakeMaker/Perl: 60 assertions passed across the D1, KV, and R2 modules.
- JavaScript: 21 tests passed across the combined lifecycle and all three
  modular service bridges.
- The ZeroPerl package's 12 application-builder tests passed, including exact
  generated `kv_namespaces` and `r2_buckets` configuration.
- `kv.psp` and `r2.psp` passed `wdlint` against the WebDyne development tree.
- A generated Perl 5.44.0 Worker passed KV text, metadata, listing, binary
  round-trip, and deletion against local Wrangler storage. The same Worker
  passed R2 binary put/get, HTTP/custom metadata, head, list, and deletion.
- The KV suite passed against isolated remote namespace
  `webdyne-cloudflare-kv-smoke`; a direct prefix listing after the suite was
  empty, proving cleanup.
- Remote R2 qualification is pending because Cloudflare returned error 10042:
  R2 is not enabled for the attached account. No service terms were accepted
  and no remote bucket was created.
