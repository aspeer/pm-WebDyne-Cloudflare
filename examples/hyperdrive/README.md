# Hyperdrive inventory example

Copy this directory outside the source checkout. Replace the Hyperdrive ID in
package.json with an existing caching-disabled PostgreSQL configuration. Apply
schema.sql to your demonstration database, install dependencies, then run
`npm run check`. The generated Worker exposes a bounded, read-only JSON inventory.

For local development, set `WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB` in your
private environment and run `npm run dev`. Never commit a connection string.
For remote deployment use the runtime's `webdyne-cloudflare deploy` command.
The example requires the staged 1.0.11 runtime and 1.3.0 extension to be approved,
or install the equivalent qualified local tarballs before running it.

For write operations, use a transaction callback in your authenticated application:

```perl
await $db_or->transaction(async sub {
    my ($tx_or)=@_;
    my $row_ar=await $tx_or->selectrow_arrayref(
        'UPDATE demo_inventory SET quantity=quantity-$1 WHERE sku=$2 AND quantity>=$1 RETURNING quantity',
        undef, $places, $sku);
    die "insufficient places\n" unless $row_ar;
    return $row_ar->[0];
});
```

The comparison and update occur in one statement, avoiding a read-then-write
race when two requests book places. Bind values separately; use the callback
facade for all related database work.
