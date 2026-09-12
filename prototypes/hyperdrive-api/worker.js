import generated from "./.webdyne/worker.js";
import { authenticated } from "./auth.js";
import pg from "pg";

async function database(env, callback) {
  const client = new pg.Client({ connectionString: env.DB.connectionString, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  client.on("error", () => {});
  try { await client.connect(); return await callback(client); }
  finally { await client.end(); }
}

export default {
  async fetch(request, env, ctx) {
    if (!authenticated(request, env)) return new Response("Unauthorized", { status: 401 });
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!/^[a-f0-9-]{36}$/.test(token ?? "")) return new Response("Invalid token", { status: 400 });
    if (url.pathname === "/cleanup" && request.method === "POST") {
      return database(env, async client => {
        const result = await client.query("DELETE FROM webdyne_hyperdrive_test.transaction_probe WHERE run_token=$1", [token]);
        return Response.json({ deleted: result.rowCount });
      });
    }
    if (url.pathname === "/verify" && request.method === "GET") {
      return database(env, async client => Response.json((await client.query(
        "SELECT slot,value FROM webdyne_hyperdrive_test.transaction_probe WHERE run_token=$1 ORDER BY slot", [token])).rows));
    }
    if (url.pathname !== "/run" || request.method !== "GET") return new Response("Not found", { status: 404 });
    const completions = [];
    const response = await generated.fetch(request, env, { waitUntil(promise) { completions.push(promise); ctx.waitUntil(promise); } });
    const body = await response.text();
    try { await Promise.all(completions); }
    catch { return Response.json({ error: "PAGI execution or cleanup failed", status: response.status, body }, { status: 500 }); }
    return new Response(body, { status: response.status, headers: response.headers });
  },
};
