# Generated application and failure qualification

This fixture uses the production extension manifest and generated Worker without
editing generated code. Its wrapper adds temporary bearer authentication and
independent PostgreSQL verification. Use only the dedicated test database from
TEST.md, with Hyperdrive caching disabled. It never resets fixture tables.

From the source checkout:

```sh
node prototypes/hyperdrive-qualification/stage.mjs RUNTIME_TARBALL EXTENSION_TARBALL NEW_DIRECTORY
```

In that new directory, install the two local archives and generate the application:

```sh
npm install --ignore-scripts
npm run check
node --input-type=module <<'JS'
import {readFile,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile('.webdyne/wrangler.jsonc','utf8'));
config.main='worker.js';
config.preview_urls=false;
config.vars.PROTOTYPE_EXPIRES=String(Date.now()+3600000);
await writeFile('wrangler-auth.jsonc',JSON.stringify(config,null,2));
JS
npx --no-install wrangler deploy --dry-run --config wrangler-auth.jsonc
npx --no-install wrangler deploy --config wrangler-auth.jsonc --secrets-file .deployment-secrets.json
```

The generated database resource and extension selection are unchanged. The wrapper
uses pg 8.16.3 independently of the Perl bridge. All routes require the generated
mode-0600 bearer secret and expire after one hour. No credentials enter package.json.

From the source checkout, run:

```sh
node prototypes/hyperdrive-qualification/smoke.mjs WORKER_URL SECRET_FILE RESULT_FILE
```

The suite covers the phase-3 CRUD/type/transaction checks, row/byte/connection
limits, a five-second deadline against a six-second sleep, termination of its own
database backend, stale handles, failed-request rollback and interpreter recovery.
The cancellation case uses SSE because ordinary PAGI HTTP responses are buffered.
It observes PgSleep through pg_stat_activity before cancelling the HTTP request,
then verifies rejected completion, the request's aborted flag and absent writes.
Four concurrent reads exercise recovery afterwards.

Origin work can outlive a client timeout. Independent verification therefore has
a 15-second deadline, longer than the deliberate sleep. This is not an assertion
that closing a client synchronously cancels a statement in Hyperdrive's origin pool.

Each case uses a fresh UUID and finally deletes only that UUID's probe rows, then
checks absence independently. Results are saved after each case. If execution is
interrupted, use those tokens to repeat POST /cleanup before deleting the Worker.
No test grants permissions, changes schemas or terminates another backend.

After testing, delete the exact Worker with `wrangler delete NAME --config
wrangler-auth.jsonc`, confirm it is absent, and remove `.deployment-secrets.json`.
Keep only sanitized test evidence in the source checkout.
