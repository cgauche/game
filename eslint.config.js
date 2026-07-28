import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Configuration ESLint « plate » (flat config), volontairement PRAGMATIQUE :
 * on cible les vrais bugs (le typecheck strict couvre déjà beaucoup), pas le
 * style. Les conventions stylistiques sont en `warn` (n'échouent pas la CI) pour
 * établir une base sans bloquer le développement en cours. À durcir au fil de l'eau.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**', '_site/**', 'src/data/**', '**/*.json', '*.config.*', '.claude/**', 'server/.wrangler/**', '.playwright-mcp/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-undef': 'off', // TypeScript gère déjà les identifiants non définis
      '@typescript-eslint/no-explicit-any': 'off', // `any` assumé dans le store/bus
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-condition': ['warn', { checkLoops: false }],
      'prefer-const': 'warn',
      'no-case-declarations': 'off',
    },
  },
);
