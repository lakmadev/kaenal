/**
 * PM2 process definitions for running Kaenal always-on on a dev machine and
 * reaching it from other devices on the LAN.
 *
 *   pm2 start ecosystem.config.cjs   # start all three
 *   pm2 save && pm2 startup          # survive reboots (run the printed command)
 *   pm2 logs / pm2 status / pm2 restart all
 *
 * Prereqs (once): `corepack enable` and Docker Desktop running with
 * postgres/redis/minio up (`docker compose up -d`). The web process binds to
 * 0.0.0.0 so it is reachable at http://<this-mac-LAN-IP>:3000 — only :3000 needs
 * to be reachable; it proxies /api/* to the API on localhost:3001.
 *
 * These run the DEV servers (HMR). For a leaner, more stable always-on setup,
 * see the "production build" note in the chat answer.
 */
const cwd = __dirname;

module.exports = {
  apps: [
    {
      name: "kaenal-api",
      cwd,
      script: "pnpm",
      args: "--filter @kaenal/api dev",
      autorestart: true,
      max_restarts: 20,
    },
    {
      name: "kaenal-worker",
      cwd,
      script: "pnpm",
      args: "--filter @kaenal/api worker",
      autorestart: true,
      max_restarts: 20,
    },
    {
      name: "kaenal-web",
      cwd,
      // -H 0.0.0.0 makes Next listen on the LAN interface, not just localhost.
      script: "pnpm",
      args: "--filter @kaenal/web exec next dev --port 3000 -H 0.0.0.0",
      autorestart: true,
      max_restarts: 20,
    },
  ],
};
