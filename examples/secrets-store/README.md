# Secrets Store example

Follow the [installation guide](../README.md#install-and-run),
then run `npm run check` to generate `.webdyne/wrangler.jsonc`.
The all-zero store ID is a local placeholder, not a production resource.

Create a dummy secret in the local store using the same generated configuration:

```sh
npx wrangler secrets-store secret create 00000000000000000000000000000000 --name webdyne-local-demo --scopes workers --config .webdyne/wrangler.jsonc
npm run dev
```

Enter a dummy value at the prompt. Do not add `--remote` for this local example.
The default WebDyne page retrieves the value and renders `Secret retrieval succeeded`.
The [native PAGI alternative](../README.md#native-pagi-alternatives) returns the
same confirmation as plain text. Both set `Cache-Control: no-store`.
It does not return the value or its length. Local persistence stays under
Wrangler's ignored `.wrangler` directory.

For deployment, replace the store ID and secret name with an existing account
secret configured with the `workers` scope. Configure bindings independently
in each named Wrangler environment. Creating production resources and deploying
this example are separate operator actions.

See [SecretsStore.pm.md](../../lib/WebDyne/Cloudflare/SecretsStore.pm.md)
for the API, errors, lifecycle, and custom-Worker configuration.
