# D1 sessions and bookmarks

Follow the [installation guide](../README.md#install-and-run), then open `/`.
The default WebDyne page executes read-only `SELECT 7` through a session and
carries its next bookmark in a hidden form field and `x-d1-bookmark` response
header. Submit the form to continue that session. A request with no bookmark
starts with `first-primary`. No schema or write is needed.

The [native PAGI alternative](../README.md#native-pagi-alternatives) returns
D1 results and metadata as JSON. Send its `x-d1-bookmark` response header back
on the next request. Local D1 may return no bookmark and cannot prove remote
replica routing or lag. Before remote testing, replace the placeholder database
ID and enable read replication in that database's Cloudflare settings.

See [D1 sessions](../../lib/WebDyne/Cloudflare/D1.pm.md#sessions-and-read-replication)
for consistency choices. Neither variant retains a session object across requests.
