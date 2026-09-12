# Hyperdrive phase 2 — host bridge and Perl transport

Implemented on 2026-09-12. This is the internal foundation for phase 3's public
Perl API; it is not yet a released or fully qualified database interface.

## Components

- `js/hyperdrive-host.js`: protocol v1, binding capabilities, lazy logical
  connections, serialized operations, transaction ownership and bounded cleanup.
- `js/hyperdrive-codec.js`: explicit parameter/result envelopes and exact types.
- `js/hyperdrive-pg.js`: pinned `pg@8.16.3` adapter, extended protocol and bounded
  row collection using Query events. No global pool or global type-parser changes.
- `js/hyperdrive.js`: PostgreSQL-enabled entry point. The original Cloudflare
  entry point does not import pg and still bundles without `nodejs_compat`.
- `lib/WebDyne/Cloudflare/Hyperdrive/Transport.pm`, `Codec.pm`, `Error.pm`, and
  `Blob.pm`: asynchronous internal transport, value conversion and structured
  failures, shared by the future public API and potential DBI adapter.

Error and Blob support moved forward from phase 3 because the transport needs
them. The public Hyperdrive class, Statement class, DBI-style convenience methods
and transaction callback helper remain phase 3 work. The prototype's separate
Hyperdrive.pm is unchanged and must not be mixed with these production modules.

## Runtime and configuration

Custom Worker integration selects:

```js
import { createWebDyneHyperdriveExtension }
  from "@webdyne/webdyne-cloudflare/hyperdrive";

const extension = createWebDyneHyperdriveExtension({
  hyperdriveBindings: ["DB"],
  // Optional positive integer overrides:
  hyperdriveLimits: { maxRows: 10000, queryTimeoutMs: 10000 },
});
```

Supply this extension to the WebDyne runtime, use a real Wrangler Hyperdrive
binding named DB, and enable `nodejs_compat`. Generator/resource configuration
integration remains phase 4; the existing automatic extension manifest still
selects the original Cloudflare entry point. A custom adapter can instead supply
`hyperdriveClientFactory` to the original factory. Explicit empty binding arrays
disable the service; otherwise `WEBDYNE_HYPERDRIVE_BINDINGS` is a compatibility
fallback in the Hyperdrive-enabled entry point.

ZeroPerl's extension manager now adds `lifecycle.asyncCleanup: true` to attachment
context. Hyperdrive rejects attachment without it before allocating resources.
This prevents silently running with the released 1.0.9 synchronous cleanup path.
Use the updated local `codex/hyperdrive-support` runtime, rebuilt with
`npm run pack:dev -- --from-npm`; phase 1's earlier tarball predates this marker.
No additional XS or rebuilt WASM is required.

Updated local tarball:
`/Users/aspeer/Development.github/aspeer-zeroperl/dist/dev/webdyne-webdyne-zeroperl-5.44.0-1.0.10-dev.20260912075900986.g88341fd6377a.tgz`.

The Cloudflare lifecycle aggregator invokes all releases immediately and returns
their shared asynchronous completion when needed. Existing synchronous services
retain synchronous release behavior. ZeroPerl owns completion, deadlines and
preservation of application failures alongside cleanup failures.

## Protocol and state

Every request supplies `version: 1`, `capability`, `binding` and `operation`.
Responses contain `version`, boolean `ok`, and either `result` or `error`.
Credentials never enter Perl scope or connection errors returned by the host.

`open` allocates an opaque logical `connection` ID without network I/O. Each
connection belongs to exactly one request and binding. `query` takes that ID,
`sql` and encoded `params`. `begin` takes `managed: true|false`; a managed
transaction returns a fresh `owner` token required by all subsequent operations
until commit or rollback. Explicit transactions omit owner. Operations on a
connection run in order and recheck authority and transaction state when executed.

`commit`, `rollback` and `disconnect` have no SQL arguments. Nested transactions
are rejected. A failed transaction requires rollback. Managed transactions reject
calls through a parent handle without the owner token. Connection failures make
the connection unusable; there is no reconnection or automatic retry. A lost
COMMIT response reports `outcomeUnknown: true`. Other interrupted writes can also
have uncertain outcomes; the caller must not infer failure means no write occurred.

Applications use bound `$1` placeholders. The adapter always uses extended query
protocol, including parameterless queries, so PostgreSQL rejects multiple
statements. Direct transaction/session-control commands are rejected after leading
comments; queries must begin with a SQL keyword. This guard is not a SQL sandbox.
Do not hide session mutations in functions such as `set_config`, stored procedures,
or anonymous code. Database permissions remain the authority for allowed SQL.
SQL-level PREPARE, session settings, savepoints and session-dependent features
are outside this contract.

## Types

Parameters are tuples: `["null"]`, `["text", value]`, `["bool", boolean]` or
`["bytes", lowercaseHex]`. Ordinary Perl scalars become text, allowing PostgreSQL
to infer the SQL type without a JavaScript Number conversion. Binary input uses
Blob. Callers encode JSON themselves; arbitrary Perl references are rejected.

Results include ordered `{name, oid}` columns, row arrays, count and command.
Duplicate names are preserved for the future facade to map explicitly.

| PostgreSQL value | Perl value |
| --- | --- |
| SQL NULL | undef |
| bool | JSON::PP boolean |
| int2, int4, oid; finite float4/float8 | number |
| int8, numeric | exact text |
| date/time/timestamp | server text, retaining microseconds and offset representation |
| bytea | bytes |
| JSON/JSONB | raw server JSON text; JSON null is distinct from SQL NULL |
| arrays, UUID, other types | PostgreSQL text plus OID metadata |
| non-finite float | NaN, Infinity or -Infinity text via an explicit wire tag |

## Limits and cleanup

Defaults are four logical connections per request, 1 MiB encoded request,
4 MiB encoded result, 10,000 rows, 5 s connect deadline, 10 s query deadline and
5 s cleanup deadline. Defaults are configurable at Worker construction, not by
untrusted wire requests. Disconnect is bounded too. The outer runtime cleanup
deadline should exceed the host cleanup deadline (runtime default is 10 s).

The adapter collects rows through pg events without pg accumulating a second
result set. It stops and destroys the connection when row/encoded byte limits are
exceeded. Metadata and the final encoded result receive a second limit check.
This bounds retained rows, not total peak WASM/JavaScript heap: PostgreSQL can send
a single large field/frame that pg must parse first, and encoding makes temporary
copies. This API does not promise streaming results or an absolute memory ceiling.

Release and request abort immediately revoke the capability; queued operations
are rejected. In-flight work may drain until its query deadline. Release waits
for that work, rolls back unfinished transactions on usable connections, and
closes clients. Deadline expiry destroys sockets; all cleanup attempts are
observed and rollback/close errors remain separate. This continues phase 1's
graceful cancellation model, not a verified PostgreSQL CancelRequest mechanism.

## Verification and remaining qualification

- 205 Perl assertions and 49 JavaScript tests pass, including malformed protocol
  values, precision/binary/NULL handling, duplicate columns, capability isolation,
  transaction ownership, failed transactions, queued work, abort revocation,
  query/disconnect/cleanup deadlines, unknown commit outcome and cleanup failures.
- Adapter tests exercise the pinned pg Query parser/events with injected clients,
  verifying extended protocol, disabled internal row accumulation and early limits.
- ZeroPerl's 61 JavaScript tests pass, including the new lifecycle marker test.
- npm inventory validates 46 packaged files. Both Worker entry points pass Wrangler
  dry runs; the original entry point requires no Node compatibility flag.

Database clients and failure conditions in these new tests are simulated. No
phase-2 Worker was deployed and no live database was modified. Phase 1's recorded
live evidence still applies only to that prototype. Phase 3 must exercise the
public API in WASM; phase 5 must qualify this exact adapter against real Hyperdrive,
including timeout/connection loss, teardown and independent transaction checks.

References: [pg Query events and per-query parsers](https://node-postgres.com/apis/client),
[Cloudflare driver guidance](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/),
[Hyperdrive supported features](https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/).
