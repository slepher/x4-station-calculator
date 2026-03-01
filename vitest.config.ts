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
    include: ['tests/unit/**/*.spec.ts', 'tests/skills/unit/**/*.spec.ts'],
    globals: true,
    environment: 'node',
  }
});
