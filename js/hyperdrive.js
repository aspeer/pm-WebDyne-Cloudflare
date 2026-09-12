import { createWebDyneCloudflareExtension } from "./cloudflare.js";
import { createPgClient } from "./hyperdrive-pg.js";

// Select this entry point only in Workers with nodejs_compat enabled.
export function createWebDyneHyperdriveExtension(options = {}) {
  return createWebDyneCloudflareExtension({ ...options,
    hyperdriveClientFactory: options.hyperdriveClientFactory ?? createPgClient });
}
export { HyperdriveHostBridge, HYPERDRIVE_DEFAULT_LIMITS } from "./hyperdrive-host.js";
