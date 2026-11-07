import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { notionFlashcardPlugin } from "./vite.notion.ts";

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version: string;
};

export default defineConfig(({ mode }) => ({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), notionFlashcardPlugin(mode)],
  server: {
    host: true,
  },
}));
