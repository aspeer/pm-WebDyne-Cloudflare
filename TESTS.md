# Tests

## Contract tests

- `t/00-load.t`: load every installed Perl module.
- `t/01-d1.t`: capability validation, prepared/bound calls, immutable
  statements, BLOB encoding/decoding, Future results, and structured errors.
- `test-js/d1-host.test.mjs`: binding allow-list, capability lifecycle,
  prepared calls, BLOB conversion, result modes, registration, and errors.

## Integration gates

- `perl Makefile.PL && make test`
- `wdlint examples/htdocs/d1.psp`
- local Wrangler D1 schema initialization and query
- WebDyne/ZeroPerl request against local D1
- failed query followed by a successful warm-interpreter query
- repeated and concurrent request batches
- the same fixture against the non-production remote D1 database

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
