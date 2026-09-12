# Hyperdrive phase 1 prototype

This isolated package proves Perl WASM host calls through `pg@8.16.3` and the
dedicated Hyperdrive PostgreSQL fixture. It is not a production implementation
and is excluded from the parent npm package's `files` allow-list.

Build a development runtime in the ZeroPerl support branch:

```sh
npm run pack:dev -- --from-npm
```

Stage this prototype into a new temporary directory, using the tarball path
printed by that command:

```sh
node prototypes/hyperdrive/stage.mjs /absolute/path/to/runtime.tgz /tmp/hyperdrive-probe
cd /tmp/hyperdrive-probe
npm install --ignore-scripts
npm run build
npx wrangler deploy --dry-run
npx wrangler dev --remote --ip 127.0.0.1 --port 8794 --inspector-port 9294
```

From the Cloudflare repository:

```sh
node prototypes/hyperdrive/smoke.mjs http://127.0.0.1:8794
```

The configured resource is `webdyne-hyperdrive-test`, ID
`df3fabff9d60423bb31e3a98cb28b032`, targeting the dedicated `hyperdrive_test`
database. Caching must remain disabled. Remote preview uses the actual database;
all writes use fresh run tokens in `webdyne_hyperdrive_test.transaction_probe`
inside transactions that are rolled back. Seed rows are read only.

The default smoke checks bound Unicode/NULL/BYTEA/BIGINT/NUMERIC, fixture reads,
transaction reads and rollback, expired capabilities, automatic rollback and
connection closure on both success and an intentional Perl exception. An
independent connection verifies successful-request cleanup. The test wrapper
waits for runtime completion before returning metrics, so it deliberately delays
the HTTP response and is not the production response path.

Remote preview buffered small streaming responses and cross-request metrics did
not reliably observe the active query. Use the authenticated deployment harness
below for client-disconnect testing; it uses durable per-request evidence.

The host's result limit is post-buffer: it does not bound driver peak memory.
Forced close uses pg's internal connection stream and is only a prototype choice.
The ten-second lifecycle deadline is unit-tested, but forced database socket
closure and interpreter recycling still require integration tests.

Run `worker.js` only through the local remote-preview forwarding endpoint. Do not
deploy that unauthenticated wrapper publicly. Stop Wrangler when finished.

## Authenticated temporary deployment

After staging and installing, prepare a separate deployment configuration:

```sh
node prototypes/hyperdrive/prepare-deployment.mjs /tmp/hyperdrive-probe
cd /tmp/hyperdrive-probe
npm run build
npx wrangler deploy --config wrangler-deployed.jsonc --dry-run
npx wrangler deploy --config wrangler-deployed.jsonc --secrets-file .deployment-secrets.json
```

This uses `deployed-worker.js`, protects every route with a random 256-bit bearer
token, and rejects requests after one hour. The secret file is created with mode
0600 in the staging directory; do not copy it into source control. Preparation
refuses to replace an existing deployment config or secret. Record the resulting
Worker name for removal.

Run from the repository with the URL printed by Wrangler:

```sh
node prototypes/hyperdrive/deployed-smoke.mjs WORKER_URL /tmp/hyperdrive-probe/.deployment-secrets.json /tmp/hyperdrive-results.json
```

The deployed runner verifies authentication, normal requests, an intentional Perl
exception, real client cancellation during PostgreSQL `PgSleep`, and recovery.
Diagnostics are stored in slot 9000 under each unique run token in the existing
transaction_probe table, using a separate autocommit connection. The actual
application writes use slots 0/1 and must roll back. Each diagnostic row is removed
and absence verified in the runner's final cleanup. A failure to settle cleanup
is reported and may require manual removal of that exact run token's rows.

After testing, delete the exact temporary Worker and its local secret file:

```sh
cd /tmp/hyperdrive-probe
npx wrangler delete --config wrangler-deployed.jsonc
rm .deployment-secrets.json
```

Do not use force deletion or modify the Hyperdrive configuration. The successful
2026-09-12 results are saved in `results/deployed.json`: all four request scenarios
passed, all diagnostic rows were deleted, and Cloudflare confirmed Worker removal.
Cancellation drained the five-second query before rollback/closure; immediate
SQL cancellation and forced socket closure are not claimed.
