import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";
import path from "path";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    permissions: [
      "sidePanel",
      "tabs",
      "scripting",
      "activeTab",
      "clipboardWrite",
      "clipboardRead",
      // Dynamic permissions for n8n instances will be requested at runtime
    ],
    optional_host_permissions: ["https://*/*", "http://*/*"],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"), // or "./src" if using src directory
      },
    },
    // Preserve streaming functionality in production
    build: {
      sourcemap: false,
      minify: "esbuild",
      rollupOptions: {
        output: {
          // Preserve function names for streaming
          preserveModules: false,
        },
      },
    },
    // Disable HMR and other dev features
    server: {
      hmr: false,
    },
    // Preserve streaming-related code
    define: {
      __DEV__: false,
      // Ensure streaming works in production
      "process.env.NODE_ENV": '"production"',
    },
    // Optimize for streaming performance
    optimizeDeps: {
      include: ["streamdown", "@ai-sdk/react"],
    },
  }),
  webExt: {
    disabled: true,
  },
});
