/**
 * Next.js config (04 §1). Two deliberate choices:
 *
 *  1. `transpilePackages` — the shared workspace packages ship raw TypeScript
 *     (`main` points at `src/index.ts`), so Next must transpile them itself
 *     rather than expect pre-built `dist/`.
 *  2. A dev **rewrite proxy**: the browser talks to the API through this origin
 *     (`/api/*` → the API), so the httpOnly session cookie and CSRF double-submit
 *     stay same-origin — no CORS, no `SameSite` surprises in local dev. In
 *     production the platform terminates both under one hostname the same way.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@kaenal/api-client", "@kaenal/types", "@kaenal/core"],
  /**
   * The shared packages are TypeScript-ESM: they import with explicit `.js`
   * specifiers (`export * from "./client.js"`). Map those back to the real
   * `.ts` sources so webpack resolves them without a build step. Turbopack does
   * this natively; this covers the webpack production build.
   */
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3001";
    return [{ source: "/api/:path*", destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;
