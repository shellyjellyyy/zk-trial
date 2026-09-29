/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Allow importing compiled .js files that are TypeScript-authored
    // (managed/ artifacts and node_modules ESM packages).
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };

    // Midnight's @midnight-ntwrk/ledger-v8 is a wasm-bindgen crate whose
    // browser build imports `./midnight_ledger_wasm_bg.wasm`. The ESM
    // `asyncWebAssembly` experiment makes webpack treat it as an async
    // WebAssembly module and emits the .wasm as a static asset.
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
    };

    if (!isServer) {
      // isomorphic-ws v5's browser build only has a default export, but
      // midnight-js imports the named `WebSocket`. Alias it to our shim on
      // the client; the server keeps the real package (Node global WebSocket
      // exists in Node 22+, and SSR never opens indexer subscriptions).
      config.resolve.alias = {
        ...config.resolve.alias,
        "isomorphic-ws": path.resolve(__dirname, "src/shims/isomorphic-ws-client.js"),
      };
      // Some Midnight packages ship optional Node-only requires; keep the
      // browser bundle clean of them.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
