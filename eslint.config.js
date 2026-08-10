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
  {
    // VERROU DES MARQUES D'ORIGINE (#1262) : `BuiltCascadeStep`/`BuiltRollRow` portent une propriété
    // REQUISE inécrivable hors de leur module (symbole non exporté), donc le SEUL moyen d'en forger
    // une est le cast. Les minteurs le font, une fois, dans leur corps ; `saves.ts` réhydrate ce que
    // le JSON a effacé. Partout ailleurs le cast rendrait la marque décorative.
    //
    // DEUX formes de cast (`x as T` et `<T>x`), et la référence est cherchée en DESCENDANT : la marque
    // se forge tout autant sous un tableau (`as BuiltCascadeStep[]`), un `readonly` ou un générique —
    // c'est même la route RÉALISTE vers `openSequence.steps`. Ce que le lint N'attrape PAS est dit au
    // JSDoc de `state/stepBrand.ts` (annotation d'un `any`, spread d'une étape mintée).
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/state/rollSeam.ts', 'src/state/revealStep.ts', 'src/state/saves.ts', 'src/ui/rollRowBuild.ts'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'TSAsExpression TSTypeReference > Identifier[name=/^Built(CascadeStep|RollRow)$/]',
        message: 'Marque d’origine (#1262) : forger un `Built*` par cast rend la marque décorative. Passer par un constructeur de la porte (rollSeam) ou par `revealToStep`.',
      }, {
        selector: 'TSTypeAssertion TSTypeReference > Identifier[name=/^Built(CascadeStep|RollRow)$/]',
        message: 'Marque d’origine (#1262) : forger un `Built*` par cast rend la marque décorative. Passer par un constructeur de la porte (rollSeam) ou par `revealToStep`.',
      }],
    },
  },
);
