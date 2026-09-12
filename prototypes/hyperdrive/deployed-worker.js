import generated from "./.webdyne/worker.js";
import {authenticated} from "./auth.js";
import {requestEvidence, writeEvidence, withClient, EVIDENCE_SLOT} from "@webdyne/hyperdrive-prototype/evidence";

export default {
  async fetch(request, env, ctx) {
    if (!authenticated(request, env)) return new Response("Unauthorized", {status: 401, headers: {"cache-control": "no-store"}});
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return Response.json({ok: true});
    const token = url.searchParams.get("token");
    if (!/^[a-f0-9-]{36}$/.test(token ?? "")) return new Response("Invalid token", {status: 400});
    if (request.method === "GET" && ["/evidence", "/verify"].includes(url.pathname)) {
      return withClient(env.DB, async (client) => {
        const rows = await client.query("SELECT slot,value FROM webdyne_hyperdrive_test.transaction_probe WHERE run_token=$1 ORDER BY slot", [token]);
        const record = rows.rows.find((row) => row.slot === EVIDENCE_SLOT);
        const evidence = record ? JSON.parse(record.value) : null;
        let activity = null;
        if (evidence?.backendPid && !evidence.completedAt) {
          const active = await client.query("SELECT state,wait_event AS wait FROM pg_stat_activity WHERE pid=$1::integer", [evidence.backendPid]);
          activity = active.rows[0] ?? null;
        }
        return Response.json({evidence, activity, remaining: rows.rows.filter((row) => row.slot !== EVIDENCE_SLOT).length}, {headers: {"cache-control": "no-store"}});
      });
    }
    if (request.method === "POST" && url.pathname === "/cleanup") {
      return withClient(env.DB, async (client) => {
        const result = await client.query("DELETE FROM webdyne_hyperdrive_test.transaction_probe WHERE run_token=$1", [token]);
        return Response.json({deleted: result.rowCount});
      });
    }
    if (request.method !== "GET" || !["/abort", "/core", "/fail"].includes(url.pathname)) return new Response("Not found", {status: 404});

    // Observe the original request and completion; do not buffer its response.
    const response = generated.fetch(request, env, {
      waitUntil(completion) {
        const recorded = completion.then(
          () => "fulfilled", () => "rejected",
        ).then(async (status) => {
          const evidence = requestEvidence.get(request);
          if (!evidence) throw new Error("missing request evidence");
          evidence.completion = status;
          evidence.completedAt = Date.now();
          await writeEvidence(env.DB, evidence);
        });
        ctx.waitUntil(recorded);
      },
    });
    return response;
  },
};
