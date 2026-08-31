# Plans

## Milestone 2: D1 vertical slice

Status: local vertical slice complete; remote Worker execution gated

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
- [ ] Run the WebDyne Worker against the remote binding after explicit Worker
  deployment approval.
