# MySQL qualification fixture

See [the qualification report](../../HYPERDRIVE-MYSQL.md) and
[testing instructions](../../TEST.md#hyperdrive-mysql-140).

Stage with `node stage.mjs RUNTIME_TARBALL EXTENSION_TARBALL NEW_DIRECTORY`,
install the generated package, and run its build/check scripts. Copy the generated
Wrangler config to the staging directory root, retaining main `worker.js` to use
the authenticated wrapper; adjust its schema path to `node_modules/wrangler/config-schema.json`.
Deploy with the generated `.deployment-secrets.json`, which expires after an hour.
The checked-in Hyperdrive ID refers to the owner's disposable Aiven test database.
Run `node smoke.mjs WORKER_URL SECRET_FILE RESULT_FILE` from this directory.

Never deploy the generated unauthenticated entry point for these write tests.
Remove the temporary Worker and secret after use. Result reports contain test
outcomes and synthetic rows, not database credentials.
