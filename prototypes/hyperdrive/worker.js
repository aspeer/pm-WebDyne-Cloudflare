import generated from "./.webdyne/worker.js";
import { metrics } from "@webdyne/hyperdrive-prototype/cloudflare";
import pg from "pg";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/stats') return Response.json(metrics);
    if (url.pathname === '/abort') return generated.fetch(request, env, ctx);
    if (url.pathname === '/verify') {
      const token = url.searchParams.get('token');
      if (!/^[a-f0-9-]{36}$/.test(token ?? '')) return new Response('Invalid token', {status: 400});
      const client = new pg.Client({connectionString: env.DB.connectionString, connectionTimeoutMillis: 5000, query_timeout: 8000});
      try {
        await client.connect();
        const result = await client.query('SELECT count(*) AS remaining FROM webdyne_hyperdrive_test.transaction_probe WHERE run_token=$1', [token]);
        return Response.json(result.rows[0]);
      } finally { await client.end(); }
    }
    // This wrapper makes lifecycle completion inspectable by the smoke runner.
    // It is a test endpoint, not a deployable application API.
    const completions = [];
    const response = await generated.fetch(request, env, {
      waitUntil(promise) { completions.push(promise); ctx.waitUntil(promise); },
    });
    const body = await response.arrayBuffer();
    const results = await Promise.allSettled(completions);
    const headers = new Headers(response.headers);
    headers.set("x-prototype-metrics", JSON.stringify(metrics));
    headers.set("x-prototype-completion", results.every((result) => result.status === "fulfilled") ? "ok" : "failed");
    return new Response(body, {status: response.status, headers});
  },
};
