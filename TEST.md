# Testing WebDyne::Cloudflare

The contract suite checks the Perl facades and JavaScript host adapters for
D1, Workers KV and R2. Tests require Perl 5.20 or later, Future,
Future::AsyncAwait, and Node.js 22 or later. Wrangler integration uses the
version pinned by package-lock.json and a separately supplied Perl 5.44 runtime.

## Contract and package checks

```sh
npm ci --ignore-scripts
perl Makefile.PL
make test
make distcheck
npm run pack:check
```

`npm test` also runs both language suites. Run them separately with
`prove -Ilib t` and `npm run test:js`.

- `t/00-load.t`: installed module loading.
- `t/01-d1.t`: prepared statements, parameter encoding, results and errors.
- `t/02-kv.t`: text, JSON, bytes, metadata and listing.
- `t/03-r2.t`: buffered objects, metadata, ranges, listing and deletion.
- `t/04-regressions.t`: malformed capabilities, binary validation and D1
  column names that resemble internal envelopes, UTF-8 normalization, numeric
  text bodies, immutable caller metadata, cycles and normalized-key collisions.
- `t/05-d1-batch.t`: ordered atomic batch requests, statement ownership,
  reusable parameters, BLOB results and structured failures.
- `t.js/*.test.mjs`: host adapters, capability isolation and expiry, batch
  dispatch, storage byte limits, registration recovery and smoke cleanup.
- `t.js/check-package.mjs`: exact npm package identity and file allow-list.
- `t.js/release-workflow.test.mjs`: staged-only publication commands, pinned
  staging-capable npm, OIDC-only authentication and pending-approval reporting.
  Commands are mocked; these tests do not upload or approve packages.

Workflow changes can also be linted with `actionlint .github/workflows/*.yml`.
A staging dry-run against the qualified 1.2.0 archive correctly refused its
already-published version; nothing was uploaded. End-to-end OIDC staging and
maintainer approval must be qualified with the next new version; a successful
staging run alone does not verify public publication.

## Local Worker integration

Create an independent test application using local runtime and extension
tarballs. The destination must not already exist:

```sh
node t.js/prepare-storage-smoke.mjs \
  --runtime-tarball /absolute/path/runtime-5.44.tgz \
  --extension-tarball /absolute/path/cloudflare-extension.tgz \
  --destination /tmp/webdyne-cloudflare-smoke
cd /tmp/webdyne-cloudflare-smoke
npm install --ignore-scripts
npm run build
npm run check
npx wrangler d1 execute DB --local --config .webdyne/wrangler.jsonc --file schema.sql
npm run dev -- --port 8790
```

Use the generated Wrangler configuration path reported by the runtime if its
build layout differs. From this repository, run:

```sh
npm run smoke:d1 -- http://127.0.0.1:8790/
npm run smoke:kv -- http://127.0.0.1:8790/
npm run smoke:r2 -- http://127.0.0.1:8790/
```

`--services d1`, `kv`, `r2`, or a comma-separated subset narrows staging.
Smoke applications use only `t/fixtures/app` and `t/fixtures/schema.sql`.
The user-facing pages in `examples/app` are independent of smoke tests.

D1 checks parameterized writes, JSON routes, failure/recovery, 24 concurrent
reads and eight isolated batch sequences. Each batch checks ordered writes
and reads, rollback on a middle constraint failure, and subsequent recovery.
KV/R2 check storage operations and cleanup; cleanup failure fails the smoke.

Remote execution requires deliberately configured test resources and the
corresponding `--remote true`, `--d1-database-id`, `--kv-namespace-id` or
`--r2-bucket-name` staging options. Test endpoints expose fixture mutations;
use them only in isolated test environments.

## Hyperdrive PostgreSQL fixture

`t/fixtures/hyperdrive-postgres.sql` creates a dedicated
`webdyne_hyperdrive_test` schema. Run it as the test database owner with
`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f t/fixtures/hyperdrive-postgres.sql`.
Keep the connection string outside source control. The script is transactional
and can be re-run without replacing existing seed rows; it does not reset
modified data or repair an incompatible existing schema.

- `samples`: five fixed rows covering Unicode, quotes, newlines, SQL NULL,
  empty values, booleans, BIGINT boundaries and values beyond JavaScript's safe
  integer range, exact decimals, floating point, microsecond timestamps, dates,
  JSONB (including JSON null), text arrays, BYTEA and UUIDs.
- `items`: three related rows for joins and aggregates, with foreign key,
  uniqueness, NOT NULL and CHECK constraints. Their total value is `30.30`.
- `transaction_probe`: initially empty. Use a unique `run_token` for each test
  and distinct slots for writes. A duplicate slot can exercise rollback on a
  primary-key failure; a negative slot can exercise CHECK errors. Keep writes
  out of the fixed seed tables and clean up only the current run's probe rows.

The fixture was installed on Neon project
`webdyne-cloudflare-hyperdrive-test`, branch `hyperdrive-test`, database
`hyperdrive_test`, owned by role `hyperdrive_test`. The Cloudflare configuration
`webdyne-hyperdrive-test` (`df3fabff9d60423bb31e3a98cb28b032`) points to this
database with caching disabled and an origin connection limit of five.
Fixture verification uses Neon SQL directly; Worker/Perl bridge integration
and transaction rollback tests remain to be implemented.

## Qualification

The current implementation passed 178 Perl assertions, 35 JavaScript tests,
package checks and local D1/KV/R2 Worker integration. Batch rollback and cleanup
were verified on local D1 through the existing Perl 5.44 WASM interpreter.
This review used native Perl 5.44.0; earlier qualification used 5.42.2; CI additionally tests its Ubuntu Perl.
The declared Perl 5.20 minimum has not yet been separately qualified.

Earlier remote checks qualified basic D1 and KV operations. Remote batch and
R2 qualification remain outstanding. The current embedded CGI::Simple::Cookie
dependency emits two `lc` ambiguity warnings during cold initialization;
requests and tests complete successfully.

## Source review (2026-09-11)

The UTF-8 and numeric-body fixes pass 178 native assertions, 35 JavaScript
tests, Perl syntax checks, source manifest and npm package inventory checks.
A separately installed extension tarball with the 1.0.6 runtime passes a
Wrangler dry run and local D1/KV/R2 smoke tests, including 24 concurrent D1
reads, eight batch sequences, rollback, binary values and cleanup.
No hosted deployment or package publication was performed.

An online audit of the runtime consumer reports the high-severity
GHSA-rgj7-g3m4-5g8c sharp advisory through the pinned Miniflare/Wrangler chain
(four dependency entries). Toolchain upgrade/qualification remains a release
follow-up; this review did not change those dependencies. Offline npm install
reporting zero vulnerabilities does not supersede that online audit.

## Hyperdrive phase 2 (2026-09-12)

The internal PostgreSQL host bridge, codec and Perl transport pass 205 native
Perl assertions and 49 JavaScript tests across the complete extension suite.
ZeroPerl passes 61 JavaScript tests with the awaited-cleanup capability marker.
The npm inventory contains 46 files. Wrangler dry runs pass for the original
entry point without Node compatibility and the separate Hyperdrive entry point
with `nodejs_compat`.

New Hyperdrive tests use injected database clients and pinned pg Query events.
They cover transaction ownership and isolation, queued work after revocation,
failed transactions, exact values, malformed input, size/deadline limits,
disconnect, cleanup failures and unknown commit outcomes. They do not constitute
live qualification of this production adapter. No phase-2 deployment or database
write was performed. Source checkout details are in HYPERDRIVE-PHASE2.md; the
public Perl API, generator integration and live qualification remain pending.

## Hyperdrive phase 3 (2026-09-12)

The public asynchronous Perl API and statements pass the complete suite of 283
native assertions and 49 JavaScript tests. npm inventory validates 50 files.
Two final live WASM runs passed against the dedicated Hyperdrive PostgreSQL
fixture, with caching confirmed disabled. They exercised bound/exact types,
statement reuse and fetching, CRUD, explicit and callback transactions,
SQLSTATE, facade expiry, disconnect and request teardown. Independent connections
verified committed and rolled-back results, then verified removal of each run's
test rows. Earlier iteration rows were also removed.

The authenticated temporary Worker `webdyne-hyperdrive-api-9249a5e6` was deleted.
Runtime: `1.0.10-dev.20260912075900986.g88341fd6377a`; pg 8.16.3; Wrangler 4.127.1.
The source harness and evidence are in prototypes/hyperdrive-api and the detailed
record is HYPERDRIVE-PHASE3.md. Network loss, forced close, ambiguous commit and
Perl Future cancellation still need the broader live qualification planned for
phase 5. Generated application integration is phase 4; no package was published.

## Hyperdrive phases 4 and 5 (2026-09-12)

Generated application integration and the complete live failure suite pass.
The extension's regression suite now has 283 Perl assertions and 51 JavaScript
tests; npm inventory validates 50 files and MakeMaker distcheck passes. A fresh
copy of examples/hyperdrive also passes the real CLI build and Wrangler dry run
with the qualified local packages.

prototypes/hyperdrive-qualification contains the reproducible authenticated
harness, including a generated production extension selection. In addition to
the phase-3 cases, it covers connection/row/byte bounds, query timeout, backend
termination and recovery, stale handles, poisoned interpreter replacement and
SSE client disconnect during an independently observed active database query.
Every case verifies and removes only its own run-token rows. Four concurrent
requests check subsequent recovery. Hyperdrive caching was verified disabled.

The live fixture uses a five-second deadline against a six-second origin sleep;
its independent verifier allows 15 seconds. Closing a client does not prove the
origin has already cancelled work. Initial very short deadlines produced expected
pool-wait timeouts in subsequent work; production defaults remain unchanged.
Unknown COMMIT outcomes and Perl Future cancellation remain deterministic native
tests, not induced live database failures. Individual pg field allocation is not
bounded before decoding, so these results do not certify an absolute memory cap.

See HYPERDRIVE-PHASE4-5.md and the saved result identities for exact development
and release-artifact evidence. The supported release targets are extension 1.3.0
and ZeroPerl 1.0.11. npm staging requires the owner's separate manual approval.

The six-case live suite and four concurrent recovery requests also passed on the
exact rebuilt ZeroPerl 1.0.11 CI archive, finishing at 09:22:23 UTC. Archive integrity,
clean source identity and the packaged WASM SHA-256 were verified. Results are in
prototypes/hyperdrive-qualification/results/release.json. The temporary Worker and
local bearer secret were removed after all scoped cleanup checks passed.

## Hyperdrive MySQL (1.4.0)

The full default suite now passes 293 Perl assertions and 60 JavaScript tests.
`t.js/hyperdrive-mysql.test.mjs` covers driver selection, mixed bindings, lexical
placeholder handling, values/metadata, error redaction, transaction rules,
streaming overflow and awaited socket closure. Perl tests cover the new metadata
and error accessors while retaining PostgreSQL checks.

`t.js/integration-mysql.mjs` is an explicit opt-in for disposable local servers.
Set `WEBDYNE_MYSQL_TEST_URL` privately and run it with Node. It creates/drops a
unique table and temporarily changes/restores the server's global SQL mode, so
use an isolated MySQL/MariaDB container with an administrative test account.

`prototypes/hyperdrive-mysql/stage.mjs` builds an authenticated generated-app
fixture from runtime/extension archives. Run the generated build/check scripts,
then use a root Wrangler config targeting the fixture's authentication wrapper,
with its generated secret file. `smoke.mjs` runs CRUD, transaction/failure/limit
checks and concurrent recovery; the wrapper independently checks committed data
and drops each test table before returning. Delete the Worker and local secret
file after qualification. See HYPERDRIVE-MYSQL.md for versions and evidence.

## Secrets Store

`npm test` includes the Perl SecretsStore API and JavaScript bridge contracts:
text preservation, read-only allowlists, protocol validation, request cleanup,
late-result rejection, request isolation and sanitized errors. The ZeroPerl
repository also tests generated Secrets Store bindings and user-owned configs.

For Worker/WASM qualification, copy `examples/secrets-store` to a temporary
application, install the candidate extension and runtime packages, run
`npm run check`, provision a local dummy secret as described in its README,
and start `npm run dev -- -- --port 8793`. From this repository run:

```sh
npm run smoke:secrets-store -- http://127.0.0.1:8793/
```

This runs four requests through the Perl API and asserts an exact fixed response
with `Cache-Control: no-store`. It never requests or prints the secret value.
Follow with a Wrangler deploy dry run to verify the generated Worker bundle.
A local pass exercises the local Secrets Store implementation; it does not
qualify production permissions or account resources.

Secrets Store qualification on 2026-09-13 used the staged ZeroPerl 1.0.11
GitHub artifact from run 34684893846, with the changed configuration generator
overlaid, and the extension 1.5.0 candidate tarball. Wrangler 4.127.1 generated
and dry-ran the Worker successfully. Four concurrent local Worker/WASM requests
passed with a locally provisioned dummy secret. No production secret or remote
Cloudflare resource was used. Unit tests additionally cover string fidelity,
provider failures and in-flight capability revocation.

## D1 sessions (1.6.0)

`t/09-d1-session.t` covers Future-returning session creation, constraints,
bookmarks, ownership, query shapes, old hosts and malformed responses.
`t.js/d1-session.test.mjs` covers native session reuse, isolation across requests
and bindings, expiry, provider failures, and local D1 prepared queries and atomic
batch rollback. Local D1 uses the compatibility date supported by the pinned
workerd binary. It cannot establish remote replica routing or replication lag.

`examples/d1-sessions` is a read-only Worker/WASM bookmark example. For package
qualification, copy it to a temporary directory, install the candidate extension
archive and runtime package, run `npm run check`, then `npm run dev -- -- --port
8794`. Request `/`, check `results[0].value` is 7, and send any returned
`x-d1-bookmark` on a second request. Repeat concurrently to check request isolation.
For remote qualification, use a replication-enabled test database and inspect
`meta.served_by_primary` and `meta.served_by_region`; a request may legitimately
be served by the primary. Test write/read continuity with a separate isolated
fixture before relying on replica behavior in production.

D1 session qualification on 2026-09-13 passed the packaged 1.6.0 extension with
ZeroPerl 1.0.12: generated Worker build, Wrangler dry run, and ten local Perl/WASM
HTTP requests including bookmark continuation and eight concurrent requests.
No ZeroPerl source changes were needed. Remote replication and replica-lag
behavior were not exercised; no Cloudflare database settings were changed.
