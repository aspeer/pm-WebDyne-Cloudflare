#!/usr/bin/env node

import assert from "node:assert/strict";

const root = new URL(process.argv[2] ?? "http://127.0.0.1:8790/");

async function request(path, expectedStatus = 200) {
  const response = await fetch(new URL(path, root));
  const body = await response.text();
  assert.equal(response.status, expectedStatus, `${path} returned ${response.status}: ${body.slice(0, 500)}`);
  return { response, body };
}

const initial = await request("/");
assert.match(initial.body, /Milestone 2/);
assert.match(initial.body, /Payload bytes<\/dt><dd>3/);

const insertedName = "D1 bridge O'Brien π";
const insertUrl = new URL("/", root);
insertUrl.searchParams.set("action", "insert");
insertUrl.searchParams.set("name", insertedName);
const inserted = await request(insertUrl);
assert.match(inserted.body, /D1 bridge O'Brien π/);
assert.match(inserted.body, /\(NULL\)/);
assert.match(inserted.body, /Payload bytes<\/dt><dd>9/);

const api = await request("/d1-api/row/1");
assert.match(api.response.headers.get("content-type") ?? "", /application\/json/);
assert.deepEqual(JSON.parse(api.body), {
  found: true,
  id: 1,
  name: "Milestone 2",
  note: "WebDyne::Cloudflare::D1 fixture",
  payload_length: 3,
});

const failed = await request("/?action=fail", 500);
assert.match(failed.body, /D1_ERROR/);
assert.match(failed.body, /deliberately_missing_table/);

const recovered = await request("/");
assert.match(recovered.body, /Milestone 2/);

const concurrent = await Promise.all(Array.from({ length: 24 }, () => request("/")));
for (const result of concurrent) assert.match(result.body, /Milestone 2/);

console.log(`WebDyne D1 smoke OK (HTML, JSON, insert, recovery, ${concurrent.length} concurrent reads)`);
