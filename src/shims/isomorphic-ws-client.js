// Browser shim for `isomorphic-ws` v5.
//
// @midnight-ntwrk/midnight-js-indexer-public-data-provider imports
// `import * as ws from "isomorphic-ws"` and uses `ws.WebSocket`. The
// isomorphic-ws browser build only provides a *default* export, which breaks
// webpack's named-export check during `next build`. This shim provides the
// named export from the browser's global WebSocket.
//
// Wired up in next.config.js via a client-only resolve.alias.
const WS = typeof WebSocket !== "undefined" ? WebSocket : undefined;

export { WS as WebSocket };
export default WS;
