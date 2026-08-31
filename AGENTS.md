# WebDyne Cloudflare integration instructions

This repository owns the Perl-facing `WebDyne::Cloudflare::*` distributions,
their Cloudflare host adapters, examples, tests, and packaging documentation.

- Keep Cloudflare binding objects in JavaScript; Perl receives opaque
  request-scoped capabilities only.
- Keep WebDyne core and the canonical ZeroPerl ABI provider-neutral.
- Prefer Future-returning Perl APIs and prepared statements.
- Put JavaScript/Perl wire encoding in this distribution's host adapter.
- Preserve ordinary MakeMaker layout and make all shipped non-Perl assets part
  of `MANIFEST` and the generated distribution.
- Use feature branches and do not push, deploy a Worker, or publish a release
  without explicit approval.
- Run `perl Makefile.PL`, `make test`, and the relevant Wrangler local/remote
  checks before committing substantive work.
