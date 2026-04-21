import path from "path"
import { fileURLToPath } from "url"
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const aiProxyPort = env.AI_PROXY_PORT || "8787"
  const apiProxy = {
    "/api": {
      target: `http://127.0.0.1:${aiProxyPort}`,
      changeOrigin: true,
    },
  }

  // Vite blocks unknown Host headers (403). ngrok uses *.ngrok-free.app etc.
  const ngrokAllowedHosts = [".ngrok-free.app", ".ngrok.io", ".ngrok.app", ".ngrok.dev"]

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: true,
      allowedHosts: ngrokAllowedHosts,
      proxy: apiProxy,
    },
    preview: {
      host: true,
      allowedHosts: ngrokAllowedHosts,
      proxy: apiProxy,
    },
  }
})
