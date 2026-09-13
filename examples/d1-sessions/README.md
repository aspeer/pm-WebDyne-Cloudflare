# D1 sessions and HTTP bookmarks

Install dependencies, then run `npm run check` and `npm run dev`. This example
executes a read-only `SELECT 7` through a session, returns D1 result metadata,
and carries the bookmark in `x-d1-bookmark`. Send the response bookmark back
on the next request. The first request uses `first-primary`.

The placeholder database ID is for local development. Before deployment,
replace it with your database ID and enable read replication in that database's
Cloudflare settings. Local D1 cannot prove remote replica routing or lag behavior.
The example never creates tables or writes data.

See the [D1 sidecar](../../lib/WebDyne/Cloudflare/D1.pm.md#sessions-and-read-replication)
for application usage and consistency choices.
