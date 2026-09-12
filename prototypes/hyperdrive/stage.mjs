import { cp, mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [runtimePath, targetPath] = process.argv.slice(2);
if (!runtimePath || !targetPath) throw new Error("Usage: node stage.mjs RUNTIME_TARBALL NEW_DIRECTORY");
const source = dirname(fileURLToPath(import.meta.url));
const target = resolve(targetPath);
const runtime = await realpath(runtimePath);
await mkdir(target);
await cp(resolve(source, "app"), resolve(target, "app"), {recursive: true});
await mkdir(resolve(target, "extension"));
for (const name of ["package.json", "webdyne-extension.json", "host.js", "evidence.js", "lib"]) {
  await cp(resolve(source, name), resolve(target, "extension", name), {recursive: true});
}
await cp(resolve(source, "worker.js"), resolve(target, "worker.js"));
await writeFile(resolve(target, "package.json"), JSON.stringify({
  name: "webdyne-hyperdrive-phase1", private: true, type: "module",
  scripts: {build: "webdyne-cloudflare build"},
  dependencies: {
    "@webdyne/webdyne-zeroperl-5.44.0": pathToFileURL(runtime).href,
    "@webdyne/hyperdrive-prototype": "file:./extension",
    pg: "8.16.3",
  },
  webdyne: {
    entry: "app.pagi",
    extensions: {"@webdyne/hyperdrive-prototype": {}},
    cloudflare: {name: "webdyne-hyperdrive-phase1", wranglerConfig: "wrangler.jsonc"},
  },
}, null, 2));
await writeFile(resolve(target, "wrangler.jsonc"), JSON.stringify({
  name: "webdyne-hyperdrive-phase1", main: "worker.js",
  compatibility_date: "2026-09-12", compatibility_flags: ["enable_request_signal", "nodejs_compat"],
  vars: {WEBDYNE_ROOT: "/app", WEBDYNE_INDEX: "app.pagi", WEBDYNE_STATIC: "0"},
  rules: [
    {type: "Text", globs: ["**/*.pl", "**/*.pm"], fallthrough: true},
    {type: "Data", globs: ["**/*.tar.gz"], fallthrough: true},
    {type: "CompiledWasm", globs: ["**/*.wasm"], fallthrough: true},
  ],
  hyperdrive: [{binding: "DB", id: "df3fabff9d60423bb31e3a98cb28b032"}],
}, null, 2));
console.log(`Staged prototype in ${target}`);
