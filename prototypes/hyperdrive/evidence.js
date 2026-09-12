import pg from "pg";

// Request identity stays local; durable observations use a unique run token in
// the existing test table so readers do not depend on isolate placement.
export const requestEvidence = new WeakMap();
export const EVIDENCE_SLOT = 9000;

export async function withClient(binding, callback) {
  const client = new pg.Client({connectionString: binding.connectionString, connectionTimeoutMillis: 5000, query_timeout: 5000});
  client.on("error", () => {});
  try {
    await client.connect();
    return await callback(client);
  } finally { await client.end(); }
}

export async function writeEvidence(binding, evidence) {
  await withClient(binding, (client) => client.query(
    "INSERT INTO webdyne_hyperdrive_test.transaction_probe(run_token,slot,value) VALUES($1,$2,$3) ON CONFLICT(run_token,slot) DO UPDATE SET value=EXCLUDED.value",
    [evidence.token, EVIDENCE_SLOT, JSON.stringify(evidence)],
  ));
}
