const isProd = process.env.NODE_ENV === "production";

// Tauri serves the frontend from `devUrl` in dev and from `frontendDist` (a
// file:// bundle) in production, so the app must be a fully static export —
// no SSR, no server actions, no route handlers that read the request.
// `TAURI_DEV_HOST` is set when running `tauri dev --host`, where the webview
// loads over the LAN instead of localhost and needs absolute asset URLs.
const internalHost = process.env.TAURI_DEV_HOST || "localhost";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,
  turbopack: {
    // Pinned explicitly: an unrelated lockfile sits above this repo in the
    // filesystem, and Turbopack's root inference would otherwise walk up to it.
    root: import.meta.dirname,
  },
};

export default nextConfig;
