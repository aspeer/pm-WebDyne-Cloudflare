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

## Milestone 4: KV and R2 storage facades

Status: complete (remote R2 qualification pending account enablement)

Branch: `codex/kv-r2-storage`

- [x] Add independent Future-returning KV and buffered R2 Perl modules.
- [x] Add modular JavaScript KV and R2 bridges with request-scoped
  capabilities, explicit allow-lists, and byte limits.
- [x] Generate Wrangler KV namespace and R2 bucket bindings from package.json.
- [x] Add isolated Perl, JavaScript, and PSP smoke tests.
- [x] Pass the full KV and R2 flow against local Wrangler storage.
- [x] Pass text, metadata, list, binary, delete, and cleanup checks against an
  isolated remote KV namespace.
- [ ] Repeat the R2 smoke against a remote bucket after R2 is enabled for the
  attached Cloudflare account.
