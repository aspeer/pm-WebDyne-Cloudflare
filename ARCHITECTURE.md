# Architecture

```text
WebDyne PSP
  -> WebDyne::Cloudflare::D1 / Statement (Perl, Future API)
  -> JSON capability protocol (BLOB fields use base64 envelopes)
  -> D1HostBridge (JavaScript)
  -> request-scoped capability map
  -> Cloudflare D1Database binding
```

The bridge object is isolate-scoped, while every capability is request-scoped.
The PAGI scope carries only a random token, protocol version, and allowed
binding names. The adapter retains the corresponding D1 objects in a private
map and removes them at session completion.

Prepared statements are represented in Perl as immutable SQL-plus-parameter
objects. No Cloudflare statement handle survives a call. This avoids binding
object lifetime problems, makes retries and diagnostics explicit, and keeps
the wire request serializable.

The adapter is Cloudflare-specific and belongs in this distribution. The
generic asynchronous host-call implementation remains in ZeroPerl and
`@aspeer/zeroperl-ts`; WebDyne core is unchanged.
