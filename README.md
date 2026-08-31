# WebDyne::Cloudflare

`WebDyne::Cloudflare` provides Future-returning Perl facades for Cloudflare
services used by WebDyne::PAGI, together with the JavaScript adapters that own
the real Worker bindings. The first supported service is D1.

Cloudflare objects never cross the JavaScript/Perl boundary. The host places an
opaque, request-scoped capability and an allow-list of D1 binding names in the
PAGI `webdyne.cloudflare.d1` extension. The Perl facade sends prepared SQL and
typed values through that capability. The adapter deletes it when the request
finishes.

## Perl API

```perl
use WebDyne::Cloudflare::D1;

my $db = WebDyne::Cloudflare::D1->new(
    scope   => $self->r()->{'scope'},
    binding => 'DB',
);

my $write = $db->prepare(
    'INSERT INTO thing(name, payload) VALUES (?1, ?2)'
)->bind('example', WebDyne::Cloudflare::D1->blob($bytes))->run();

my $row = $db->prepare(
    'SELECT id, name, payload FROM thing WHERE name = ?1 LIMIT 1'
)->bind('example')->first()->get();
```

`run`, `all`, `first`, and `raw` return `Future` objects. Dynamic values should
use ordered SQLite placeholders such as `?1`; the adapter deliberately does
not interpolate SQL. `undef`, strings, numbers, JSON booleans, and explicit
D1 BLOB wrappers are supported. BLOB results become ordinary Perl byte
strings. Unflagged non-ASCII text is decoded strictly as UTF-8 before crossing
the JavaScript boundary; invalid byte strings must be passed explicitly as
BLOBs. Errors fail the Future with `WebDyne::Cloudflare::D1::Error`.

## Host adapter

The ESM adapter is installed beside the Perl modules as
`WebDyne/Cloudflare/d1-host.js` and exported locally as
`@aspeer/webdyne-cloudflare/d1-host`. A Worker creates one `D1HostBridge`, calls
`register($perl)` for each persistent interpreter generation, and calls
`attachScope($scope, $env, $binding_names)` for each request. The returned
`release` callback must run after the PAGI session finishes.

No binding is exposed unless its name is explicitly supplied. The recommended
Worker configuration is a comma-separated `WEBDYNE_D1_BINDINGS` variable.

## Development

```sh
perl Makefile.PL
make test
make d1_local_init
make d1_local_query
make worker_stage WORKER_DIR=../wasm-WebDyne-PAGI
make d1_smoke ARGS=http://127.0.0.1:8790/
```

The first two commands run Perl and Node contract tests. The local D1 targets
use `examples/schema.sql` and `examples/wrangler.jsonc` through Wrangler.
`worker_stage` copies this development distribution and its example PSP into
the existing Worker consumer's generated application overlay, then rebuilds
that overlay. It does not copy or fork the Worker implementation.
The smoke target checks HTML and JSON reads, parameterized Unicode/NULL/BLOB
insertion, a deliberate query failure followed by recovery, and concurrent
requests against a running Wrangler Worker.

The checked-in example configuration names the approved non-production D1
database `webdyne-cloudflare-m2` and binding `DB`. Local Wrangler commands use
an isolated local copy. Commands using `--remote` execute against that real
database and may upload an ephemeral Worker, so remote Worker execution should
only be run with separate deployment approval.

The initial milestone intentionally excludes batches, raw multi-statement
`exec`, D1 read-replication sessions/bookmarks, retries, and cancellation.
