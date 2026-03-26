import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.PORT || "8787";
  const apiTarget = `http://localhost:${apiPort}`;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          timeout: 600000,
          proxyTimeout: 600000
        },
        "/health": {
          target: apiTarget,
          changeOrigin: true,
          timeout: 60000,
          proxyTimeout: 60000
        }
      }
    }
  };
});
