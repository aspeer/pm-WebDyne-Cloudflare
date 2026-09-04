# WebDyne::Cloudflare::D1::Statement

Create statements through `$db_or->prepare($sql)`. `bind(@params)` returns a
new statement without modifying the original.

- `run()` and `all()` return a Future containing the D1 result hash
  (results, meta, success).
- `first()` returns a row hash or undef; `first($column)` returns a column
  value, including decoded BLOB bytes.
- `raw(column_names => 1)` returns arrays of column values, with an optional
  header row.

Statements retain their originating database capability and must not outlive
its request. Failures use WebDyne::Cloudflare::D1::Error.
