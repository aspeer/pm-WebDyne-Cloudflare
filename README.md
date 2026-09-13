# WebDyne::Cloudflare

`WebDyne::Cloudflare` lets Perl applications use Cloudflare D1 databases,
Workers KV, R2 buckets, and PostgreSQL/MySQL through Hyperdrive. Install it as `@webdyne/webdyne-cloudflare` alongside
[the WebDyne ZeroPerl runtime](https://github.com/aspeer/zeroperl/blob/main/WEBDYNE.md).
The package includes the Perl modules and JavaScript adapters; you don't need
to install the modules separately from CPAN. It works with PSP pages and plain
PAGI applications which receive the extension's request scope.

Service operations return Futures. The real Cloudflare bindings stay in
JavaScript, while Perl gets a small request-scoped handle. The module requires
Perl 5.20 or later; the WASM integration is tested with Perl 5.44.

Hyperdrive/PostgreSQL support requires ZeroPerl 1.0.11 or later. The
[asynchronous Perl API](lib/WebDyne/Cloudflare/Hyperdrive.pm.md) now supports
DBI-style queries, statements and transactions, with live WASM CRUD validation.
generator selects the separate `./hyperdrive` npm entry point when enabled and
adds Node compatibility to generated Wrangler configuration. The runtime awaits
request cleanup. See TEST.md for the current validation scope.

## Quick start

In your application directory, install the runtime and extension:

```sh
npm init -y                         # only for a new project
npm install @webdyne/webdyne-zeroperl@1 @webdyne/webdyne-cloudflare@1
npx webdyne-cloudflare init
```

Add the configuration below to package.json, using your resource names and IDs.
Create `app/app.psp` (or copy the [example pages](examples/app)), then run
`npm run dev`. The initializer creates directories and commands, not the page.
For general routing, static assets and `.pagi` setup, see the runtime guide.

## Configuration

There are two parts: enable the extension and allow the binding names Perl may
use, then tell Wrangler which resources those names refer to. Merge this
`webdyne` object into your existing package.json:

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

### Hyperdrive / PostgreSQL

Enable Hyperdrive and map the binding to an existing configuration:

```json
{
  "webdyne": {
    "extensions": {
      "@webdyne/webdyne-cloudflare": { "hyperdriveBindings": ["DB"] }
    },
    "cloudflare": {
      "hyperdrive": [{ "binding": "DB", "id": "YOUR_32_HEX_HYPERDRIVE_ID" }]
    }
  }
}
```

Use extension 1.3.0 and runtime 1.0.11 or later, then run `webdyne-cloudflare check`
or `deploy`. No custom extension manifest or generated Worker edits are needed.
D1/KV/R2-only builds retain their original provider. User-owned Wrangler files
remain untouched; add the Hyperdrive binding and `nodejs_compat` yourself in that
case. Choose distinct binding names when combining services.

For local development, put the connection string in the private environment
variable `WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB`. Do not put credentials
in package.json. Use a caching-disabled Hyperdrive configuration when CRUD reads
must immediately reflect writes; Hyperdrive does not invalidate cached reads on
writes. See [Cloudflare local development](https://developers.cloudflare.com/hyperdrive/configuration/local-development/)
and [query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/).

```perl
my $db_or=WebDyne::Cloudflare::Hyperdrive->new(scope => $scope_hr);
my $customer_hr=await $db_or->selectrow_hashref(
    'SELECT id, name FROM customers WHERE id=$1', undef, $customer_id);
await $db_or->disconnect();
```

The [API reference](lib/WebDyne/Cloudflare/Hyperdrive.pm.md) covers transaction
callbacks, DBI-style attribute positions, exact types, deadlines and errors.
The [inventory example](examples/hyperdrive) includes configuration and sample SQL.

### Extension options

Options live in `webdyne.extensions["@webdyne/webdyne-cloudflare"]`:

| Option | Default | Purpose |
| --- | --- | --- |
| `d1Bindings` | No bindings | Array of D1 names Perl may access, such as `["DB"]`. |
| `kvBindings` | No bindings | Array of KV names, such as `["CACHE"]`. |
| `r2Bindings` | No bindings | Array of R2 names, such as `["OBJECTS"]`. |
| `kvMaxValueBytes` | `16777216` (16 MiB) | Maximum KV value payload handled by the bridge. |
| `r2MaxObjectBytes` | `16777216` (16 MiB) | Maximum buffered R2 body handled by the bridge. |

Binding names use uppercase letters, digits and underscores, starting with a
letter or underscore. Use positive integer byte limits. An explicit empty
binding array disables that service, including its compatibility-variable
fallback. These options expose existing bindings; they don't create resources.

### Resource definitions

These arrays live in `webdyne.cloudflare` and are translated by the runtime
CLI into **generated** Wrangler configuration:

| Array | Required fields | Optional fields | Wrangler destination |
| --- | --- | --- | --- |
| `d1Databases` | `binding`, `databaseName`, `databaseId` | `previewDatabaseId` | `d1_databases`: `binding`, `database_name`, `database_id`, `preview_database_id` |
| `kvNamespaces` | `binding` | `namespaceId`, `previewNamespaceId`, `remote` | `kv_namespaces`: `binding`, `id`, `preview_id`, `remote` |
| `r2Buckets` | `binding` | `bucketName`, `previewBucketName`, `jurisdiction`, `remote` | `r2_buckets`: `binding`, `bucket_name`, `preview_bucket_name`, `jurisdiction`, `remote` |

Supply the actual resource identifiers for deployment. KV/R2 allow omitted IDs
or names for local development with the bundled Wrangler. `remote: true`
selects real resources during development where supported; omit it for the
usual local storage workflow. Provisioning resources and creating a D1 schema
are separate from enabling the extension.

If you maintain a root `wrangler.jsonc` or select one with
`webdyne.cloudflare.wranglerConfig`, the runtime leaves it untouched. Put the
resource definitions in that file using Wrangler's names, while keeping the
extension allow-lists in package.json. For example, the equivalent binding
fragment is:

```json
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "webdyne-time",
    "database_id": "CLOUDFLARE-DATABASE-ID"
  }],
  "kv_namespaces": [{
    "binding": "CACHE",
    "id": "CLOUDFLARE-KV-NAMESPACE-ID"
  }],
  "r2_buckets": [{
    "binding": "ASSETS",
    "bucket_name": "my-webdyne-assets"
  }]
}
```

This is a fragment to merge into a working runtime configuration, not a whole
Worker config. Keep its entrypoint, module rules, runtime variables and
`enable_request_signal` flag. Rebuild after changing package options or Perl
modules. Once local checks pass, use `npm run login`, `npm run whoami` and
`npm run deploy` to deploy the configured application.

## Request lifetime and Futures

Cloudflare objects never cross the JavaScript/Perl boundary. The adapter
places separate opaque, request-scoped capabilities and binding allow-lists in
the PAGI `webdyne.cloudflare.d1`, `webdyne.cloudflare.kv`, and
`webdyne.cloudflare.r2` extensions. Every capability is deleted when the
request finishes. Construct service objects inside the request and don't cache
them, prepared statements or pending operations in package globals for later
requests. Lifespan startup has no request service capabilities.

In a PSP handler use `$self->r()->{'scope'}`. In a plain PAGI application use
the `$scope_hr` passed to the application. The extension must be enabled in
either case. Native Perl alone cannot access a binding without a host adapter.

The examples use `->get()` to retrieve results, as the included PSP examples
do. In an asynchronous Perl handler use `await` with Future::AsyncAwait:

```perl
use Future::AsyncAwait;

async sub read_name {
    my ($scope_hr, $id)=@_;
    my $db_or=WebDyne::Cloudflare::D1->new(scope => $scope_hr, binding => 'DB');
    return await $db_or->prepare('SELECT name FROM thing WHERE id = ?1')
        ->bind($id)->first('name');
}
```

Load the service module as shown below. Await all service work within the
request; dropping a Future does not arrange background execution.

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

The D1 constructor defaults to binding `DB`; `binding()` returns its name.
`prepare($sql)` returns a statement, and `bind(@params)` returns a new statement
without modifying the original. You can reuse statements within their request.

| Operation | Future result |
| --- | --- |
| `run()` / `all()` | D1 result hash with `results`, `meta` and `success`. |
| `first()` | First row hash, or undef when no row exists. |
| `first($column)` | One column value, including decoded BLOB bytes. |
| `raw(column_names => 1)` | Arrays of column values, with an optional header row. |
| Database `run($sql, @params)`, `all(...)`, `first(...)` | Convenience calls without explicitly preparing a statement. |

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
Perl code between statements. See [the D1 API](lib/WebDyne/Cloudflare/D1.pm.md) and
[Cloudflare's batch semantics](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

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

| Operation | Options and result |
| --- | --- |
| `get($key, %opt)` | `type` is `text` (default), `json` or `bytes`; optional `cache_ttl` is at least 30 seconds. Missing keys return undef. |
| `get_with_metadata($key, %opt)` | Same read options; returns `value`, `metadata` and optional `cache_status`. |
| `put($key, $value, %opt)` | Text or a KV blob. Optional `expiration` (Unix seconds) or `expiration_ttl` (at least 60 seconds), plus a metadata hash. Don't supply both expiration options. |
| `put_json($key, $value_ref, %opt)` | JSON-encodes a Perl value; accepts the same write options. |
| `delete($key)` | Deletes the key. |
| `list(%opt)` | Optional `prefix`, `cursor` and `limit`; returns `keys`, `list_complete` and `cursor`. Follow the cursor until complete. |

The constructor defaults to binding `KV`; pass `CACHE` when using the example
configuration. KV is eventually consistent, so reads may return older data.
See [the KV API](lib/WebDyne/Cloudflare/KV.pm.md) and
[Cloudflare's consistency explanation](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

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

The constructor defaults to binding `R2`; use `ASSETS` for the configuration
above. This binding name is your R2 bucket handle and is separate from
Cloudflare's static asset serving.

| Operation | Options and result |
| --- | --- |
| `get($key, %opt)` | Buffered Object or undef; optional `range => {offset => 0, length => 1024}` or `{suffix => 1024}`. |
| `head($key)` | Object metadata without a body, or undef. |
| `put($key, $value, %opt)` | Text or R2 blob; returns Object metadata. Options: `http_metadata`, `custom_metadata`, `storage_class`. |
| `delete($key)` | Deletes one key. |
| `delete_many(@keys)` | Deletes 1–1000 keys. |
| `list(%opt)` | Options: `prefix`, `cursor`, `delimiter`, `limit`, `include`. Returns `objects`, `truncated`, optional `cursor` and `delimited_prefixes`. |

These operations return Futures. `list` entries are Object wrappers; follow
the cursor while `truncated` is true. To include metadata, pass
`include => ['httpMetadata', 'customMetadata']`.

HTTP metadata uses `content_type`, `content_language`, `content_disposition`,
`content_encoding`, `cache_control` and `cache_expiry` (an ISO date).
Custom metadata is a hash whose values are sent as strings.

`WebDyne::Cloudflare::R2::Object` has synchronous accessors: `key()`, `version()`,
`size()`, `etag()`, `http_etag()`, `uploaded()`, `http_metadata()`,
`custom_metadata()`, `storage_class()`, `range()` and `body()`. Only a `get`
result has a byte body. `as_hash()` returns a shallow copy; nested metadata
remains shared. See [the R2 API](lib/WebDyne/Cloudflare/R2.pm.md).

## Text, binary data and errors

Perl character strings cross as text. Unflagged non-ASCII strings are decoded
strictly as UTF-8, including SQL, keys, column names and nested metadata/JSON
keys and values. Invalid UTF-8 fails before the host call. Normalization copies
containers without changing caller data; cycles and keys which become identical
after UTF-8 decoding are rejected.

Use the service's `blob($bytes)` wrapper for binary values. Returned binary
data becomes ordinary Perl byte strings. D1 preserves numbers, zero, empty
strings, JSON booleans and SQL NULL (`undef`). KV/R2 `put` treats a plain numeric
body as text; use KV `put_json` to retain JSON numeric/boolean types.

Missing capabilities or invalid constructor arguments throw immediately.
Service operations fail their Future on errors. Host errors use
`WebDyne::Cloudflare::D1::Error`, `KV::Error` or `R2::Error`, with `name()`,
`message()`, `code()` and `cause()` accessors and stringification. Local input
validation errors can be plain exceptions. Catch failures around `await` or
`->get()`; don't assume every exception is a service Error object.

KV values and R2 bodies are buffered, with a default bridge limit of 16 MiB.
KV provider reads are buffered before the limit check; it is not a streaming
memory guarantee. R2 rejects oversized reads and cancels unread bodies.
Increasing the limits increases interpreter/Worker memory pressure and does
not lift Cloudflare's own service limits.

D1 sessions, R2 streaming, multipart uploads, conditional requests, signed URL
generation, automatic retries and active operation cancellation are not
implemented. Use the documented methods rather than assuming the complete
JavaScript binding API is available in Perl.

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

No binding is exposed unless its name appears in the corresponding allowlist:
`d1Bindings`, `kvBindings`, `r2Bindings`, `hyperdriveBindings`, or
`secretsStoreBindings`. The comma-separated `WEBDYNE_D1_BINDINGS`,
`WEBDYNE_KV_BINDINGS`, and `WEBDYNE_R2_BINDINGS` variables remain compatibility
paths for custom Workers.

## Release packaging

Gitea (`origin`) is the authoritative repository; GitHub is its push mirror.
Merge source changes into main and push with `git push origin main`. Verify
that GitHub main has the same commit before dispatching its release workflows.
Requests to "push to GitHub" mean publishing through Gitea, not pushing directly
to the mirror. Configure local main to track `origin/main`.

For build and npm staging without creating mirror-local tags, run the release
workflow with `publish_release=false`, then stage using its `source_run_id`.
Version 1.4.0 includes PostgreSQL and MySQL Hyperdrive support.

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

Module API sidecars remain beside the Perl source files. See [TEST.md](TEST.md)
for test commands and qualification limits. The maintained branches are `main`
and `development`.

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

### MySQL Hyperdrive

Version 1.4.0 adds MySQL and compatible database support through mysql2 3.24.4.
The binding's connection scheme selects the driver automatically; keep the same
`hyperdriveBindings` configuration and use MySQL `?` placeholders in SQL.
ZeroPerl 1.0.11 supports this extension without rebuilding the runtime.

See the [MySQL example](examples/hyperdrive-mysql/README.md),
[API and restrictions](lib/WebDyne/Cloudflare/Hyperdrive.pm.md#mysql-and-compatible-databases),
and [qualification report](HYPERDRIVE-MYSQL.md). PostgreSQL's existing API and `$1`
placeholders remain supported. MySQL and PostgreSQL SQL dialects are not translated.

## Secrets Store

`WebDyne::Cloudflare::SecretsStore` retrieves an account-level secret through
an explicitly allowed Worker binding. `get()` takes no arguments and returns a
Future resolving to the secret string. The adapter fetches lazily, adds no
value cache, revokes request capabilities on cleanup and sanitizes errors.

Configure extension option `secretsStoreBindings: ["API_KEY"]` and generator
resource `webdyne.cloudflare.secretsStoreSecrets` entries containing `binding`,
`storeId` and `secretName`. The generator emits Wrangler `secrets_store_secrets`.
This needs the Secrets Store generator in ZeroPerl 1.0.12; older runtimes can
use a user-owned Wrangler file. No Secrets Store compatibility flag is needed.
The existing Hyperdrive provider supports Secrets Store alongside databases.

See the [API sidecar](lib/WebDyne/Cloudflare/SecretsStore.pm.md) and
[local example](examples/secrets-store/README.md). Ordinary Worker string
secrets and store management operations are not part of this API.

## D1 read replication

D1 now supports opt-in `with_session()` and `get_bookmark()` through the
[Sessions API](lib/WebDyne/Cloudflare/D1.pm.md#sessions-and-read-replication).
Use a session for replica reads and carry its bookmark between related requests.
Existing D1 calls retain primary-only routing. Enable replication separately
in Cloudflare database settings.
