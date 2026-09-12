# WebDyne::Cloudflare::Hyperdrive — phase 1 prototype

This module is an isolated connectivity experiment, not the production API in
HYPERDRIVE-PLAN.md. It is not shipped by the parent npm package.

`new(scope => $scope_hr)` constructs one request-owned database handle.
`query($sql, @values)` returns a Future containing ordered column metadata,
array rows, command, and affected-row count. PostgreSQL placeholders are `$1`,
`$2`, etc. Values default to text; undef binds SQL NULL. `bytes($bytes)` creates
an explicit binary parameter envelope. BYTEA results become Perl byte strings;
other non-null results remain PostgreSQL text to avoid precision loss.

The host performs automatic rollback and connection closure at request completion.
Exceptions currently contain text only. Full argument validation, production
limits, structured error classes, multiple connections, DBI-style helpers and
statement objects belong to subsequent implementation phases.

Use only the provided fixed fixture application in the dedicated test environment.
