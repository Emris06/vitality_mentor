// Minimal flat config — each workspace can extend or replace this.
// Kept intentionally light at the root so `pnpm lint` succeeds before
// per-package configs land in later parts.
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.vite/**',
      '**/coverage/**',
      'services/ai/**',
      'infra/**',
      'docs/**',
    ],
  },
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];
