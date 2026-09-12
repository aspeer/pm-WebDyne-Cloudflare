# Hyperdrive integration and release qualification

Generator integration and live qualification against the rebuilt release runtime
completed on 2026-09-12. The release targets are extension 1.3.0 and ZeroPerl 1.0.11.
npm release approval remains a manual step for the package owner.

## Configuration and packaging

Applications declare `hyperdriveBindings` in the existing extension options and
map `{ binding, id }` resources under `webdyne.cloudflare.hyperdrive`. ZeroPerl
selects the PostgreSQL provider from the extension manifest, adds nodejs_compat,
and emits Wrangler's Hyperdrive resources. Existing user-owned Wrangler files
remain authoritative. Unknown resource fields, duplicate/invalid bindings,
invalid IDs and ambiguous provider variants are rejected.

The default D1/KV/R2 provider does not import pg or require Node compatibility.
The PostgreSQL provider uses pinned pg 8.16.3. Native MakeMaker installs all six
Hyperdrive modules; npm's inventory check verifies 50 shipped files. PostgreSQL
credentials stay in the Worker binding, or in the private local-development
environment. They are never included in application package.json.

ZeroPerl now awaits asynchronous extension cleanup, revokes request capabilities
before waiting and bounds teardown. Failed application completion rejects its
completion promise while preserving the public error response. The extension
requires an explicit runtime capability marker for that contract. No new XS or
Perl modules were necessary; the release workflow nevertheless rebuilds WASM from
the tagged source.

The inventory example in examples/hyperdrive demonstrates bound queries and hash
rows. Its README includes an atomic stock/booking update in a transaction callback.

## Verification

The extension passes 283 native Perl assertions and 51 JavaScript tests. Runtime
integration passes 64 JavaScript tests and 13 Python licence/tooling checks. Both
standalone runtime lifespan suites pass against the verified official 1.0.9 WASM
with current JavaScript/runner sources, including intentionally rejected startup.

The generated application was installed into an empty temporary directory using
local runtime and extension tarballs. The real CLI build/check and Wrangler dry
runs passed. No generated Worker source edits or fixture extension manifest were
needed. The separate authentication wrapper is confined to the qualification app.

The final development-runtime live run completed at 09:20:37 UTC. All six cases
and four concurrent recovery requests passed:

- Phase-3 CRUD plus explicit joins, RETURNING, bound injection-like text, exact fixture
  types, statement reuse, constraints and explicit/callback transactions.
- Connection, row and byte limits, forced socket closure and a query deadline.
- Termination of the test's own PostgreSQL backend, followed by a fresh read.
- Stale-handle rejection, failed-request rollback and replacement of a poisoned
  interpreter, exercised sequentially within the same Worker isolate.
- Client disconnect while pg_stat_activity confirmed an active PgSleep query.
  Independent verification observed rejected completion, an aborted request and
  no transaction writes, then verified deletion of the completion evidence row.

Hyperdrive caching was confirmed disabled; its origin connection limit was five.
All probe writes used unique run tokens. Every completed preliminary and final
case deleted its token's rows and independently verified absence. The fixture
schema, seeds and other users' rows were untouched.

Final development identity and evidence are in
prototypes/hyperdrive-qualification/results. The runtime archive uses verified
official 1.0.9 WASM with the updated source overlay; it is not evidence about newly
compiled release bytes. Release-artifact qualification is recorded separately.

## Findings and limits

The Workers pg socket adapter needed an additional closure observation: a rejected
Workers socket.closed promise can emit an error without pg's expected end event.
Forced cleanup observes actual socket closure as well as pg's normal end event.
This narrow adapter uses a pg-cloudflare internal socket field and is covered by a
focused regression test; requalify it when upgrading the pinned driver. Deadline
and overflow errors settle before forced destruction, preserving the primary error.
Transport codes such as EPIPE are redacted rather than mistaken for SQLSTATE.

The initial cancellation fixture incorrectly treated ordinary buffered PAGI HTTP
as streaming. The corrected fixture uses SSE and observes the active query before
disconnecting. No production HTTP transport change was required.

Very short 1.5-second deadlines caused intermittent subsequent-query failures
after a deliberately timed-out origin sleep. Closing an edge client does not
confirm immediate cancellation at the origin pool. The final fixture uses a
five-second query deadline against a six-second sleep, and independent verification
allows 15 seconds. Production defaults remain 10 seconds for queries and five for
connection/cleanup. No automatic write or transaction retries are introduced.

Unknown COMMIT outcomes, rollback failure, delayed/overlapping native Futures and
Perl Future cancellation are covered by deterministic injected tests. A real
ambiguous COMMIT was not deliberately induced. Live client disconnect is covered,
but does not establish every platform failure mode. Result limits bound collected
rows and encoded data; pg may allocate an individual large field first. This is
not a peak-memory guarantee or a load/performance certification.

## Build handling

The first ZeroPerl candidate, 1.0.10, compiled successfully but failed an older
startup smoke test that expected successful completion for an intentional startup
failure. The test now checks both the HTTP 500 and rejected completion. A new
immutable 1.0.11 tag was created; 1.0.10 was not staged or approved. The companion
standalone lifespan test was also updated and passed.

No licence evidence changes were required during local qualification. GitHub's
ZeroPerl build, licence checks and staging all passed in
[run 34684893846](https://github.com/aspeer/zeroperl/actions/runs/34684893846).
Both @webdyne/webdyne-zeroperl and @webdyne/webdyne-zeroperl-5.44.0 version 1.0.11
are staged. Staging does not approve or complete npm publication.

## Rebuilt release artifact

The exact CI npm archive was downloaded and checked against its recorded SHA-512
integrity. Its manifest identifies clean source
8cdad5a70698256cb5e7789ba70b03abf557493b; the packaged WASM matches its manifest's
SHA-256. The real generated-app check and authenticated deployment then passed
using that archive, without a development source overlay.

All six live cases and four concurrent recovery reads passed again, completing
at 09:22:23 UTC. Independent cleanup checks passed for every token. Final Worker
version: 99a75959-accf-4951-a854-a8731a54470f. Deployment size was 14,386.82 KiB raw,
4,701.75 KiB gzip; reported startup was 30 ms. These are deployment observations,
not application latency or throughput guarantees.

The release results and source/artifact hashes are saved under
prototypes/hyperdrive-qualification/results. The temporary Worker
webdyne-hyperdrive-qual-6909cd5f was removed after qualification, together with
its local bearer-secret file. Cloudflare package CI qualifies and stages the
committed extension source independently; the owner approves npm publication.
