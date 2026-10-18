// ESLint flat config for the whole repo (app, functions, scripts, e2e). Owner: E1.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '.wrangler/**',
      'playwright-report/**',
      'test-results/**',
      'e2e/tmp/**',
      // Not app code: research, docs, design hand-off and tool state.
      'docs/**',
      'research/**',
      'solution/**',
      'submission/**',
      'engineering/handoff/**',
      'assets/**',
      '.agents/**',
      '.claude/**',
      '.firecrawl/**',
      '.impeccable/**',
      '.playwright-mcp/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['app/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // The engine and contracts stay pure: no React, no DOM, no storage.
    files: ['app/src/engine/**/*.ts', 'app/src/contracts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'idb', '../screens/*', '../ui/*'] },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}', 'app/*.config.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['functions/**/*.ts'],
    languageOptions: { globals: globals.serviceworker },
  },
);
