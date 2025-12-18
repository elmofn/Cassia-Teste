import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    build: {
      outDir: 'dist', // Padrão do Vite (e do Vercel preset "Vite")
    },
    define: {
      // Garante que process.env.API_KEY funcione no código do cliente
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})