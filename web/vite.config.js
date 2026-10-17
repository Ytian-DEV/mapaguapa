import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Third-party code changes far less often than the app, so it gets its own
// long-cached chunks; a deploy then only re-downloads the app chunk.
var VENDOR_CHUNKS = [
    ["react", /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@remix-run)[\\/]/],
    ["supabase", /[\\/]node_modules[\\/]@supabase[\\/]/],
];
// Fonts the first screen paints with (latin subsets of the heading and UI faces).
var PRELOAD_FONTS = /^assets\/(fraunces-latin-full-normal|geist-latin-wght-normal)-[\w-]+\.woff2$/;
/** Adds <link rel="preload"> for PRELOAD_FONTS so text doesn't wait on the stylesheet to discover them. */
function preloadFonts() {
    return {
        name: "mapaguapa:preload-fonts",
        apply: "build",
        transformIndexHtml: {
            order: "post",
            handler: function (html, ctx) {
                var _a;
                var files = Object.keys((_a = ctx.bundle) !== null && _a !== void 0 ? _a : {}).filter(function (file) { return PRELOAD_FONTS.test(file); });
                return {
                    html: html,
                    tags: files.map(function (file) { return ({
                        tag: "link",
                        attrs: { rel: "preload", as: "font", type: "font/woff2", href: "/".concat(file), crossorigin: "" },
                        injectTo: "head",
                    }); }),
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
        assetsInlineLimit: function (file) { return (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined); },
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    var _a;
                    return (_a = VENDOR_CHUNKS.find(function (_a) {
                        var pattern = _a[1];
                        return pattern.test(id);
                    })) === null || _a === void 0 ? void 0 : _a[0];
                },
            },
        },
    },
});
