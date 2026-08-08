import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// `BASE_PATH` lets GitHub Pages serve the app from /<repo>/ without code changes.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
