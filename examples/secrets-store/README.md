# Secrets Store example

## Quick start

Requires Node.js 24+ and npm. From the repository root, copy this example into a
new directory and work there:

```sh
cp -R examples/secrets-store /tmp/webdyne-secrets-store-example
cd /tmp/webdyne-secrets-store-example
npm install
npm run setup:local
npm run check
npm run dev
```

Open the local URL printed by Wrangler (normally `http://localhost:8787/`).
Stop the Worker with Ctrl-C.

These examples require runtime 1.0.14+ and extension 1.7.1+. While their npm
approvals are pending, replace `npm install` above with:

```sh
npm pkg delete dependencies.@webdyne/webdyne-zeroperl
npm install /absolute/path/to/runtime-5.44.tgz /absolute/path/to/cloudflare-extension.tgz
```

## What to expect

`setup:local` builds the Worker configuration and creates a dummy secret in
Wrangler's local store. It explicitly selects `--remote=false`, needs no login,
and uses the fixed non-secret test value `webdyne-test-dummy-do-not-render`.
The store ID and name match package.json. The command can be rerun; it restores
the dummy value for this local demo. Local persistence lives in `.wrangler`.

The default WebDyne page renders `Secret retrieval succeeded`. It never returns
the value or its length, and its cache policy includes `no-store`.

To run the native PAGI supplement, stop the Worker and run:

```sh
npm pkg set webdyne.entry=app.pagi
npm run dev
```

It returns the same confirmation as plain text. Switch back with
`npm pkg set webdyne.entry=app.psp` and restart. Both variants share local storage.

For production, configure your existing account secret and binding deliberately;
`setup:local` is only for this local demo. See the
[Secrets Store API](../../lib/WebDyne/Cloudflare/SecretsStore.pm.md).
