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

Batch was approved separately on 2026-09-05 and is covered by D008 below.
The other features remain deferred.

## D005: Publish one npm-first dual-surface extension

- Status: accepted
- Date: 2026-09-03

The public artifact is `@webdyne/webdyne-cloudflare`. It contains the Perl
facades and Cloudflare JavaScript adapter because neither half provides a
working D1 service alone. A declarative manifest lets the ZeroPerl builder copy
Perl files and generate static Worker imports without package install hooks or
implicit dependency scanning. The MakeMaker files remain useful for native
Perl validation, but CPAN is not the deployment or release channel.

Release artifacts are npm tarballs with SHA-256/source manifests and GitHub
build-provenance attestations. GitHub Release creation is guarded and
immutable; npm publication remains a separately qualified operation.

## D006: Keep storage bridges modular and bounded

- Status: accepted
- Date: 2026-09-03

Workers KV and R2 use independent Perl modules, JavaScript host modules, PAGI
extension names, capability tokens, and binding allow-lists. Shared code is
limited to validation, byte-envelope, error, and scope helpers. This keeps the
public APIs independent while one npm extension can register all host
functions safely for the persistent interpreter.

The first R2 API buffers object bodies and applies a 16 MiB default bridge
limit. Streaming and multipart uploads are deferred until the host protocol
can model backpressure and lifecycle cleanup explicitly. KV uses the same
default limit even though the provider permits larger values, avoiding large
base64/JSON amplification in Worker memory.

## D007: Separate examples, test fixtures and language-specific runners

- Status: accepted
- Date: 2026-09-05

User-facing PSP examples belong in `examples/app`. Perl and related PSP/SQL
fixtures belong in `t`, and JavaScript tests and smoke tooling in `t.js`.
Smoke staging never imports example files. The example staging helper now
creates an independent application in a new destination instead of modifying a
sibling runtime checkout. Existing destinations are refused.

Perl API documentation is maintained in `.pm.md` sidecars, with no independent
hand-maintained POD copy. MakeMaker uses an explicit abstract. Sidecars ship
in the npm/source distributions; no documentation converter is introduced.

## D008: Atomic D1 batches use existing prepared statements

- Status: accepted
- Date: 2026-09-05

`$db_or->batch($statements_ar)` accepts one non-empty array of statements
created by the exact same database facade. Matching object identity prevents
accidentally moving statements between bindings, requests or future sessions.
Each statement is validated and its parameters encoded before any host call.

The additive `batch` operation uses the existing version-1 capability envelope
and calls the provider's `database.batch()` exactly once. No per-statement
fallback, automatic splitting or retry is used. Ordered result hashes use the
existing BLOB encoding and decoding. Provider failures fail the whole Future;
Cloudflare supplies transaction rollback. Supply all SQL and parameters up
front; this does not introduce interactive transactions or sessions/bookmarks.

The Perl facade and JavaScript adapter are distributed together and must both
include batch support. An older adapter rejects the new operation explicitly.
Local verification uses the existing Perl 5.44 runtime with the new extension
mounted through VFS, without rebuilding the interpreter.
