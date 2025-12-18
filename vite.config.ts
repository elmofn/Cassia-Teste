import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    build: {
      outDir: 'build', // Configura a saída para a pasta 'build' que o Vercel está procurando
    },
    define: {
      // Garante que process.env.API_KEY funcione no código do cliente
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})