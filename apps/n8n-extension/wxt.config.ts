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
    ],
    host_permissions: ["https://magic.yourbrandmate.agency/*"],
    optional_host_permissions: ["https://magic.yourbrandmate.agency/*"],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"), // or "./src" if using src directory
      },
    },
  }),
  webExt: {
    disabled: true,
  },
});
