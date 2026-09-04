# Backlog

- Configure npm Trusted Publishing for `@webdyne/webdyne-cloudflare` before
  replacing the deliberately disabled publication step.
- Add R2 streaming, multipart upload, conditional operations, and active
  cancellation when the host protocol can model backpressure and cleanup.
- Qualify the R2 facade against a remote bucket after R2 is enabled for the
  attached Cloudflare account.
- Add batch and D1 read-replication/session support after the basic prepared
  statement API has production experience.

- Run the native contract suite on the declared Perl 5.20 minimum in CI; this
  refactor was checked on native Perl 5.42.2 and WASM Perl 5.44 only.
- The existing Perl 5.44 runtime emits ambiguous `lc` warnings from embedded
  `CGI::Simple::Cookie` lines 85/89. Track this in the runtime dependency build;
  it did not prevent any local Worker test from passing.
