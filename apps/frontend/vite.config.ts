import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0", // Allow connections from any IP
    strictPort: true, // Fail if port is already in use
    hmr: true, // Enable HMR for better development experience
    cors: true, // Enable CORS for WebSocket connections
  },
});
