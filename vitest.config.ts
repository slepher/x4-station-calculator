/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

const isSkillSuite = process.env.VITEST_SUITE === 'skills';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    include: [isSkillSuite ? 'tests/e2e-skills/unit/**/*.spec.ts' : 'tests/unit/**/*.spec.ts'],
    exclude: ['tests/legacy/**', isSkillSuite ? 'tests/unit/**' : 'tests/e2e-skills/**'],
    setupFiles: ['./tests/test-setup.ts'],
    globals: true,
    environment: 'node',
  }
});
