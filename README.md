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

Use `batch()` for an atomic sequence of prepared statements:

```perl
my $insert_or=$db_or->prepare('INSERT INTO thing(name) VALUES (?1)');
my $results_ar=$db_or->batch([
    $insert_or->bind('first'),
    $insert_or->bind('second'),
    $db_or->prepare('SELECT name FROM thing ORDER BY name'),
])->get();
```

Results preserve statement order, with the usual `results`, `meta` and
`success` fields. A failed statement rolls back the whole batch and fails the
Future. Use a non-empty array of statements prepared by that same database
object. All statements are supplied up front; the batch does not pause for
Perl code between statements. See [the D1 API](lib/WebDyne/Cloudflare/D1.pm.md).

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
`WebDyne Cloudflare release` GitHub workflow runs the Perl and JavaScript
suites through MakeMaker, checks the source manifest, audits dependencies,
dry-runs npm publication, and creates an attested `.tgz` with a SHA-256/source
manifest. Run it on `main` with `publish_release=true` to create the matching
GitHub tag and Release.

Then run `WebDyne Cloudflare npm package` on the same `main` commit with either
the successful `source_run_id` or its `release_tag`. It verifies the package's
signed build provenance and source commit before staging the exact archive
on npm with provenance. It does not rebuild or replace an existing npm version.
The workflow pins npm 11.17.0 because staging requires npm 11.15.0 or newer.

Staging uses npm Trusted Publishing configured for
`aspeer/pm-WebDyne-Cloudflare`, workflow `webdyne-cloudflare-npm.yml`, with only
staged publishing allowed and no environment restriction. Direct publication
is disabled; there is no `NPM_TOKEN` fallback. In the npm package settings,
select "Require two-factor authentication and disallow tokens".

A successful workflow means "Awaiting MFA approval", not a public release.
Review the candidate in the npmjs.com Staged Packages tab and approve it with
MFA. Alternatively, from an authenticated local terminal:

```sh
npm stage list @webdyne/webdyne-cloudflare
npm stage view <stage-id>
npm stage approve <stage-id>
```

Replace `<stage-id>` with the reviewed candidate's ID. Compare the staged
archive against the qualified GitHub release before approval. After approval,
check the public version and compare `dist.integrity` with that archive:

```sh
npm view @webdyne/webdyne-cloudflare@<version> version dist.integrity --json
```

Approval remains a maintainer action and is never performed by this workflow.
Version 1.2.0 was published interactively as the initial package; staging is
for subsequent versions. Do not rerun the old direct-publication job or attempt
to restage 1.2.0. See the [npm staging guide](https://docs.npmjs.com/staged-publishing/).

Only `README.md` and [TEST.md](TEST.md) are retained as root Markdown in the
release branch. Module API sidecars remain beside the Perl source files;
development planning notes remain on the development branches.

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

The current surfaces intentionally exclude D1 session APIs, R2 streaming
and multipart uploads, cross-service retries, and active cancellation.
