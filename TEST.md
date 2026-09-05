# Testing WebDyne::Cloudflare

The contract suite checks the Perl facades and JavaScript host adapters for
D1, Workers KV and R2. Tests require Perl 5.20 or later, Future,
Future::AsyncAwait, and Node.js 22 or later. Wrangler integration uses the
version pinned by package-lock.json and a separately supplied Perl 5.44 runtime.

## Contract and package checks

```sh
npm ci --ignore-scripts
perl Makefile.PL
make test
make distcheck
npm run pack:check
```

`npm test` also runs both language suites. Run them separately with
`prove -Ilib t` and `npm run test:js`.

- `t/00-load.t`: installed module loading.
- `t/01-d1.t`: prepared statements, parameter encoding, results and errors.
- `t/02-kv.t`: text, JSON, bytes, metadata and listing.
- `t/03-r2.t`: buffered objects, metadata, ranges, listing and deletion.
- `t/04-regressions.t`: malformed capabilities, binary validation and D1
  column names that resemble internal envelopes.
- `t/05-d1-batch.t`: ordered atomic batch requests, statement ownership,
  reusable parameters, BLOB results and structured failures.
- `t.js/*.test.mjs`: host adapters, capability isolation and expiry, batch
  dispatch, storage byte limits, registration recovery and smoke cleanup.
- `t.js/check-package.mjs`: exact npm package identity and file allow-list.

## Local Worker integration

Create an independent test application using local runtime and extension
tarballs. The destination must not already exist:

```sh
node t.js/prepare-storage-smoke.mjs \
  --runtime-tarball /absolute/path/runtime-5.44.tgz \
  --extension-tarball /absolute/path/cloudflare-extension.tgz \
  --destination /tmp/webdyne-cloudflare-smoke
cd /tmp/webdyne-cloudflare-smoke
npm install --ignore-scripts
npm run build
npm run check
npx wrangler d1 execute DB --local --config .webdyne/wrangler.jsonc --file schema.sql
npm run dev -- --port 8790
```

Use the generated Wrangler configuration path reported by the runtime if its
build layout differs. From this repository, run:

```sh
npm run smoke:d1 -- http://127.0.0.1:8790/
npm run smoke:kv -- http://127.0.0.1:8790/
npm run smoke:r2 -- http://127.0.0.1:8790/
```

`--services d1`, `kv`, `r2`, or a comma-separated subset narrows staging.
Smoke applications use only `t/fixtures/app` and `t/fixtures/schema.sql`.
The user-facing pages in `examples/app` are independent of smoke tests.

D1 checks parameterized writes, JSON routes, failure/recovery, 24 concurrent
reads and eight isolated batch sequences. Each batch checks ordered writes
and reads, rollback on a middle constraint failure, and subsequent recovery.
KV/R2 check storage operations and cleanup; cleanup failure fails the smoke.

Remote execution requires deliberately configured test resources and the
corresponding `--remote true`, `--d1-database-id`, `--kv-namespace-id` or
`--r2-bucket-name` staging options. Test endpoints expose fixture mutations;
use them only in isolated test environments.

## Qualification

The current implementation passed 159 Perl assertions, 32 JavaScript tests,
package checks and local D1/KV/R2 Worker integration. Batch rollback and cleanup
were verified on local D1 through the existing Perl 5.44 WASM interpreter.
Native qualification used Perl 5.42.2; CI additionally tests its Ubuntu Perl.
The declared Perl 5.20 minimum has not yet been separately qualified.

Earlier remote checks qualified basic D1 and KV operations. Remote batch and
R2 qualification remain outstanding. The current embedded CGI::Simple::Cookie
dependency emits two `lc` ambiguity warnings during cold initialization;
requests and tests complete successfully.
