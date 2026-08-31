# Decisions

## D001: Opaque request-scoped capabilities

- Status: accepted
- Date: 2026-09-01

D1 binding objects remain in JavaScript. A random token in the PAGI extension
selects an allow-listed binding for the duration of one request. Tokens are
released at PAGI completion and are never persisted in the interpreter.

## D002: Mirror prepared-statement semantics

- Status: accepted
- Date: 2026-09-01

The Perl API uses `prepare`, immutable `bind`, and Future-returning `run`,
`all`, `first`, and `raw`. Dynamic SQL interpolation is not provided.

## D003: Explicit BLOB type

- Status: accepted
- Date: 2026-09-01

Plain Perl scalars remain text or numeric values according to their JSON
scalar flags. Unflagged non-ASCII web strings are decoded strictly as UTF-8.
Byte strings are wrapped explicitly with `blob()`. BLOBs are base64 encoded
only in the private bridge envelope and decode to Perl bytes.

## D004: Defer wider D1 surface

- Status: accepted
- Date: 2026-09-01

Batch, `exec`, read-replication sessions/bookmarks, retry policy, and active
cancellation wait until the basic request capability and warm-runtime behavior
are proven end to end.
