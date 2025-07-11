import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['references/**', 'node_modules/**', 'test/worker.test.ts'],
    environment: 'node',
  },
});