import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const rootDirectory = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(rootDirectory, '.'),
    },
  },
  test: {
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    fileParallelism: false,
    hookTimeout: 30_000,
  },
})
