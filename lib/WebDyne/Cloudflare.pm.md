# WebDyne::Cloudflare

Cloudflare service capabilities for WebDyne::PAGI. This npm-first distribution
ships Perl facades and JavaScript host adapters together. It requires Perl 5.20
or later and Future::AsyncAwait; WASM verification currently uses Perl 5.44.

See [D1](Cloudflare/D1.pm.md), [KV](Cloudflare/KV.pm.md), and
[R2](Cloudflare/R2.pm.md). Cloudflare binding objects stay in JavaScript.
Each Perl facade carries only a request-scoped capability and binding name.
Never retain a facade beyond the request which created it.
