import { defineConfig } from 'vitest/config';

export default defineConfig({
  ssr: { external: [/^node:/] },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 20000,
    pool: 'forks',
    server: { deps: { external: [/^node:/] } },
  },
});
