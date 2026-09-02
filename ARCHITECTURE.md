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

## npm extension boundary

The published package keeps source ownership together without merging provider
code into the portable runtime:

```text
@webdyne/webdyne-cloudflare
  webdyne-extension.json       declarative build metadata
  lib/WebDyne/Cloudflare/*.pm  files mounted at /perl5/lib
  js/cloudflare.js             runtime extension factory
  js/d1-host.js                request capability implementation
```

The ZeroPerl application builder resolves only packages explicitly named by
`webdyne.extensions` and requires each to be a direct production dependency.
It reads the exported manifest without executing extension code, packages the
declared Perl library, and emits a static provider import for Wrangler. At run
time the portable extension manager registers host functions once per Perl
interpreter generation, attaches capabilities to a single PAGI scope, and
executes cleanups once in reverse order.

D1 database identifiers are application/provider configuration and never
belong in this reusable package. `webdyne.cloudflare.d1Databases` supplies the
Wrangler bindings while extension `d1Bindings` is the independent security
allow-list exposed to Perl.
