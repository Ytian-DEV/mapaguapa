import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Third-party code changes far less often than the app, so it gets its own
// long-cached chunks; a deploy then only re-downloads the app chunk.
var VENDOR_CHUNKS = [
    ["react", /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@remix-run)[\\/]/],
    ["supabase", /[\\/]node_modules[\\/]@supabase[\\/]/],
];
export default defineConfig({
    plugins: [react()],
    server: {
        host: "0.0.0.0",
        port: 5173,
    },
    preview: {
        host: "0.0.0.0",
        port: 4173,
    },
    build: {
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
