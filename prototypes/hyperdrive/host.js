import pg from "pg";
import {requestEvidence, writeEvidence} from "./evidence.js";

const HOST = "WebDyne::Cloudflare::Hyperdrive::Prototype::call";
const EXTENSION = "webdyne.cloudflare.hyperdrive.prototype";
export const metrics = { attached: 0, released: 0, opened: 0, closed: 0, rolledBack: 0, forced: 0, staleRejected: 0, requestAborted: 0, sleepStarted: 0, maxResultBytes: 0 };

// Connectivity spike only: one lazy client per scope, text results and explicit
// BYTEA envelopes. This is not the proposed production public API.
export function createHyperdrivePrototype() {
  const capabilities = new Map();
  const registered = new WeakSet();
  let previousCapability;

  async function dispatch(wire) {
    const state = capabilities.get(wire.capability);
    if (!state || state.released) {
      metrics.staleRejected += 1;
      throw new Error("expired prototype capability");
    }
    if (wire.version !== 1 || wire.binding !== "DB") throw new Error("invalid prototype request");
    if (wire.operation !== "query" || typeof wire.sql !== "string" || !Array.isArray(wire.params)) throw new Error("invalid prototype operation");
    const values = wire.params.map(([type, value]) => {
      if (type === "null") return null;
      if (type === "text" && typeof value === "string") return value;
      if (type === "bytes" && typeof value === "string") return Buffer.from(value, "base64");
      throw new Error("invalid prototype parameter");
    });
    const pending = state.pending.then(async () => {
      if (state.released) throw new Error("expired prototype capability");
      if (!state.client) {
        const client = new pg.Client({ connectionString: state.binding.connectionString, connectionTimeoutMillis: 5000, query_timeout: 8000 });
        state.client = client;
        client.on("error", () => { state.broken = true; });
        client.on("end", () => { metrics.closed += 1; state.evidence.closedAt = Date.now(); });
        await client.connect();
        metrics.opened += 1;
        state.evidence.openedAt = Date.now();
      }
      if (/^SELECT pg_sleep\([35]\)$/.test(wire.sql)) metrics.sleepStarted += 1;
      const sleeping = /^SELECT pg_sleep\([35]\)$/.test(wire.sql);
      if (sleeping && state.record) {
        const pid = await state.client.query("SELECT pg_backend_pid() AS pid");
        state.evidence.backendPid = pid.rows[0].pid;
        state.evidence.queryStartedAt = Date.now();
        await writeEvidence(state.binding, state.evidence);
      }
      const result = await state.client.query({ text: wire.sql, values, rowMode: "array", queryMode: "extended", types: { getTypeParser: () => (value) => value } });
      if (sleeping) state.evidence.queryFinishedAt = Date.now();
      if (result.command === "BEGIN") state.transaction = true;
      if (result.command === "ROLLBACK" || result.command === "COMMIT") state.transaction = false;
      const response = { columns: result.fields.map((field) => ({ name: field.name, oid: field.dataTypeID })), rows: result.rows, count: result.rowCount, command: result.command };
      const bytes = new TextEncoder().encode(JSON.stringify(response)).length;
      metrics.maxResultBytes = Math.max(metrics.maxResultBytes, bytes);
      // Intentionally post-buffer for the spike; does not guarantee peak memory.
      if (bytes > 1024 * 1024 || result.rows.length > 1000) throw new Error("prototype result limit exceeded");
      return response;
    });
    state.pending = pending.catch(() => undefined);
    return pending;
  }

  return {
    name: "hyperdrive-prototype",
    register(perl) {
      if (registered.has(perl)) return;
      perl.registerFunction(HOST, async (value) => {
        let response;
        try { response = { ok: true, result: await dispatch(JSON.parse(value.toString())) }; }
        catch (error) { response = { ok: false, error: { message: error.message, code: error.code ?? null } }; }
        return perl.createString(JSON.stringify(response));
      });
      registered.add(perl);
    },
    attachScope({ scope, bindings, request }) {
      if (!bindings.DB?.connectionString) throw new Error("missing prototype Hyperdrive DB binding");
      const capability = crypto.randomUUID();
      const supplied = new URL(request.url).searchParams.get("token");
      const token = /^[a-f0-9-]{36}$/.test(supplied ?? "") ? supplied : crypto.randomUUID();
      const evidence = {token, attachedAt: Date.now(), requestAborted: false, rolledBack: false};
      requestEvidence.set(request, evidence);
      const state = { binding: bindings.DB, pending: Promise.resolve(), transaction: false, released: false, evidence, record: bindings.PROTOTYPE_RECORD_EVIDENCE === "1" };
      capabilities.set(capability, state);
      scope.extensions[EXTENSION] = { capability, previous: previousCapability, runToken: token };
      previousCapability = capability;
      metrics.attached += 1;
      const onAbort = () => { metrics.requestAborted += 1; evidence.requestAborted = true; evidence.abortedAt = Date.now(); };
      request.signal.addEventListener("abort", onAbort, {once: true});
      return {
        release({ signal }) {
          if (state.released) return state.cleanup;
          state.released = true;
          evidence.releaseStartedAt = Date.now();
          capabilities.delete(capability);
          delete scope.extensions[EXTENSION];
          metrics.released += 1;
          const force = () => {
            if (state.client) {
              metrics.forced += 1;
              evidence.forcedAt = Date.now();
              state.client.connection.stream.destroy(new Error("prototype cleanup deadline"));
            }
          };
          signal.addEventListener("abort", force, { once: true });
          state.cleanup = (async () => {
            try {
              await state.pending;
              if (state.client && !state.broken && state.transaction) {
                await state.client.query("ROLLBACK");
                metrics.rolledBack += 1;
                evidence.rolledBack = true;
                evidence.rolledBackAt = Date.now();
              }
            } finally {
              try { if (state.client) await state.client.end(); }
              finally {
                signal.removeEventListener("abort", force);
                request.signal.removeEventListener("abort", onAbort);
              }
            }
          })();
          return state.cleanup;
        },
      };
    },
  };
}
