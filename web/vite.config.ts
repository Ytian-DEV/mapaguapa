import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Third-party code changes far less often than the app, so it gets its own
// long-cached chunks; a deploy then only re-downloads the app chunk.
const VENDOR_CHUNKS: Array<[string, RegExp]> = [
  ["react", /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@remix-run)[\\/]/],
  ["supabase", /[\\/]node_modules[\\/]@supabase[\\/]/],
];

// Fonts the first screen paints with (latin subsets of the heading and UI faces).
const PRELOAD_FONTS = /^assets\/(fraunces-latin-full-normal|geist-latin-wght-normal)-[\w-]+\.woff2$/;

/** Adds <link rel="preload"> for PRELOAD_FONTS so text doesn't wait on the stylesheet to discover them. */
function preloadFonts(): Plugin {
  return {
    name: "mapaguapa:preload-fonts",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const files = Object.keys(ctx.bundle ?? {}).filter((file) => PRELOAD_FONTS.test(file));
        return {
          html,
          tags: files.map((file) => ({
            tag: "link",
            attrs: { rel: "preload", as: "font", type: "font/woff2", href: `/${file}`, crossorigin: "" },
            injectTo: "head" as const,
          })),
        };
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), preloadFonts()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  build: {
    // Never inline fonts: small subsets (Vietnamese, Cyrillic…) would otherwise be
    // base64'd into the render-blocking stylesheet even though most pages never use them.
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    rollupOptions: {
      output: {
        manualChunks(id) {
          return VENDOR_CHUNKS.find(([, pattern]) => pattern.test(id))?.[0];
        },
      },
    },
  },
});
