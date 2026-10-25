import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Adjust the target port to match the backend's actual dev port.
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
