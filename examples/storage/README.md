# D1, KV and R2 WebDyne pages

Follow the [installation guide](../README.md#install-and-run), then initialize
local D1 using the generated configuration:

```sh
npx wrangler d1 execute DB --local --config .webdyne/wrangler.jsonc --file schema.sql
npm run dev
```

Open `/d1.psp`, `/d1-api/row/1`, `/kv.psp`, and `/r2.psp`. D1 reads a seeded row
and exposes a WebDyne JSON API. KV/R2 write a fixed greeting only on form submission.
These pages demonstrate HTML escaping and separately bound SQL parameters.

`perl tools/stage-worker.pl NEW_DIRECTORY` from the repository stages this storage
application into a fresh directory. Its configuration comes from package.json;
there is no second, partially configured Wrangler file to maintain.

Replace placeholders with your resources before remote deployment. KV is
eventually consistent. These examples are independent of the full storage smoke
fixtures under `t/fixtures/app`.
