import react from "@astrojs/react";
import stylex from "@stylexjs/unplugin";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://bill.buildcord.dev",
  integrations: [react()],
  // StyleX compiles at build time, so its plugin runs ahead of React's.
  vite: { plugins: [stylex.vite()] },
});
