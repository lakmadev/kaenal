/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Linting is done once at the repo root (eslint .), so Next's own per-build
  // eslint pass is redundant and would need a second, duplicate config.
  eslint: { ignoreDuringBuilds: true },
  // @kaenal/types is published as TypeScript source (main → src/index.ts), so
  // Next must compile it rather than expecting pre-built JS.
  transpilePackages: ["@kaenal/types", "@kaenal/core"],
  webpack: (config) => {
    // The shared packages import with explicit `.js` specifiers (ESM/tsc
    // style). tsc's bundler resolution maps those to the `.ts` source, but
    // webpack does not unless told to — without this, every `export * from
    // "./http.js"` in @kaenal/types fails to resolve.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
