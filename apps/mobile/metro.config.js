// Metro config for the Kaenal mobile app inside the pnpm/Turborepo workspace.
// The app imports two workspace packages (@kaenal/api-client, @kaenal/types) that
// live outside apps/mobile, so Metro must (a) watch the repo root and (b) resolve
// modules from both the app's own node_modules and the hoisted root node_modules.
// Hierarchical lookup is intentionally LEFT ON so Metro can still follow pnpm's
// per-package symlinked node_modules when resolving each package's own deps.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// The shared workspace packages (@kaenal/api-client, @kaenal/types) are authored
// in TypeScript but use ESM-style relative specifiers with an explicit `.js`
// extension (e.g. `export * from "./client.js"`) that actually point at `.ts`
// sources — the "Bundler"/NodeNext convention the API and web bundlers honour.
// Metro takes the extension literally and can't find `client.js`, so on a failed
// relative `.js(x)` resolution we retry without the extension and let sourceExts
// (ts/tsx) match. Scoped to the failure path, so real `.js` files are unaffected.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  try {
    return resolve(context, moduleName, platform);
  } catch (error) {
    if (/^\.\.?\//.test(moduleName) && /\.jsx?$/.test(moduleName)) {
      return resolve(context, moduleName.replace(/\.jsx?$/, ""), platform);
    }
    throw error;
  }
};

module.exports = config;
