# Phase 3 public API fixture

This harness runs the real production Hyperdrive Perl modules and JavaScript
adapter using the dedicated PostgreSQL fixture. It uses an explicit fixture
extension manifest until phase 4 adds generator configuration support.

Create a local extension archive with `npm pack --ignore-scripts`, then stage an
unused temporary directory:

```sh
node prototypes/hyperdrive-api/stage.mjs RUNTIME_TARBALL EXTENSION_TARBALL NEW_DIRECTORY
```

The runtime must include the phase-2 awaited-cleanup marker. Staging copies the
current Perl library, generates a unique Worker name, and creates a mode-0600
secret file with a random bearer token. Authorization expires after one hour.
The named Hyperdrive test binding must have caching disabled. The harness never
creates or resets the database fixture.

In the staged directory, use the installed pinned Wrangler:

```sh
npm install --ignore-scripts
npm run build
npx --no-install wrangler deploy --dry-run --config wrangler.jsonc
npx --no-install wrangler deploy --config wrangler.jsonc --secrets-file .deployment-secrets.json
```

Run the smoke script with the deployed URL, secret file path and output filename:

```sh
node prototypes/hyperdrive-api/smoke.mjs WORKER_URL SECRET_FILE RESULT_FILE
```

Each run uses a new UUID in `webdyne_hyperdrive_test.transaction_probe`. It checks
bound types, fixture reads, statement reuse and fetches, CRUD, explicit commit and
rollback, callback success/failure, SQLSTATE, handle expiry, separate logical
connections and disconnect. The request deliberately leaves one transaction
unfinished. The wrapper awaits runtime completion before responding, and a later
independent PostgreSQL connection must see only the deliberately committed row.
Finally the smoke script deletes that run's rows and independently verifies absence.

All routes require the bearer secret, including `/verify` and POST `/cleanup`.
The smoke tests reject absent/incorrect credentials. Read the result file if a run
fails; it records the token before work starts, so interrupted cleanup can be
repeated for exactly that token while the authenticated Worker is available.

After testing, delete the specific temporary Worker with `wrangler delete NAME`,
verify it is absent, and remove `.deployment-secrets.json`. Do not leave a test
Worker deployed or add secret files to source control. Saved final evidence is
in `results/deployed.json`.
