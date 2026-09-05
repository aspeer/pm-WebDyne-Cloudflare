# Architecture

```text
WebDyne PSP
  -> WebDyne::Cloudflare::{D1,KV,R2} (separate Perl Future APIs)
  -> service-specific JSON protocols (byte fields use base64 envelopes)
  -> D1HostBridge / KVHostBridge / R2HostBridge (separate JavaScript modules)
  -> independent request-scoped capability maps
  -> allow-listed Cloudflare D1, KV, and R2 bindings
```

The bridge object is isolate-scoped, while every capability is request-scoped.
The PAGI scope carries only a random token, protocol version, and allowed
binding names. The adapter retains the corresponding D1 objects in a private
map and removes them at session completion. Each service receives a separate
token, so permission to use one service does not imply permission to use
another.

Prepared statements are represented in Perl as immutable SQL-plus-parameter
objects. No Cloudflare statement handle survives a call. This avoids binding
object lifetime problems, makes retries and diagnostics explicit, and keeps
the wire request serializable.

KV values and R2 bodies cross the protocol either as Unicode text or explicit
base64 byte envelopes. R2 response metadata has a stable snake_case Perl
shape. The current R2 API is buffered and bounded; streaming and multipart
operations require a future protocol that models backpressure and cleanup.

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
  js/kv-host.js                Workers KV capability implementation
  js/r2-host.js                R2 capability implementation
  js/storage-host.js           shared validation and byte-envelope primitives
```

The ZeroPerl application builder resolves only packages explicitly named by
`webdyne.extensions` and requires each to be a direct production dependency.
It reads the exported manifest without executing extension code, packages the
declared Perl library, and emits a static provider import for Wrangler. At run
time the portable extension manager registers host functions once per Perl
interpreter generation, attaches capabilities to a single PAGI scope, and
executes cleanups once in reverse order.

Resource identifiers are application/provider configuration and never belong
in this reusable package. `webdyne.cloudflare.d1Databases`, `kvNamespaces`,
and `r2Buckets` supply Wrangler bindings. The extension's `d1Bindings`,
`kvBindings`, and `r2Bindings` are independent security allow-lists exposed to
Perl.
