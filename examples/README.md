# Examples

Each directory is an independent application. WebDyne PSP is the default; native
PAGI supplements demonstrate explicit HTTP responses without page rendering.

| Directory | Default WebDyne page | Native PAGI supplement |
| --- | --- | --- |
| [storage](storage/README.md) | D1 query/JSON API, KV and R2 greeting forms | Not needed for these page examples |
| [hyperdrive](hyperdrive/README.md) | PostgreSQL inventory table | Read-only JSON inventory |
| [hyperdrive-mysql](hyperdrive-mysql/README.md) | MySQL inventory table | Read-only JSON inventory |
| [d1-sessions](d1-sessions/README.md) | Bookmark continuation form | HTTP bookmark/metadata endpoint |
| [secrets-store](secrets-store/README.md) | Non-secret retrieval confirmation | Fixed text response |
| [durable-objects](durable-objects/README.md) | Persistent counter form | JSON GET/POST client |

## Install and run

Copy one directory outside this checkout. For example:

```sh
cp -R examples/d1-sessions /tmp/webdyne-d1-sessions-example
cd /tmp/webdyne-d1-sessions-example
npm install
npm run check
npm run dev
```

The examples require ZeroPerl 1.0.14+ and extension 1.7.1+. Until those versions
are approved on npm, replace `npm install` with explicit qualified tarballs:

```sh
npm pkg delete dependencies.@webdyne/webdyne-zeroperl
npm install /absolute/path/to/runtime-5.44.tgz /absolute/path/to/cloudflare-extension.tgz
```

The runtime tarball supplies `@webdyne/webdyne-zeroperl-5.44.0`; removing the
alias dependency avoids trying to resolve an unpublished alias from npm.
`npm run check` generates and dry-runs the Worker. `npm run build` only generates
it. Service READMEs list any database schema or local secret setup required before
requests work. The default URL is printed by the development command.

## Native PAGI alternatives

For a directory with `app/app.pagi`, stop the Worker, change its entry, and restart:

```sh
npm pkg set webdyne.entry=app.pagi
npm run check
npm run dev
```

Switch back with `npm pkg set webdyne.entry=app.psp`. Both variants use the same
bindings and schema; they are alternate applications, not simultaneous routes.
Durable Object handlers remain ordinary Perl modules in both variants.

## Local and remote resources

Storage IDs in examples are local placeholders. Hyperdrive requires your own
configuration ID and a private local connection string. Configure real resources
explicitly before deployment. The examples are small local demonstrations:
add application authentication and request authorization before exposing writes
publicly. No example prints database credentials or secret values.

Regression fixtures and authenticated database qualification live under `t/` and
`t/integration/`; see [TEST.md](../TEST.md). Build outputs, dependencies and local
Wrangler state are ignored and are not example source.
