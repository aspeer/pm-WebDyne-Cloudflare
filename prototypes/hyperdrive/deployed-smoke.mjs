import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile, writeFile} from "node:fs/promises";

const [base, secretPath, outputPath] = process.argv.slice(2);
if (!base || !secretPath || !outputPath) throw new Error('Usage: node deployed-smoke.mjs URL SECRET_FILE RESULT_FILE');
const {PROTOTYPE_TOKEN} = JSON.parse(await readFile(secretPath, 'utf8'));
const headers = {authorization: `Bearer ${PROTOTYPE_TOKEN}`};
const runs = [];
const results = {base, startedAt: new Date().toISOString(), tests: []};

async function request(path, options = {}) {
  return fetch(new URL(path, base), {headers, signal: AbortSignal.timeout(15_000), redirect: 'error', ...options});
}

async function evidence(token) {
  const response = await request(`/evidence?token=${token}`);
  assert.equal(response.status, 200);
  return response.json();
}

async function poll(token, accept, milliseconds = 15000) {
  const deadline = Date.now() + milliseconds;
  let value;
  do {
    value = await evidence(token);
    if (accept(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  } while (Date.now() < deadline);
  throw new Error(`Evidence deadline: ${JSON.stringify(value)}`);
}

try {
  const unauthenticated = await fetch(new URL('/health', base), {signal: AbortSignal.timeout(15000)});
  assert.equal(unauthenticated.status, 401);
  await unauthenticated.text();
  const bad = await request('/health', {headers: {authorization: `Bearer ${'0'.repeat(64)}`}});
  assert.equal(bad.status, 401);
  await bad.text();
  assert.equal((await request('/health')).status, 200);
  results.authentication = true;

  for (const route of ['/core', '/fail']) {
    const token = randomUUID(); runs.push(token);
    const response = await request(`${route}?token=${token}`);
    assert.equal(response.status, route === '/core' ? 200 : 500);
    const body = await response.text();
    if (route === '/core') {
      const result = JSON.parse(body);
      assert.equal(result.typed, 1); assert.equal(result.rollback, 1);
    }
    const checked = await poll(token, (value) => value.evidence?.completedAt);
    assert.equal(checked.remaining, 0);
    assert.equal(checked.evidence.rolledBack, true);
    assert.ok(checked.evidence.closedAt);
    results.tests.push({route, ...checked});
    console.log(JSON.stringify({route, passed: true, evidence: checked.evidence}));
  }

  const token = randomUUID(); runs.push(token);
  const controller = new AbortController();
  const pending = request(`/abort?token=${token}`, {signal: controller.signal});
  void pending.catch(() => undefined);
  try {
    const active = await poll(token, (value) => value.activity?.state === 'active' && value.activity?.wait === 'PgSleep');
    results.queryWasRunning = active;
    controller.abort();
    await pending.then((response) => response.body?.cancel(), () => undefined);
    const checked = await poll(token, (value) => value.evidence?.completedAt, 20000);
    results.tests.push({route: '/abort', ...checked});
    assert.equal(checked.evidence.requestAborted, true, 'deployed Worker did not observe cancellation');
    assert.equal(checked.remaining, 0);
    assert.equal(checked.evidence.rolledBack, true);
    assert.ok(checked.evidence.closedAt);
    assert.ok(checked.evidence.abortedAt < checked.evidence.queryFinishedAt, 'cancellation was not observed during database I/O');
    console.log(JSON.stringify({route: '/abort', passed: true, evidence: checked.evidence}));
  } finally { controller.abort(); await pending.then((response) => response.body?.cancel(), () => undefined); }
  const recoveryToken = randomUUID(); runs.push(recoveryToken);
  const recovered = await request(`/core?token=${recoveryToken}`);
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).typed, 1);
  const recovery = await poll(recoveryToken, (value) => value.evidence?.completedAt);
  assert.equal(recovery.remaining, 0);
  assert.equal(recovery.evidence.completion, 'fulfilled');
  assert.equal(recovery.evidence.rolledBack, true);
  assert.ok(recovery.evidence.closedAt);
  results.tests.push({route: '/core-after-abort', ...recovery});
  console.log(JSON.stringify({route: '/core-after-abort', passed: true, evidence: recovery.evidence}));
  results.passed = true;
} catch (error) {
  results.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  results.cleanup = [];
  for (const token of runs) {
    // Allow final observation writes to settle before removing this run's rows.
    try {
      await poll(token, (value) => value.evidence?.completedAt, 20000);
      const response = await request(`/cleanup?token=${token}`, {method: 'POST'});
      assert.equal(response.status, 200);
      const deleted = await response.json();
      const checked = await evidence(token);
      assert.equal(checked.remaining, 0); assert.equal(checked.evidence, null);
      results.cleanup.push({token, ...deleted, verified: true});
    } catch (error) { results.cleanup.push({token, error: error.message}); process.exitCode = 1; }
  }
  results.finishedAt = new Date().toISOString();
  await writeFile(outputPath, JSON.stringify(results, null, 2));
}
