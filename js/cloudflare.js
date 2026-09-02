import { D1HostBridge, d1BindingNames } from "./d1-host.js";

/**
 * Create the Cloudflare side of the WebDyne extension lifecycle.
 *
 * Binding names are fixed by application configuration when supplied. The
 * WEBDYNE_D1_BINDINGS variable remains as a compatibility path for custom
 * Workers that instantiate this extension directly.
 */
export function createWebDyneCloudflareExtension(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("WebDyne Cloudflare extension options must be an object");
  }
  const configuredBindings = options.d1Bindings === undefined
    ? undefined
    : d1BindingNames(options.d1Bindings);
  const d1 = new D1HostBridge();

  return {
    name: "@webdyne/webdyne-cloudflare",

    register(perl) {
      d1.register(perl);
    },

    attachScope({ scope, bindings }) {
      const bindingNames = configuredBindings
        ?? d1BindingNames(bindings?.WEBDYNE_D1_BINDINGS);
      return d1.attachScope(scope, bindings, bindingNames);
    },
  };
}

export {
  D1HostBridge,
  D1_EXTENSION_NAME,
  D1_HOST_FUNCTION_NAME,
  d1BindingNames,
} from "./d1-host.js";
