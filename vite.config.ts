import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const githubPagesBase = "/FSS/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? githubPagesBase : "/",
  plugins: [react()],
}));
