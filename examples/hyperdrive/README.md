# PostgreSQL Hyperdrive inventory

The default `app/app.psp` renders an HTML inventory table with WebDyne.
The alternate `app/app.pagi` returns the same bounded rows as JSON.
Both bind the row limit using `$1` and escape or serialize returned data.

Follow the [installation guide](../README.md#install-and-run). Replace the
Hyperdrive ID in package.json with your configuration and apply `schema.sql`
to a disposable PostgreSQL database. For local development, set
`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB` privately before running:

```sh
npm run check
npm run dev
```

Open `/` to see the seeded inventory. The query is read-only and limited to
100 rows. Local connection strings bypass Hyperdrive pooling/caching; use a
cache-disabled Hyperdrive binding for remote read-after-write checks.
Credentials never belong in package.json or source control.

See [native PAGI switching](../README.md#native-pagi-alternatives) and the
[Hyperdrive API](../../lib/WebDyne/Cloudflare/Hyperdrive.pm.md) for statements,
transactions, exact types, deadlines, cleanup and dialect restrictions.
