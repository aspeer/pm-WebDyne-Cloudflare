# WebDyne::Cloudflare

`WebDyne::Cloudflare` is the npm-first `@webdyne/webdyne-cloudflare` extension.
It provides Future-returning Perl facades for Cloudflare services used by
WebDyne::PAGI, together with the JavaScript adapters that own the real Worker
bindings. The first supported service is D1.

## Application installation

Install this extension beside one qualified WebDyne ZeroPerl runtime:

```sh
npm install @webdyne/webdyne-zeroperl-5.44.0@1 @webdyne/webdyne-cloudflare@1
```

Enable it explicitly and identify the D1 bindings that Perl may access:

```json
{
  "webdyne": {
    "extensions": {
      "@webdyne/webdyne-cloudflare": {
        "d1Bindings": ["DB"]
      }
    },
    "cloudflare": {
      "d1Databases": [
        {
          "binding": "DB",
          "databaseName": "webdyne-time",
          "databaseId": "CLOUDFLARE-DATABASE-ID"
        }
      ]
    }
  }
}
```

The runtime's `webdyne-cloudflare` command resolves the declarative extension
manifest, copies this package's Perl modules to VFS `/perl5/lib`, statically
imports its Cloudflare adapter into the generated Worker, and emits the D1
database configuration for Wrangler. npm installation itself runs no setup or
deployment hooks.

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

The ESM adapter is exported as `@webdyne/webdyne-cloudflare/cloudflare`.
Normally the generated Worker instantiates it through `webdyne-extension.json`.
For a custom Worker, `createWebDyneCloudflareExtension()` returns the standard
runtime lifecycle: `register($perl)` for each persistent interpreter generation
and `attachScope({ scope, bindings, request })` for each request. The runtime
always invokes its returned cleanup after the PAGI session finishes.

No binding is exposed unless its name is explicitly supplied. The recommended
allow-list is the extension's `d1Bindings` array. A comma-separated
`WEBDYNE_D1_BINDINGS` variable remains available to custom Workers for
compatibility.

## Release packaging

`npm run pack:check` verifies the exact public package allow-list. The
`WebDyne Cloudflare release` GitHub workflow runs the Perl and JavaScript tests,
audits dependencies, dry-runs npm publication, creates the npm `.tgz` and its
SHA-256/source manifest, attests the result, and can create an immutable GitHub
Release when its guarded `publish_release` input is enabled. The separate npm
workflow consumes only a qualified workflow artifact or immutable GitHub
Release; its final publication remains deliberately disabled.

## Development

```sh
perl Makefile.PL
make test
make d1_local_init
make d1_local_query
make worker_stage WORKER_DIR=../wasm-WebDyne-PAGI
make d1_smoke ARGS=http://127.0.0.1:8790/
```

The first two commands run Perl and Node contract tests. `npm test` is the
canonical npm-first test command and runs both suites. The local D1 targets
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
