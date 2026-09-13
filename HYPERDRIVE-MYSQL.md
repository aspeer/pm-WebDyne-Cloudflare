# Hyperdrive MySQL implementation and qualification

Release target: @webdyne/webdyne-cloudflare 1.4.0, 2026-09-13.
All three increments are implemented. ZeroPerl 1.0.11 is sufficient; the sibling
runtime repository needs no changes or release for this extension.

## Preflight and driver abstraction

The account configuration is named `webdyne-hyperdrive-test-aiven-mysql`
(the supplied name had the final words reversed). ID:
`b7dec671d9c84b0abb4c6cbda2e2f492`. Caching was already disabled.
Before implementation, an authenticated Worker connected to Aiven MySQL 8.4.8,
created a unique table, inserted/read/updated/deleted a row and dropped the table.
The database was accessible and writable. No credentials were committed.

The first increment extracted PostgreSQL error/codec policy behind a per-binding
protocol interface. Its existing 283 Perl assertions and 51 JavaScript tests
passed unchanged. PostgreSQL columns and tagged wire values remain compatible.

## MySQL implementation

The existing Hyperdrive entry point chooses the adapter from the connection URI
scheme, supporting PostgreSQL and MySQL bindings in one request. D1/KV/R2's default
entry point imports neither database driver. mysql2 is pinned at 3.24.4; pg remains
8.16.3. ZeroPerl selects the same manifest variant and injects the extension's Perl
files into the application filesystem. No new XS dependency or WASM build is needed.

The MySQL adapter streams rows with static parsers and bounds row/encoded-byte
collection. It preserves exact BIGINT/DECIMAL, JSON and temporal strings, binary
values, duplicate columns and native column metadata. Statements expose insert IDs,
affected rows and warnings; errors expose symbolic code, SQLSTATE and errno.

Text-protocol parameter substitution handles only unquoted question marks outside
comments. Text is encoded as UTF-8 hex expressions; binary values as hex literals.
LIMIT/OFFSET parameters are validated unsigned integers. This preserves values
under NO_BACKSLASH_ESCAPES and ANSI_QUOTES without server-side prepared statements.
Backslashes inside quoted SQL literals, identifier placeholders, executable
comments, multi-statements, CALL and session-control SQL are rejected. DDL and
other supported implicit-commit statement families are rejected in transactions.
Applications must use transactional tables such as InnoDB.

mysql2 emits an undefined fields event for DML; the adapter retains an empty
column list and preserves its result header. Its destroy method only half-closes
the socket, so forced cleanup also destroys the transport and awaits its close
event. Both behaviors have regression coverage. Authentication and connection
failures are redacted; SQL errors poison a transaction until rollback. Writes and
ambiguous commits are never retried automatically.

## Qualification

- Native suite: 293 Perl assertions; JavaScript suite: 60 tests.
- npm package inventory: 52 files; native compile checks and distribution checks.
- Production dependency audit: zero vulnerabilities. Existing development-tool
  advisories are outside this driver change; Wrangler stays pinned at 4.127.1.
- Generated-app build and Wrangler dry run with the official ZeroPerl 1.0.11
  archive and the 1.4.0 extension. No generated Worker source patches.
- Aiven MySQL 8.4.8 through Hyperdrive and the real Perl/WASM API: exact values,
  placeholders and bound LIMIT, insert ID above JavaScript's safe-integer range,
  statement reuse, CRUD, independent committed reads, explicit/callback rollback,
  implicit-commit rejection, failed-request rollback, row/byte limits and timeout.
  Three concurrent requests and recovery after failure also pass. The authenticated
  wrapper independently verifies transaction effects and drops every probe table.
- Direct adapters against isolated MySQL 8.4.11 and MariaDB 11.8.9 containers:
  exact types, parameters under ordinary and alternate SQL modes, transactions,
  duplicate errors and large insert IDs. The containers are disposable.
- PostgreSQL regression through Hyperdrive with the updated extension: all six
  existing qualification cases and four concurrent recovery requests pass. This
  includes CRUD, joins, RETURNING, types, constraints, limits, backend termination,
  stale handles, failed-request recovery and active-query client cancellation.
  Each case independently verifies cleanup of its own token's rows.

Evidence is under `prototypes/hyperdrive-mysql/results`. The MySQL example is under
`examples/hyperdrive-mysql`; API details are in the module Markdown sidecars.

PlanetScale/Vitess was not tested because no test service was supplied. MariaDB
was tested directly, not through a separate Hyperdrive configuration. Query timeouts
do not prove immediate cancellation at the origin. Individual fields can be
allocated before result limits apply; this is not a peak-memory guarantee.
Ambiguous COMMIT is tested with injected failures, not induced on the live service.
The new MySQL socket handling depends on mysql2's stream property and must be
requalified when upgrading the pinned driver.

## Release

The complete PostgreSQL and MySQL implementation targets version 1.4.0.
Gitea (`origin`) is authoritative and mirrors to GitHub. Push merged main to
Gitea, verify the same commit on GitHub, then run GitHub qualification and npm
staging against that commit. Do not push source changes directly to the mirror.
ZeroPerl 1.0.11 needs no changes for this release.

All three temporary Workers were deleted, both containers stopped, and local
qualification secret files removed after successful testing. npm publication
remains pending the owner's manual approval after staging.
