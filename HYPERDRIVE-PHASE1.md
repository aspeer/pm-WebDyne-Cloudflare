# Hyperdrive phase 1 investigation

Status: phase 1 connectivity and graceful lifecycle proof completed, including
actual client cancellation on an authenticated deployed Worker. Ready to use as
the foundation for phase 2; production failure/limit qualification remains.

## Runtime inspected

Installed `@webdyne/webdyne-zeroperl` 1.0.9 from the existing wine-cellar
application, containing Perl 5.44.0 and Wrangler 4.127.1. This is the packaged
runtime, not a newly compiled development build.

## First finding: asynchronous cleanup is not awaited

The installed `js/runtime/extensions.js` extension manager invokes each cleanup
with `cleanup()` and discards its return value. The installed
`js/runtime/webdyne-runtime.js` similarly calls `releaseExtensions()` without
awaiting its result when the session finishes. Its transport-construction error
path also calls release synchronously.

The Cloudflare provider already passes `dispatch.completion` to
`context.waitUntil()`. That is a useful foundation, but asynchronous extension
cleanup is not presently included in that completion Promise.

The Cloudflare extension in this repository has another synchronous cleanup
aggregator in `js/cloudflare.js`. Production Hyperdrive integration needs to
account for both layers.

## Options to discuss

1. Prove normal database operations on the unchanged runtime, explicitly awaiting
   rollback/disconnect in Perl before returning. This keeps the connectivity spike
   small, but does not prove automatic cleanup on abort or application failure.
   Request capability revocation can still be synchronous.
2. First add Promise-aware cleanup to a development ZeroPerl package and the
   extension lifecycle, then run the database prototype. This gives the prototype
   the intended cleanup model but broadens the first milestone. No new XS module
   appears necessary for this specific change.

Decision: the user prioritizes long-term reliability and authorizes ZeroPerl
changes. Proceed with option 2. Explicit disconnect alone is not sufficient.

## ZeroPerl source change

Repository: `/Users/aspeer/Development.github/aspeer-zeroperl`.
Branch: `codex/hyperdrive-support`.

The extension manager now returns an attachment Promise, awaits cleanup after
partial attachment failure, and invokes all release hooks before waiting for
their asynchronous completion. A shared release Promise makes repeated calls
idempotent. A configurable 10-second default deadline aborts the signal passed
to cleanup hooks; extensions must implement forced closure themselves.

Runtime dispatch now includes awaited cleanup in its completion Promise and
retains both application and cleanup failures. The Cloudflare provider already
registers that completion with waitUntil. Direct consumers of the exported
extension manager must now await attachment and release; ordinary synchronous
extension callbacks remain supported. The Cloudflare package's own cleanup
aggregator still needs adaptation when the Hyperdrive host is integrated.

Validation: all 60 ZeroPerl JavaScript tests passed, including five new focused
lifecycle tests. Worker sockets, aborts during database I/O, interpreter recycling,
and real PostgreSQL transactions initially remained untested; see the live
results below for the current state.

## Development-package input finding

The checkout declares runtime 1.0.9 but its local raw build artifacts stop at
1.0.8. The existing `pack:dev` command requires the exact runtime's manifest,
WASM, reactor, complete prefix inventory, and attribution evidence. The GitHub
release `aspeer-zeroperl_1.0.9` exposes licence archives only, not those build
inputs. A published installed 1.0.9 npm package is available locally.

Resolved with `npm run pack:dev -- --from-npm`. The new path downloads the exact
official Perl-specific package, verifies registry SHA-512 integrity plus WASM
and runtime-notice manifest hashes, and overlays portable source files. It keeps
the released bridge, embedded inventory, dependency metadata, licences and WASM.
Two new tests reject integrity, identity and artifact-hash mismatches. It does
not rebuild Perl or XS and is explicitly unsuitable for testing ABI changes.

The tested private tarball is:

`/Users/aspeer/Development.github/aspeer-zeroperl/dist/dev/webdyne-webdyne-zeroperl-5.44.0-1.0.10-dev.20260912071420628.g88341fd6377a.tgz`

Runtime: 1.0.9, Perl 5.44.0. WASM SHA-256:
`c99b0f5a000bd89ceb1dc3540224363db6a2c67cc3992f680c1765aeeedaea51`.
Tarball: 4,841,564 bytes. Source overlay revision:
`88341fd6377ae21a08f0b673e33344fa7ff51cc0`, with working-tree changes included.

## Live prototype results

Sources and reproduction instructions are in `prototypes/hyperdrive/`.
Staged application: `/private/tmp/webdyne-hyperdrive-phase1`.
Driver: `pg@8.16.3`; Wrangler: 4.127.1; compatibility date: 2026-09-12.

Used `wrangler dev --remote`, exercising the real Hyperdrive configuration
`df3fabff9d60423bb31e3a98cb28b032`. Read-only configuration inspection confirmed
database `hyperdrive_test`, PostgreSQL, and caching disabled before testing.

Passed through Perl WASM, not merely JavaScript:

- Bound Unicode including quotes, Japanese text and emoji; SQL NULL; BYTEA with
  zero/high bytes; BIGINT above JavaScript's safe integer range; exact NUMERIC.
- Reads from the existing PostgreSQL fixture.
- BEGIN, INSERT, read-your-write, ROLLBACK, and a subsequent zero-count query,
  as separate awaited Perl operations on one connection.
- Automatic rollback of a deliberately unfinished transaction after normal
  application completion; a fresh independent connection observed no rows.
- Automatic rollback and connection closure after an intentional Perl exception.
- Rejection of the previous request's expired capability on a subsequent request.

The final core run reported 3 connections opened, 3 closed, 3 scopes attached,
3 released, 3 lifecycle rollbacks and 2 rejected stale capabilities. No forced
closure occurred. The expected application-failure endpoint returned HTTP 500;
its lifecycle completion rejected while cleanup still completed.

Final core smoke output: `/private/tmp/hyperdrive-core-results.jsonl`.
ZeroPerl suite output: `/private/tmp/hyperdrive-runtime-tests.log`.

Bundle dry-run: approximately 4,673 KiB gzip for the prototype versus 4,632 KiB
for the same runtime/archive baseline without the driver/extension. The added
compressed cost is about 41 KiB; the WASM dominates overall size. Baseline and
prototype use the same application archive, so this isolates principally the
JavaScript adapter/driver cost. Small fixture responses reached 291 encoded bytes.
The prototype's 1 MiB/1000-row limit is post-buffer and does not establish a peak
memory bound. Larger-result streaming/limits are still production design work.

## Client-disconnect test environment: resolved

Remote preview buffered the small streaming response, delivering the first
visible bytes only after the slow query completed. A second attempt used a
separate metrics request to detect the slow query, but did not reliably observe
its active state. Cross-request isolate-local counters are not a dependable
coordination mechanism. Neither attempt qualifies cancellation during database I/O.

The preview experiment was not counted as a passed test. It has been replaced
by the deployed harness described below; the ordinary preview smoke retains only
its verified core checks.

The user authorized a temporary authenticated deployment. The separate deployed
entrypoint requires a random 256-bit bearer token on every route, uses constant-time
comparison, and rejects requests after a one-hour expiry. The unauthenticated
preview wrapper was not deployed. Missing/incorrect credentials returned HTTP 401.

Deployed Worker: `webdyne-hyperdrive-probe-7b150aac`.
Version: `f2aace24-1b36-4fbc-b02e-1bff0c122e73`.
The Worker was deleted after testing; a follow-up Cloudflare API check returned
10007, confirming it no longer exists. The local secret file was also removed.

Evidence is saved in `prototypes/hyperdrive/results/deployed.json`. The deployed
runner uses request UUIDs and independent PostgreSQL connections, not isolate-local
counters, to correlate observations. It writes one diagnostic row per run in slot
9000 of the existing test table and removes that row after collecting results.

Passed scenarios:

| Scenario | Evidence |
| --- | --- |
| Normal Perl request | Typed queries succeeded; unfinished transaction rolled back; client closed; completion fulfilled. |
| Perl exception | Completion rejected; rollback and client closure still completed. |
| Client cancellation during database I/O | Independent pg_stat_activity read showed `active` / `PgSleep`; original Worker Request.signal observed abort before the query finished; rollback and closure completed. |
| Fresh request after cancellation | Typed query and cleanup succeeded; completion fulfilled. |

For the cancellation run, abort was observed at 07:36:55.552 UTC, the query
finished at 07:37:00.531 UTC, and rollback/client closure completed at
07:37:00.555 UTC. This demonstrates graceful draining followed by rollback and
closure, approximately 5.003 seconds after abort. It does not demonstrate immediate
SQL cancellation. The extension cleanup deadline begins when release starts;
it is not a total deadline measured from client disconnect.

All four runs had zero visible application rows after cleanup. Their four
autocommitted diagnostic rows were deleted individually by run token, and absence
was verified before Worker removal. Existing seed rows were untouched.

Interpreter recycling with outstanding database I/O, deadline-driven forced
socket closure, and database/network failures remain unqualified. Graceful
client-disconnect cleanup is now supported by the deployed test evidence.
The production host and the Cloudflare package's nested cleanup aggregator still
belong to later implementation; the isolated prototype uses the new runtime
extension manager directly.

## Preserved state

Existing MANIFEST/TEST.md changes and the PostgreSQL fixture were left untouched.
No credentials were printed. Application test writes were rollback-only, using
unique run tokens; the deployed diagnostic records were separately committed,
collected and deleted. Existing seed rows and Hyperdrive configuration were unchanged.
Dependencies were installed only into the isolated prototype application.
Remote preview was stopped after the final core run. The subsequent temporary
authenticated Worker has been deleted. ZeroPerl changes remain uncommitted on the
dedicated support branch.

The prototype dependency audit reports four high-severity package entries caused
by the existing Wrangler -> Miniflare -> sharp dependency chain (one underlying
sharp/libheif advisory); none is attributed to pg. Pinned runtime tooling was not
upgraded as part of this prototype.
