import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [base, secretPath, resultPath] = process.argv.slice(2);
if (!resultPath) throw new Error("Usage: node smoke.mjs WORKER_URL SECRET_FILE RESULT_FILE");
const secret = JSON.parse(await readFile(secretPath, "utf8")).PROTOTYPE_TOKEN;
const report = { started: new Date().toISOString(), runs: [] };
const call = (path, options = {}) => fetch(new URL(path, base), {
  headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(60000), ...options });
assert.equal((await fetch(new URL("/run", base))).status, 401);
assert.equal((await call("/run", { headers: { authorization: "Bearer wrong" } })).status, 401);
report.auth = true;
try {
  for (let index = 0; index < 2; index++) {
    const token = randomUUID(); const run = { token }; report.runs.push(run);
    try {
      const response = await call(`/run?token=${token}`);
      const body = await response.text();
      assert.equal(response.status, 200, body);
      run.api = JSON.parse(body);
      assert.deepEqual(run.api, { typed: 1, fixture: 1, statement: 1, crud: 1, transactions: 1, disconnect: 1 });
      const rows = await (await call(`/verify?token=${token}`)).json();
      assert.deepEqual(rows, [{ slot: 1, value: "committed" }]); run.independentVerification = true;
    } finally {
      const response = await call(`/cleanup?token=${token}`, { method: "POST" });
      assert.equal(response.status, 200); run.cleanup = await response.json();
      assert.deepEqual(await (await call(`/verify?token=${token}`)).json(), []); run.cleanupVerified = true;
    }
  }
} finally {
  report.finished = new Date().toISOString();
  await writeFile(resultPath, JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report));
