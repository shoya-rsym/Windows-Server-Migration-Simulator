import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    __SIMULATOR_URLS__: JSON.stringify({
      infrastructure: "http://127.0.0.1:5174",
      development: "http://127.0.0.1:5175",
    }),
  },
});
