# WebDyne::Cloudflare

`WebDyne::Cloudflare` is the npm-first `@webdyne/webdyne-cloudflare`
extension. It provides Future-returning Perl facades for D1, Workers KV, and
R2, together with the modular JavaScript adapters that own the real Cloudflare
Worker bindings.

## Application installation

Install this extension beside one qualified WebDyne ZeroPerl runtime:

```sh
npm install @webdyne/webdyne-zeroperl-5.44.0@1 @webdyne/webdyne-cloudflare@1
```

Enable the extension and identify only the bindings that Perl may access:

```json
{
  "webdyne": {
    "extensions": {
      "@webdyne/webdyne-cloudflare": {
        "d1Bindings": ["DB"],
        "kvBindings": ["CACHE"],
        "r2Bindings": ["ASSETS"]
      }
    },
    "cloudflare": {
      "d1Databases": [{
        "binding": "DB",
        "databaseName": "webdyne-time",
        "databaseId": "CLOUDFLARE-DATABASE-ID"
      }],
      "kvNamespaces": [{
        "binding": "CACHE",
        "namespaceId": "CLOUDFLARE-KV-NAMESPACE-ID"
      }],
      "r2Buckets": [{
        "binding": "ASSETS",
        "bucketName": "my-webdyne-assets"
      }]
    }
  }
}
```

Use only the arrays for services the application needs. The runtime's
`webdyne-cloudflare` command copies the extension's Perl modules to VFS
`/perl5/lib`, statically imports its Cloudflare adapter into the generated
Worker, and emits D1, KV, and R2 binding configuration for Wrangler. npm
installation itself runs no setup or deployment hooks.

Cloudflare objects never cross the JavaScript/Perl boundary. The adapter
places separate opaque, request-scoped capabilities and binding allow-lists in
the PAGI `webdyne.cloudflare.d1`, `webdyne.cloudflare.kv`, and
`webdyne.cloudflare.r2` extensions. Every capability is deleted when the
request finishes.

## Perl APIs

### D1

```perl
use WebDyne::Cloudflare::D1;

my $db_or=WebDyne::Cloudflare::D1->new(
    scope   => $self->r()->{'scope'},
    binding => 'DB',
);

$db_or->prepare('INSERT INTO thing(name, payload) VALUES (?1, ?2)')
   ->bind('example', WebDyne::Cloudflare::D1->blob($bytes))->run()->get();
my $row_hr=$db_or->prepare('SELECT * FROM thing WHERE name = ?1 LIMIT 1')
             ->bind('example')->first()->get();
```

`run`, `all`, `first`, and `raw` return `Future` objects. Dynamic values use
ordered SQLite placeholders such as `?1`; the adapter does not interpolate
SQL. `undef`, strings, numbers, JSON booleans, and explicit D1 BLOB wrappers
are supported. Errors fail with `WebDyne::Cloudflare::D1::Error`.

### Workers KV

```perl
use WebDyne::Cloudflare::KV;

my $kv_or=WebDyne::Cloudflare::KV->new(
    scope   => $self->r()->{'scope'},
    binding => 'CACHE',
);

$kv_or->put('greeting', 'hello', metadata => { source => 'WebDyne' })->get();
my $entry_hr=$kv_or->get_with_metadata('greeting')->get();
my $keys_hr=$kv_or->list(prefix => 'greet')->get();
```

`get`, `get_with_metadata`, `put`, `put_json`, `delete`, and `list` return
`Future` objects. Reads accept `type => 'text'`, `type => 'json'`, or
`type => 'bytes'`; binary writes use `WebDyne::Cloudflare::KV->blob($bytes)`.
Errors use `WebDyne::Cloudflare::KV::Error`.

### R2

```perl
use WebDyne::Cloudflare::R2;

my $r2_or=WebDyne::Cloudflare::R2->new(
    scope   => $self->r()->{'scope'},
    binding => 'ASSETS',
);

$r2_or->put(
    'reports/latest.bin',
    WebDyne::Cloudflare::R2->blob($bytes),
    http_metadata   => { content_type => 'application/octet-stream' },
    custom_metadata => { source => 'WebDyne' },
)->get();
my $object_or=$r2_or->get('reports/latest.bin')->get();
```

`get`, `head`, `put`, `delete`, `delete_many`, and `list` return `Future`
objects. `WebDyne::Cloudflare::R2::Object` contains object metadata and, for
`get`, the byte body. This release buffers R2 bodies and caps both KV values
and R2 bodies at 16 MiB by default. Applications can set `kvMaxValueBytes` and
`r2MaxObjectBytes` in the extension options. Streaming, multipart uploads,
conditional requests, and signed/public URLs are not part of this first R2
surface.

Unflagged non-ASCII Perl text is decoded strictly as UTF-8 before it crosses
the bridge. Invalid byte strings must use the service's explicit `blob`
wrapper; returned binary values become ordinary Perl byte strings.

## Source and documentation layout

Perl modules and their maintained Markdown API sidecars live under `lib`.
Perl tests and PSP fixtures live under `t`; JavaScript tests, smoke runners
and package checks live under `t.js`. Public methods keep their names;
unpublished helpers use ordinary names without a leading underscore.
See [the API overview](lib/WebDyne/Cloudflare.pm.md).

## Try the examples

`examples/app` contains user-facing D1, KV and R2 pages. They are not smoke
fixtures and are never copied into a test Worker. The D1 example is read-only;
the KV/R2 examples write a fixed greeting only when their form is submitted.
These are local demonstrations, not authenticated public applications.

Stage into a new directory (existing destinations are refused):

```sh
perl tools/stage-worker.pl /tmp/webdyne-cloudflare-example
cd /tmp/webdyne-cloudflare-example
npm install /absolute/path/to/runtime-5.44.tgz /absolute/path/to/cloudflare-extension.tgz
npm run build
npm run check
npx wrangler d1 execute DB --local --config .webdyne/wrangler.jsonc --file schema.sql
npm run dev
```

Open `/d1.psp`, `/d1-api/row/1`, `/kv.psp`, or `/r2.psp`.
Use the generated Wrangler configuration path printed by the build command if
your runtime version uses a different build layout. All sources are installed
from local tarballs; no CDN loader is involved. The checked-in resource
identifiers are placeholders for local use. Provision and configure real
resources deliberately before any remote execution.

## Host adapter

The ESM adapter is exported as `@webdyne/webdyne-cloudflare/cloudflare`.
Normally the generated Worker instantiates it through
`webdyne-extension.json`. For a custom Worker,
`createWebDyneCloudflareExtension()` supplies the standard lifecycle:
`register($perl)` for each persistent interpreter generation and
`attachScope({ scope, bindings, request })` for each request.

No binding is exposed unless its name appears in `d1Bindings`, `kvBindings`,
or `r2Bindings`. The comma-separated `WEBDYNE_D1_BINDINGS`,
`WEBDYNE_KV_BINDINGS`, and `WEBDYNE_R2_BINDINGS` variables remain compatibility
paths for custom Workers.

## Release packaging

`npm run pack:check` verifies the exact public package allow-list. The
`WebDyne Cloudflare release` GitHub workflow runs Perl and JavaScript tests,
audits dependencies, dry-runs npm publication, creates the npm `.tgz` and its
SHA-256/source manifest, attests the result, and can create an immutable GitHub
Release when its guarded input is enabled. The separate npm workflow consumes
only a qualified workflow artifact or immutable GitHub Release; final npm
publication remains deliberately disabled.

## Development

```sh
perl Makefile.PL
make test
make d1_local_init
make d1_local_query
make d1_smoke ARGS=http://127.0.0.1:8790/
make kv_smoke ARGS=http://127.0.0.1:8790/
make r2_smoke ARGS=http://127.0.0.1:8790/
```

`npm test` is the canonical contract test and runs both Perl and JavaScript
suites. The D1 targets use the checked-in local schema and configuration.
Integration uses `t.js/prepare-storage-smoke.mjs` with local runtime
and extension tarballs to generate an independent Worker consumer. Its dedicated `t/fixtures/app`
pages exercise the real Perl, WASM, JavaScript, and
Wrangler storage path. Use `--remote true` with the corresponding namespace ID,
database ID or bucket name only when deliberately testing a remote resource.

The current surfaces intentionally exclude D1 batch/session APIs, R2 streaming
and multipart uploads, cross-service retries, and active cancellation.
