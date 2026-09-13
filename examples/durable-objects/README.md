# Perl Durable Object counter

Requires ZeroPerl 1.0.13+ and WebDyne::Cloudflare 1.7.0+. Until those candidates are
published, install their qualified local tarballs instead of the version ranges.

```sh
npm install
npm run check
npm run dev
```

GET reads the named `example` counter; POST increments it by one. The generated
Worker exports `Counter` and declares SQLite storage. `lib/Example/Counter.pm`
contains ordinary Perl handlers. Changing the object name selects an independent
counter. Restarting the local Worker preserves SQLite data in Wrangler's local
storage. Deployment creates a persistent namespace; review the generated Wrangler
configuration before deploying. See the module's DurableObject.pm.md for the API,
capability lifetimes, limits, and configuration for external objects.
