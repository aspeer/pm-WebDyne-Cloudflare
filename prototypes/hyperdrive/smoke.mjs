import assert from "node:assert/strict";

const base = process.argv[2] ?? "http://127.0.0.1:8794";
for (let index = 0; index < 2; index += 1) {
  const response = await fetch(base, {signal: AbortSignal.timeout(30_000)});
  const text = await response.text();
  assert.equal(response.status, 200, text.slice(0, 1500));
  const body = JSON.parse(text);
  assert.equal(body.typed, 1);
  assert.equal(body.fixture, 1);
  assert.equal(body.rollback, 1);
  if (index > 0) assert.equal(body.stale, 1);
  const metrics = JSON.parse(response.headers.get('x-prototype-metrics'));
  assert.equal(response.headers.get('x-prototype-completion'), 'ok');
  assert.equal(metrics.attached, metrics.released);
  assert.equal(metrics.opened, metrics.closed);
  assert.ok(metrics.rolledBack >= index + 1);
  const verified = await fetch(`${base}/verify?token=${body.token}`, {signal: AbortSignal.timeout(15_000)});
  assert.equal(verified.status, 200);
  assert.deepEqual(await verified.json(), {remaining: '0'});
  console.log(JSON.stringify({request: index + 1, body, metrics, independentRollback: true}));
}
const failed = await fetch(`${base}/fail`, {signal: AbortSignal.timeout(30_000)});
assert.equal(failed.status, 500);
await failed.text();
assert.equal(failed.headers.get('x-prototype-completion'), 'failed');
const metrics = JSON.parse(failed.headers.get('x-prototype-metrics'));
assert.equal(metrics.attached, metrics.released);
assert.equal(metrics.opened, metrics.closed);
assert.ok(metrics.rolledBack >= 3);
console.log(JSON.stringify({applicationFailureCleanup: true, metrics}));
