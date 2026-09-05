# Tests

## Contract tests

- `t/00-load.t`: load every installed Perl module.
- `t/01-d1.t`: capability validation, prepared/bound calls, immutable
  statements, BLOB encoding/decoding, Future results, and structured errors.
- `t/02-kv.t`: KV capability validation, text/JSON/byte operations, metadata,
  listing, Future results, and structured errors.
- `t/03-r2.t`: R2 capability validation, object metadata, byte bodies, ranges,
  listing, single/multiple delete, Future results, and structured errors.
- `t.js/d1-host.test.mjs`: binding allow-list, capability lifecycle,
  prepared calls, BLOB conversion, result modes, registration, errors, and the
  npm extension wrapper.
- `t.js/kv-host.test.mjs` and `t.js/r2-host.test.mjs`: independent
  binding allow-lists, capability lifecycle, provider option mapping, byte
  limits, registration, and errors.
- `t.js/cloudflare.test.mjs`: combined lifecycle without merging the three
  service capabilities.
- `t.js/check-package.mjs`: exact npm identity and 33-file public package
  allow-list.

- `t/04-regressions.t`: blob call forms, false/empty byte values, wide-character
  rejection, malformed capabilities/responses, and D1 envelope-like column names.
- `t.js/regressions.test.mjs`: failed-registration retry, KV read limits, and
  cancellation of oversized unread R2 bodies.

- `t.js/smoke-cleanup.test.mjs`: cleanup failures produce nonzero smoke exits.

## Integration gates

Batch coverage is in `t/05-d1-batch.t` and `t.js/d1-batch.test.mjs`.
The D1 smoke also calls `t/fixtures/app/d1-batch.psp`, using a dedicated table
from `t/fixtures/schema.sql`. Restage and initialize a fresh smoke application
when updating from an older fixture set.

- `perl Makefile.PL && make test`
- `wdlint` for the dedicated PSP fixtures under `t/fixtures/app`
- local Wrangler D1 schema initialization and query
- WebDyne/ZeroPerl request against local D1
- failed query followed by a successful warm-interpreter query
- repeated and concurrent request batches
- the same fixture against the non-production remote D1 database
- generated-Worker KV and R2 PSP smokes against isolated local Wrangler state
- the KV smoke against an isolated remote namespace, followed by key cleanup
  verification

Smoke staging reads only `t/fixtures/app` and `t/fixtures/schema.sql`.
Use `t.js/prepare-storage-smoke.mjs --runtime-tarball /path/runtime.tgz
--extension-tarball /path/extension.tgz --destination /new/directory`, then
install dependencies, build, initialize local D1 using the generated Wrangler
configuration and start the generated Worker. All three services are staged by
default; `--services d1`, `kv`, `r2`, or a comma-separated subset narrows it.
The destination must not already exist. Run `npm run smoke:d1 -- BASE_URL`,
`smoke:kv`, and `smoke:r2` from this repository against that Worker.

Smoke fixtures deliberately expose test actions and belong only in isolated
test environments. KV/R2 cleanup failures fail the smoke instead of being
silently ignored. Do not point these tests at the user examples.
Example lint/render checks are manual authoring validation, not smoke tests.

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

## 2026-09-05 style, layout and correctness review

- Native Perl 5.42.2: 124 assertions passed across five files.
- JavaScript: 28 tests passed; MakeMaker runs the Perl suite once and the
  JavaScript suite once.
- All eight PSP files passed wdlint. Examples were validated separately by
  manual local rendering, including the D1 JSON route and KV/R2 greeting forms.
- Dedicated local Perl 5.44 Worker fixtures passed all D1, KV and R2 smoke
  suites. D1 included the type/base64-column regression, error/recovery and
  24 concurrent reads. KV/R2 cleanup completed successfully.
- npm package allow-list: 33 files including API sidecars. MakeMaker
  distcheck passed after excluding existing generated dist artifacts.
- Wrangler deployment dry-runs passed for independent fixture and example
  applications. No remote resources were changed or Worker deployed.
- No interpreter rebuild, additional dependency, older-Perl rebuild or
  minimum-supported-native-Perl qualification was performed.
- The existing embedded CGI::Simple::Cookie emits two `lc` ambiguity warnings
  during cold initialization. These are recorded in BACKLOG.md; service and
  example requests still completed successfully.

## 2026-09-05 D1 batch implementation

- Native Perl 5.42.2: 159 assertions across six files; JavaScript: 32 tests.
- Compile checks and batch PSP lint passed. MakeMaker test/distcheck, npm
  package allow-list and generated Worker deployment dry-run passed.
- Local Perl 5.44 Worker passed the original D1 smoke, 24 concurrent reads,
  and eight concurrent batch sequences with independently keyed rows.
- Each batch sequence checked two writes plus a read, ordered metadata,
  Unicode/NULL/empty/BLOB values, rollback after a middle constraint failure,
  and a subsequent successful batch in the same request.
- Direct local D1 inspection found zero batch-test rows after cleanup.
- No remote qualification, release or interpreter rebuild was performed.
