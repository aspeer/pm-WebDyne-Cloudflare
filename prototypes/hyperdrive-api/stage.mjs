import { cp, mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";

const [runtimePath, extensionPath, targetPath] = process.argv.slice(2);
if (!targetPath) throw new Error("Usage: node stage.mjs RUNTIME_TARBALL EXTENSION_TARBALL NEW_DIRECTORY");
const source = dirname(fileURLToPath(import.meta.url));
const target = resolve(targetPath);
const repo = resolve(source, "../..");
await mkdir(target);
await cp(resolve(source, "app"), resolve(target, "app"), { recursive: true });
await cp(resolve(source, "worker.js"), resolve(target, "worker.js"));
await cp(resolve(source, "../hyperdrive/auth.js"), resolve(target, "auth.js"));
await mkdir(resolve(target, "fixture"));
await cp(resolve(repo, "lib"), resolve(target, "fixture/lib"), { recursive: true });
await writeFile(resolve(target, "fixture/package.json"), JSON.stringify({ name: "@webdyne/hyperdrive-api-fixture", version: "0.0.0", type: "module",
  exports: { "./cloudflare": "./cloudflare.js", "./webdyne-extension.json": "./webdyne-extension.json" } }));
await writeFile(resolve(target, "fixture/cloudflare.js"), 'export { createWebDyneHyperdriveExtension } from "@webdyne/webdyne-cloudflare/hyperdrive";\n');
await writeFile(resolve(target, "fixture/webdyne-extension.json"), JSON.stringify({ schemaVersion: 1, perlLibrary: "lib",
  providers: { cloudflare: { module: "./cloudflare", factory: "createWebDyneHyperdriveExtension" } } }));
await writeFile(resolve(target, "package.json"), JSON.stringify({ name: "webdyne-hyperdrive-api-fixture", private: true, type: "module",
  scripts: { build: "webdyne-cloudflare build" }, dependencies: {
    "@webdyne/webdyne-zeroperl-5.44.0": pathToFileURL(await realpath(runtimePath)).href,
    "@webdyne/webdyne-cloudflare": pathToFileURL(await realpath(extensionPath)).href,
    "@webdyne/hyperdrive-api-fixture": "file:./fixture", pg: "8.16.3" },
  webdyne: { entry: "app.pagi", extensions: { "@webdyne/hyperdrive-api-fixture": { hyperdriveBindings: ["DB"] } },
    cloudflare: { name: "webdyne-hyperdrive-api", wranglerConfig: "wrangler.jsonc" } } }, null, 2));
const name = `webdyne-hyperdrive-api-${randomBytes(4).toString("hex")}`;
await writeFile(resolve(target, "wrangler.jsonc"), JSON.stringify({ name, main: "worker.js", workers_dev: true, preview_urls: false,
  compatibility_date: "2026-09-12", compatibility_flags: ["enable_request_signal", "nodejs_compat"],
  vars: { WEBDYNE_ROOT: "/app", WEBDYNE_INDEX: "app.pagi", WEBDYNE_STATIC: "0", PROTOTYPE_EXPIRES: String(Date.now() + 3600000) },
  rules: [{ type: "Text", globs: ["**/*.pl", "**/*.pm"], fallthrough: true },
    { type: "Data", globs: ["**/*.tar.gz"], fallthrough: true }, { type: "CompiledWasm", globs: ["**/*.wasm"], fallthrough: true }],
  hyperdrive: [{ binding: "DB", id: "df3fabff9d60423bb31e3a98cb28b032" }] }, null, 2));
await writeFile(resolve(target, ".deployment-secrets.json"), JSON.stringify({ PROTOTYPE_TOKEN: randomBytes(32).toString("hex") }), { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ target, name }));
