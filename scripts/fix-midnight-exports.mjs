#!/usr/bin/env node
/**
 * Normalizes the `exports` maps of installed @midnight-ntwrk packages so a
 * clean `npm ci` (locally, in CI, or on Vercel) reproduces the exact module
 * resolution the Next.js webpack build was verified against.
 *
 * Why this exists:
 *  - `@midnight-ntwrk/onchain-runtime-v3` ships a main-entry-only exports map
 *    (`{ types, browser, node }`) with no `./package.json` subpath, and its
 *    browser wasm bundle is only reachable through the `browser` condition.
 *    Next/webpack resolves it as:
 *        { '.': { types, node, default }, './package.json': './package.json' }
 *    so that Node/server builds hit `node`, browser bundles hit `default`
 *    (the browser wasm shim), and `./package.json` stays importable.
 *  - `default` must be the LAST key in any exports condition object or
 *    webpack fails the build with "Default condition should be last one".
 *
 * The script is idempotent: running it against an already-normalized tree
 * changes nothing. It runs automatically via the `postinstall` script.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NODE_MODULES = path.join(ROOT, 'node_modules');

if (!existsSync(NODE_MODULES)) {
  // e.g. `npm ci --ignore-scripts` or a docs-only checkout: nothing to fix.
  process.exit(0);
}

/**
 * Moves the `default` condition to the end of any exports condition object
 * (recursively). Stable: all other keys keep their relative order.
 */
function sortDefaultLast(node) {
  if (Array.isArray(node)) {
    node.forEach(sortDefaultLast);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const value of Object.values(node)) sortDefaultLast(value);
  const keys = Object.keys(node);
  if ('default' in node && keys[keys.length - 1] !== 'default') {
    const { default: fallback, ...rest } = node;
    for (const key of Object.keys(rest)) delete node[key];
    Object.assign(node, rest, { default: fallback });
  }
}

/**
 * Rewrites one copy of @midnight-ntwrk/onchain-runtime-v3's exports map into
 * the verified subpath form. Reads targets from whatever shape is installed
 * (registry main-only form or an already-normalized subpath form), so the
 * same code works before and after normalization.
 */
function fixOnchainRuntimeExports(exportsField) {
  const source =
    exportsField['.'] && typeof exportsField['.'] === 'object'
      ? exportsField['.']
      : exportsField;
  return {
    '.': {
      types: source.types ?? './onchain-runtime-v3.d.ts',
      node: source.node ?? './midnight_onchain_runtime_wasm_fs.js',
      default:
        source.default ??
        source.browser ??
        './midnight_onchain_runtime_wasm.js',
    },
    './package.json': './package.json',
  };
}

/**
 * Walks node_modules visiting every @midnight-ntwrk package.json, including
 * nested copies (a package's own node_modules), without descending into
 * package internals like dist/ or effect/.
 */
function walk(dir, visit) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const isContainer =
    dir === NODE_MODULES ||
    path.basename(dir) === 'node_modules' ||
    path.basename(dir).startsWith('@');
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = path.join(dir, entry.name);
    if (isContainer) {
      const pkgJsonPath = path.join(child, 'package.json');
      if (existsSync(pkgJsonPath)) visit(pkgJsonPath);
      walk(child, visit);
    } else if (entry.name === 'node_modules' || entry.name.startsWith('@')) {
      // A package's own node_modules may hold nested duplicate versions.
      walk(child, visit);
    }
  }
}

let fixed = 0;

walk(NODE_MODULES, (pkgJsonPath) => {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  } catch {
    return;
  }
  if (typeof pkg.name !== 'string' || !pkg.name.startsWith('@midnight-ntwrk/')) {
    return;
  }
  if (!pkg.exports || typeof pkg.exports !== 'object') return;

  const before = JSON.stringify(pkg.exports);
  if (pkg.name === '@midnight-ntwrk/onchain-runtime-v3') {
    pkg.exports = fixOnchainRuntimeExports(pkg.exports);
  }
  sortDefaultLast(pkg.exports);

  if (JSON.stringify(pkg.exports) !== before) {
    writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
    fixed += 1;
    console.log(
      `fix-midnight-exports: normalized ${pkg.name} (${path.relative(ROOT, pkgJsonPath)})`,
    );
  }
});

if (fixed === 0) {
  console.log('fix-midnight-exports: exports maps already normalized');
}
