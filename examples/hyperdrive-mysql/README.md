# MySQL Hyperdrive inventory example

Copy this directory outside the source checkout, replace the Hyperdrive ID in
package.json with your MySQL configuration, and apply schema.sql to that database.
Install dependencies and run `npm run check`. The generated endpoint returns a
bounded, read-only inventory. Version 1.4.0 of the extension and the 1.0.11 runtime
must be approved for npm publication, or install the equivalent local archives.

Driver selection follows the binding's `mysql:` scheme. For local development,
set `WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB` privately and run `npm run dev`.
Never commit credentials. Use the runtime's `webdyne-cloudflare deploy` command
for your own deployment.

For atomic booking in an authenticated application, use an InnoDB transaction:

```perl
await $db_or->transaction(async sub {
    my ($tx_or)=@_;
    my $count=await $tx_or->do(
        'UPDATE demo_inventory SET quantity=quantity-? WHERE sku=? AND quantity>=?',
        undef, $places, $sku, $places);
    die "insufficient places\n" unless $count==1;
    return await $tx_or->selectrow_arrayref(
        'SELECT quantity FROM demo_inventory WHERE sku=?', undef, $sku);
});
```

Validate that `$places` is a positive integer in application code. The conditional
UPDATE prevents overbooking; use the callback handle for all transaction work.
MySQL has no PostgreSQL RETURNING equivalent for this statement. For generated
INSERT keys, execute a prepared statement and read its `insert_id()` string.
