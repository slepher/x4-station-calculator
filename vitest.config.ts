/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    include: ['tests/unified-unit/**/*.spec.ts', 'tests/skills/unit/**/*.spec.ts', 'tests/e2e-skills/unit/**/*.spec.ts'],
    exclude: ['tests/unit/**'],
    setupFiles: ['./tests/test-setup.ts'],
    globals: true,
    environment: 'node',
  }
});
