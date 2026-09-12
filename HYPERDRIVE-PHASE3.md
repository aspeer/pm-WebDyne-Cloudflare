# Hyperdrive phase 3 — public Perl API

Completed on 2026-09-12. The agreed asynchronous, DBI-inspired API now runs through
the production bridge in Perl WASM against the dedicated Hyperdrive PostgreSQL
fixture. No Moose, ORM, DBI installation or new XS/WASM build was needed.

## Implemented interface

`WebDyne::Cloudflare::Hyperdrive` supplies lazy construction, selectrow_arrayref,
selectrow_hashref, selectall_arrayref, do, prepare, blob, begin_work, commit,
rollback, transaction and disconnect. The maintained API reference and examples
are in `lib/WebDyne/Cloudflare/Hyperdrive.pm.md`.

`Hyperdrive::Statement` supplies bind_param, execute, buffered fetch methods,
finish, rows, columns and command. Statements preserve bindings and type hints
across executions, reset fetch position, and discard old results even when a new
execution fails locally. Duplicate-column hashes use the last value. Empty fetch
results, `0E0` affected-row counts, and unknown counts follow the agreed contract.

Methods retain DBI's attribute argument position; unsupported attributes are
rejected. The initial encoding hints are `text`, `boolean` and `bytea`, not numeric
DBI SQL_* constants. SQL casts select PostgreSQL types. Row fetching is synchronous
because execution has already collected a bounded result.

Callback transactions use a short-lived facade and the host's transaction owner
token. Parent calls, nested callbacks and explicit controls on the facade are
rejected. Await earlier work before entering a callback and all work it starts;
unfinished callback operations cause rollback. Facades and their statements expire
when callbacks finish. Future cancellation invalidates the database handle;
disconnect and request teardown own database cleanup.

Errors preserve the original callback exception after successful rollback. If
rollback fails too, an existing Hyperdrive Error retains its identity/SQLSTATE
and gains secondary cleanup errors; other exception values are retained as cause
in a structured wrapper. Unknown commit outcomes are not retried or described as
rolled back. The remaining transaction owner is retained for disconnect after
cancelled/failed managed work.

## Verification

- Full extension suite: **283 Perl assertions and 49 JavaScript tests pass**.
- 78 new public-API assertions cover binding/fetch reuse, invalid attributes,
  zero/empty/unknown results, transaction scopes, primary/secondary errors,
  overlapping execution, delayed Futures, unawaited callback work and cancellation.
- npm inventory: **50 files**. MakeMaker now installs all Hyperdrive modules and
  declares Future >= 0.30 for without_cancel. Perl syntax and diff checks pass.
- Wrangler dry run: 14,383.47 KiB raw, 4,699.62 KiB gzip including the existing
  WASM payload. The source package and staged library were checked together.
- Two final authenticated live runs passed. A preliminary source iteration also
  passed two runs; all four runs' scoped rows were deleted and verified absent.

Final runtime: `1.0.10-dev.20260912075900986.g88341fd6377a`, using verified official
1.0.9 WASM with the phase-2 runtime source overlay. Driver: pg 8.16.3. Wrangler:
4.127.1. Worker compatibility date: 2026-09-12, with nodejs_compat and
enable_request_signal. Hyperdrive caching was confirmed disabled before testing.

Temporary Worker: `webdyne-hyperdrive-api-9249a5e6`.
Final deployed version: `70eb5824-c847-41c4-8d60-bd5f7bac827a`.
Final runs completed at 2026-09-12 08:26:06 UTC. The Worker was deleted after the
tests, and its local bearer-secret file was removed. No package was published.

The reproducible harness is under `prototypes/hyperdrive-api/`. Final evidence,
run tokens and source SHA-256 hashes are in `results/deployed.json` there.

Live checks exercised Perl bound Unicode, BIGINT, NUMERIC, boolean, bytea and NULL;
fixture JSON null versus SQL NULL and timestamp microseconds; duplicate columns;
statement reuse/finish/fetch exhaustion; create/read/update/delete; explicit
commit and rollback; callback commit and exception rollback; constraint SQLSTATE;
parent/facade guards; separate connections; disconnect and statement invalidation;
and completion of teardown with an unfinished transaction. Independent connections
observed only the intended committed row before run-token cleanup, and zero rows
afterwards.

Cancellation, ambiguous commit, overlapping Futures and rollback failure were
simulated in native tests. This phase did not requalify live abort handling, forced
socket closure, network loss, interpreter recycling or peak-memory behaviour.
Those remain phase 5 qualification tasks; phase 1 evidence belongs to its prototype.

## Next

Phase 4 should integrate Hyperdrive resources into generated application
configuration and automatic extension selection, removing the fixture manifest
needed here. The application-facing API and live phase-3 exit criteria are complete;
production release qualification remains pending.
