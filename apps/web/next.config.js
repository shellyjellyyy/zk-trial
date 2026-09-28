/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  // This is a small monorepo: apps/web imports shared code from the
  // top-level /lib and /trials directories. outputFileTracingRoot silences
  // Next's multi-lockfile warning and makes file tracing correct for
  // deployment bundling.
  experimental: {
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
  webpack: (config) => {
    // Allow importing .json trial configs and .ts files from ../../lib
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

module.exports = nextConfig;
