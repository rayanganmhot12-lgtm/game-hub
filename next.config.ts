import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Next's standalone file tracer otherwise makes its own separate copy of
  // this native addon (rebuilt against whatever Node.js ABI ran `next
  // build`, not Electron's), which is a different binary than the one
  // `electron-rebuild` correctly retargets in the top-level node_modules —
  // causing a NODE_MODULE_VERSION mismatch at runtime in the packaged app.
  // Marking it external means Next resolves it via a normal require from
  // node_modules instead of tracing/bundling its own copy.
  serverExternalPackages: ["better-sqlite3"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.akamai.steamstatic.com",
      },
      {
        protocol: "https",
        hostname: "avatars.akamai.steamstatic.com",
      },
      {
        protocol: "https",
        hostname: "steamcdn-a.akamaihd.net",
      },
      {
        protocol: "https",
        hostname: "shared.akamai.steamstatic.com",
      },
    ],
  },
};

export default nextConfig;
