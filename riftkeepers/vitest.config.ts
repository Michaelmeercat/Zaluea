import { defineConfig } from 'vitest/config';

// `npm test` runs the fast unit tests; `npm run balance` (BALANCE=1) also runs the slow *.sim.test.ts playtests.
export default defineConfig({
  test: {
    include: process.env.BALANCE ? ['tests/**/*.test.ts', 'scratch/**/*.test.ts'] : ['tests/**/*.test.ts'],
    exclude: process.env.BALANCE ? [] : ['**/*.sim.test.ts'],
  },
});
