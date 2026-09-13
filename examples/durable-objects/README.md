# WebDyne Durable Object counter

Follow the [installation guide](../README.md#install-and-run). Open `/` to read
the named `example` counter and submit the form to increment it. The default
`app/app.psp` is a WebDyne page; `lib/Example/Counter.pm` contains ordinary Perl
object handlers. The generated Worker exports `Counter` with SQLite storage.

The [native PAGI alternative](../README.md#native-pagi-alternatives) returns
JSON: GET reads the counter and POST increments it. Both clients use the same
object name, so switching clients preserves its value. Changing the name selects
an independent counter. Restarting the local Worker preserves Wrangler SQLite
state; deleting its `.wrangler` directory removes that local state.

Requires the finite-invocation runtime (1.0.13+); this example uses the qualified
1.0.14 baseline. Deployment creates a persistent namespace. Configure and review
your intended resource before deploying.

See the [handler sidecar](lib/Example/Counter.pm.md) and
[Durable Object API](../../lib/WebDyne/Cloudflare/DurableObject.pm.md) for context
lifetimes, explicit methods, SQL batches, limits and external objects.
