import { defineConfig } from "vite";

export default defineConfig({
  // Bind IPv4 explicitly — some browsers/OBS resolve localhost to 127.0.0.1 only.
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
