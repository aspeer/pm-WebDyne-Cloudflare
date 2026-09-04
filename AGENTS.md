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

- Use `app` for PSP directories. User-facing examples belong in `examples/app`;
  smoke tests must use their own `t/fixtures/app` and SQL fixtures.
- Keep Perl/related tests under `t` and JavaScript tests and smoke tooling under
  `t.js`. Do not stage or execute user examples as smoke-test fixtures.
- Follow the Perl house style, with typed reference suffixes, explicit call
  parentheses and clear grouping of mixed logical/comparison expressions.
- Maintain module documentation in `.pm.md` sidecars, not independent POD.
