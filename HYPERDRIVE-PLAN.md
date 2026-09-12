# WebDyne::Cloudflare::Hyperdrive implementation plan

Status (2026-09-12): phases 1 through 5 are implemented and qualified, including
the rebuilt ZeroPerl 1.0.11 release archive. See HYPERDRIVE-PHASE4-5.md for
configuration, qualification findings and release details. npm publication remains
subject to the owner's manual approval; earlier phase reports retain their
historical evidence.

## Objective and agreed direction

Enable WebDyne::PAGI applications running in ZeroPerl WASM Workers to perform
PostgreSQL CRUD through Cloudflare Hyperdrive. Use a small asynchronous Perl API
with DBI-style method names and argument positions, ordinary hashes/arrays, bound
parameters, and transactions. Target inventory, customer, order, and club-event
applications. Do not require an ORM, Moose, or application model classes.

Build the execution layer so a future genuine DBI driver can reuse it. The first
release is DBI-inspired, not DBI-compatible. PostgreSQL is the only initial engine.
Runtime changes are allowed if necessary; first attempt the existing ZeroPerl
runtime without new XS dependencies.

## Architecture

    Async Perl API                       Future DBI driver
           |                                    |
           +---- shared Perl transport/codec ---+
                              |
                  versioned JSON host protocol
                              |
                   Hyperdrive JavaScript bridge
                              |
                   request-owned pg Client
                              |
                    Hyperdrive -> PostgreSQL

Follow the existing extension registration and binding allow-list conventions.
Expose `webdyne.cloudflare.hyperdrive` in the PAGI scope with an opaque capability,
protocol version, and allowed binding names. Keep binding credentials in JavaScript.
Validate capability, binding, connection ownership, and operation on every host call.

Use the JavaScript `pg` driver, with an exact tested version selected during the
prototype. Cloudflare currently recommends this driver and its detailed example
specifies at least 8.16.3. Verify against the pinned Wrangler and selected Worker
compatibility date rather than changing runtime settings indiscriminately.

Each Perl database object owns a logical connection, opened lazily on its first
operation. Separate objects do not silently share transaction state. Create clients
inside requests, never global pools or cross-request connections. Hyperdrive owns
the origin pool. Set a configurable per-request connection cap.

Preserve ordered column metadata and array rows in the host protocol; construct
hash rows in Perl. Carry column names, PostgreSQL type OIDs, command tag, affected
row count, connection identity, and structured errors. Keep query execution separate
from DBI-style convenience methods and return-value conventions.

## Initial public API contract

| Method | Proposed behavior |
| --- | --- |
| `new(scope => ..., binding => 'DB')` | Synchronous construction and capability validation; no network I/O. |
| `selectrow_arrayref($sql, $attr_hr, @bind)` | Future resolving to one array row or undef. |
| `selectrow_hashref($sql, $attr_hr, @bind)` | Future resolving to one hash row or undef. |
| `selectall_arrayref($sql, $attr_hr, @bind)` | Future resolving to array rows; `{ Slice => {} }` selects hash rows. |
| `do($sql, $attr_hr, @bind)` | Future resolving to affected-row count; use DBI's `0E0` convention for known zero and `-1` for unknown count. |
| `prepare($sql, $attr_hr)` | Synchronous local statement construction; does not imply SQL PREPARE or server-side preparation. |
| Statement `bind_param($position, $value, $type)` | Local binding; initially support only documented type hints. |
| Statement `execute(@bind)` | Future; execute and buffer bounded results, reset fetch position, expose count. |
| Statement fetch methods | Synchronous reads of already buffered results: `fetchrow_arrayref`, `fetchrow_hashref`, `fetchall_arrayref`. |
| Statement `finish()` | Release local buffered rows; no server cursor in v1. |
| `begin_work`, `commit`, `rollback` | Future-returning transaction operations. |
| `transaction($callback_cr)` | Await callback Future, commit on success, attempt rollback on failure, return callback's scalar result. |
| `disconnect()` | Future; close connection and roll back unfinished work; invalidate statements. |

Use `undef` for absent attributes. Reject unknown attributes instead of silently
ignoring them. Initially support only `Slice => {}` on applicable fetch helpers;
additional attributes require explicit documentation and tests. Do not expose
mutable DBI handle attributes such as `AutoCommit` yet.

Use PostgreSQL `$1`, `$2` placeholders and a separate parameter array. No question-mark
rewriting in v1. Future DBI placeholder support requires SQL-aware parsing because
PostgreSQL operators, strings, comments, and dollar quoting can contain `?`.
Reject multi-command execution through the driver protocol where possible rather
than splitting SQL on semicolons. Values cannot substitute table or column names.

Preserve duplicate column names in array results; hash results follow a documented
last-column-wins rule. Recommend explicit SQL aliases for joins. Query helpers do
not rewrite SQL to add LIMIT; callers should bound queries themselves.

## Transactions, concurrency, and cleanup

Pin all operations in a transaction to one logical client. Serialize operations
per connection; different connections may operate independently within limits.
Reject overlapping statement execution and nested transactions in v1.

The transaction callback receives a transaction-scoped facade. Block unrelated
parent-object calls while it owns the connection, preventing concurrent work from
silently joining the transaction. Expire the facade when the callback completes.
Reject explicit transaction-control methods inside managed callbacks. Document
that application SQL must not issue its own transaction-control commands; retain
server transaction status if available and test failure behavior.

Track idle, connecting, ready, in-transaction, failed-transaction, closing, and
closed states. After a database error within a transaction, require rollback.
Preserve the original error if rollback also fails, attaching cleanup failure as
secondary context. A connection failure around COMMIT may mean outcome unknown:
report that explicitly and never automatically retry writes or whole transactions.

Request teardown first revokes capabilities and refuses queued/new work, then
settles or terminates in-flight work and closes clients with bounded cleanup.
Never rely on Perl DESTROY to await network I/O. Audit ZeroPerl's teardown contract:
the current extension `release()` aggregator is synchronous, so asynchronous socket
cleanup may require a runtime lifecycle change. Handle aborts, streaming response
completion, attachment failure, and interpreter recycling explicitly.

Default to finite connection/query deadlines and bounded rows/response bytes.
Choose numeric defaults from prototype measurements. A post-buffer size check is
not a memory guarantee; either enforce limits while consuming driver rows or
document residual driver buffering and close on overflow. Never silently truncate.

## Data and errors

Use explicit typed wire envelopes, not shape-based guessing inside arbitrary JSON.
Configure parsers per client/query, avoiding global pg parser changes.

| PostgreSQL value | Initial Perl representation |
| --- | --- |
| SQL NULL | undef |
| Text/UUID | Unicode string |
| Boolean | Documented JSON::PP boolean values |
| Small integers/floating point | Numeric scalars; explicitly encode non-finite floats. |
| BIGINT/NUMERIC | Exact decimal strings, never JavaScript Number conversion. |
| Date/time/timestamp | Text preserving microseconds and documented timezone policy. |
| BYTEA | Perl bytes; explicit blob wrapper for binary input. |
| JSON/JSONB | JSON text by default, preserving precision and JSON null versus SQL NULL; optional decoding deferred. |
| Arrays and other types | PostgreSQL text representation initially, with type metadata retained. |

Errors retain SQLSTATE, message, severity, constraint, table/column, and position
where available. Classify bridge validation, database, timeout, connection, and
unknown-commit-outcome failures. Do not include credentials or parameter values in
bridge logs. PostgreSQL error details can themselves contain submitted values;
document that structured errors are for application handling, not raw HTTP output.

## Implementation phases and completion criteria

### 1. Prove the complete path

Audit the actual ZeroPerl package source and extension lifecycle used by the fixture
Worker. Build a minimal JS adapter and Perl host call using the current runtime.
Use a maintained Wrangler configuration initially, avoiding generator changes.

Prove a bound SELECT, Unicode/NULL/BIGINT/BYTEA round-trip, and BEGIN/INSERT/ROLLBACK
with a read between statements, through Perl WASM and Hyperdrive. Verify a second
request cannot access the first request's connection or capability. Measure bundle
impact, buffering, and connection teardown. Local direct PostgreSQL tests alone
do not establish Hyperdrive compatibility.

Exit: a reproducible end-to-end smoke test and a short record of exact versions,
runtime changes required, and any revised API assumptions. Stop architectural
expansion until connection lifecycle and asynchronous host execution are proven.

### 2. Implement the host and wire protocol

Add `js/hyperdrive-host.js`, a pg client adapter if separation aids testing, and
registration in `js/cloudflare.js`. Add capability validation, logical connections,
typed results, errors, limits, transaction ownership, and teardown.

Add shared Perl transport/codec under `lib/WebDyne/Cloudflare/Hyperdrive/`, keeping
it independent of public convenience methods. Test with injected host/client
factories and adversarial protocol inputs.

Exit: deterministic host and transport tests cover connection/transaction state,
request isolation, exact types, limits, and failure cleanup.

### 3. Implement the Perl API

Add `Hyperdrive.pm`, `Hyperdrive/Statement.pm`, `Hyperdrive/Error.pm`,
`Hyperdrive/Blob.pm`, and transaction support where appropriate. Add maintained
`.pm.md` sidecars alongside modules. Preserve the repository's Perl 5.20 baseline
and current style. Implement the explicit API contract above, including zero-row
returns, binding reuse, fetch exhaustion, statement reuse, and attribute rejection.

Exit: mocked Perl tests pass and the same API completes real fixture CRUD and
transaction tests in WASM.

### 4. Integrate configuration and packaging

Add the extension option `hyperdriveBindings`. Add a proposed resource array
`webdyne.cloudflare.hyperdrive` mapping `{ binding, id }` to Wrangler's `hyperdrive`
entries, after checking the runtime generator's conventions. Preserve user-owned
Wrangler files. Support local connection configuration through environment/private
configuration, never committed credentials.

Update package dependencies/exports, MakeMaker dependencies if needed, MANIFEST,
package allow-list tests, staging tools, README, and TEST.md. Check that adding pg
does not break D1/KV/R2-only Workers or unnecessarily force their compatibility
settings; use a separate host entrypoint if needed.

If ZeroPerl changes are necessary, use a dedicated `codex/hyperdrive-support` branch
and a local npm development tarball. Do not rebuild Perl/XS unless the prototype
demonstrates the need. Qualify the extension against that exact runtime package.

Exit: a clean application can install local tarballs, build, and exercise the API
without manual edits to generated Worker code.

### 5. Qualify and document

Reuse `t/fixtures/hyperdrive-postgres.sql` and the dedicated configuration already
documented in TEST.md. It currently has caching disabled; verify this at test time.
Write only run-token-scoped transaction probe rows and clean up those rows. Do not
reset existing fixtures or unrelated worktree changes.

Cover create/read/update/delete, joins, RETURNING, all fixture types, injection-like
bound values, constraints/SQLSTATE, commit/rollback, callback exceptions, concurrent
operations, connection loss, timeouts, size limits, disconnect, stale handles, and
request abort. Verify committed and rolled-back results from an independent
connection. Exercise numeric/JSON precision and duplicate column names explicitly.

Add a small PAGI/PSP example showing parameter binding, hash rows, and a transaction.
Run focused Perl/JS tests, then the complete existing suites and package checks.
Run an actual Hyperdrive Worker smoke test; record what requires live credentials
and what was simulated. Keep test endpoints confined to the test application.

Exit: documented API, passing regression/package checks, and recorded end-to-end
results on the supported runtime and driver versions.

## Later work

Implement a genuine DBI driver over the shared protocol only after testing how
synchronous DBI calls can suspend safely across the ZeroPerl host boundary.
Assess DBI packaging/XS separately. Preserve ordered metadata and execution status
now; do not promise ORM compatibility, DBD::Pg attributes, or portability without
dedicated conformance tests.

Other deferred features: SQL builders, MySQL, streaming cursors, COPY, savepoints,
LISTEN/NOTIFY, automatic retries, cross-request handles, and schema migration tools.

## Sources and operating assumptions

- [Cloudflare PostgreSQL driver guidance](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/): driver and Worker compatibility requirements.
- [Hyperdrive connection lifecycle](https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/): request clients and transaction connection ownership.
- [Hyperdrive query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/): writes do not invalidate cached reads; use caching disabled for initial CRUD applications requiring fresh reads.
- [Supported features](https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/): verify protocol/session restrictions during implementation.
- [DBI](https://metacpan.org/pod/DBI): reference conventions, not a compatibility claim for the initial API.

Existing source inspected: `js/cloudflare.js`, `js/d1-host.js`,
`lib/WebDyne/Cloudflare/D1.pm`, extension/package manifests, README, TEST.md, and
the PostgreSQL fixture. ZeroPerl integration and release details are recorded in HYPERDRIVE-PHASE4-5.md.
