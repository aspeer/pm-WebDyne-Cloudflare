# Plans

## Milestone 2: D1 vertical slice

Status: complete

Branch: `webdyne-cloudflare/m2-d1-bridge`

- [x] Define the request-scoped capability protocol.
- [x] Implement the Perl database and statement facades.
- [x] Implement the JavaScript D1 host adapter.
- [x] Pass Perl, JavaScript, MakeMaker, and PSP lint tests.
- [x] Integrate the adapter with the persistent WebDyne Worker.
- [x] Prove parameterized insert/select, NULL, number, text, and BLOB values
  against local D1.
- [x] Prove structured errors and interpreter reuse after a failed query.
- [x] Run repeated and concurrent request checks.
- [x] Create and validate the approved non-production remote D1 fixture.
- [x] Run the WebDyne Worker against the remote binding using an approved
  ephemeral Wrangler preview.

## Milestone 3: npm extension distribution

Status: complete

Branch: `codex/npm-extension-packaging`

- [x] Package the Perl facades and JavaScript bridge together as
  `@webdyne/webdyne-cloudflare`.
- [x] Export declarative WebDyne extension metadata and a Cloudflare lifecycle
  factory.
- [x] Validate an exact npm package allow-list.
- [x] Add guarded GitHub Release and npm-candidate workflows with SHA-256
  manifests and build-provenance attestations.
- [x] Integrate through the ZeroPerl extension lifecycle and an independent
  application consumer.
