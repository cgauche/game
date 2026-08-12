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
    // c'est même la route RÉALISTE vers `openSequence.steps`. TROISIÈME forme, sans quoi les deux
    // premières ne valent rien : l'ALIAS (`type A = BuiltRollRow; x as A`) — les deux sélecteurs
    // ci-dessus filtrent par NOM, donc une ligne d'alias suffisait à sortir du radar (mesuré : tsc ET
    // eslint verts avant fermeture).
    //
    // L'alias se refuse à sa DÉCLARATION, mais SEULEMENT quand le type ALIASÉ EST la marque (nu, en
    // tableau, `readonly`, ou en union). La forme descendante « toute référence sous un alias » a été
    // MESURÉE et REJETÉE : elle fauche 4 sites LÉGITIMES (`state/nightBands.ts` l.104/115/116,
    // `state/cascade.ts` l.57) — des types de CALLBACK qui EXIGENT des étapes mintées en entrée/sortie,
    // c'est-à-dire le murage lui-même. Employer la marque dans une signature n'est pas la déguiser.
    // Restent donc hors portée (dit au JSDoc de `state/stepBrand.ts`) : l'alias GÉNÉRIQUE ou calculé
    // (`type A<T> = …`, type conditionnel, accès indexé) et le renommage à l'import.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/state/rollSeam.ts', 'src/state/revealStep.ts', 'src/state/saves.ts', 'src/ui/rollRowBuild.ts'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'TSAsExpression TSTypeReference > Identifier[name=/^Built(CascadeStep|RollRow)$/]',
        message: 'Marque d’origine (#1262) : forger un `Built*` par cast rend la marque décorative. Passer par un constructeur de la porte (rollSeam) ou par `revealToStep`.',
      }, {
        selector: 'TSTypeAssertion TSTypeReference > Identifier[name=/^Built(CascadeStep|RollRow)$/]',
        message: 'Marque d’origine (#1262) : forger un `Built*` par cast rend la marque décorative. Passer par un constructeur de la porte (rollSeam) ou par `revealToStep`.',
      }, {
        selector: [
          'TSTypeAliasDeclaration > TSTypeReference > Identifier[name=/^Built(CascadeStep|RollRow)$/]',
          'TSTypeAliasDeclaration > TSArrayType > TSTypeReference > Identifier[name=/^Built(CascadeStep|RollRow)$/]',
          'TSTypeAliasDeclaration > TSTypeOperator > TSArrayType > TSTypeReference > Identifier[name=/^Built(CascadeStep|RollRow)$/]',
          'TSTypeAliasDeclaration > TSUnionType > TSTypeReference > Identifier[name=/^Built(CascadeStep|RollRow)$/]',
          'TSTypeAliasDeclaration > TSUnionType > TSArrayType > TSTypeReference > Identifier[name=/^Built(CascadeStep|RollRow)$/]',
          'TSTypeAliasDeclaration > TSUnionType > TSTypeOperator > TSArrayType > TSTypeReference > Identifier[name=/^Built(CascadeStep|RollRow)$/]',
        ].join(', '),
        message: 'Marque d’origine (#1262) : aliaser un `Built*` rouvre la route de forge par cast (le verrou filtre par NOM). Nommer la marque au site, ou passer par un constructeur de la porte.',
      }],
    },
  },
  {
    // POLICE DE LA POSSESSION À L'AFFICHAGE (#1262 L1) : une fenêtre demande « ce siège pilote-t-il ce
    // combattant ? » par la porte UI `src/ui/ownership.ts`, jamais en important le prédicat d'état.
    // Ce n'est PAS un verrou : `ownsLocally` est exporté par `netOwnership` (6 consommateurs internes)
    // et ré-exporté par `netFlow` — l'import reste écrivable, la CI le refuse. Le nom seul est
    // restreint : les autres exports de ces modules (types `NetState`, `initialNet`…) passent.
    files: ['src/ui/**/*.ts', 'src/ui/**/*.tsx'],
    ignores: ['src/ui/ownership.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/state/netOwnership', '**/state/netFlow'],
          importNames: ['ownsLocally'],
          message: 'Possession à l’affichage (#1262) : passer par `ui/ownership.ts` (`ownsLocal`/`useOwns`) — le terme `net.mode === "local"` y est déjà mort.',
        }],
      }],
    },
  },
  {
    // POLICE DU CANAL D'ISSUE (#1262 V3 Lj) : la ligne d'ISSUE d'un jet se DÉCLARE au flux
    // (`RollFlowSpec.issue`, rendue par le verbe `apply`) — un flux de `src/state` n'importe plus un
    // `describeX` pour composer sa propre ligne (c'est le doublon modale ↔ journal que le lot ferme).
    // Ce n'est PAS un verrou : `flowOutcomes` reste exporté (les fenêtres de `src/ui` l'affichent) —
    // l'import reste écrivable, la CI le refuse. Règle AST : insensible aux guillemets, à l'alias et
    // à la forme d'import (namespace, `export … from`). Ce qu'elle N'attrape PAS est dit au JSDoc du
    // volet « canal » de `cascade-consequence-guard.test.ts`, qui la mesure sur la config réelle.
    files: ['src/state/**/*.ts', 'src/state/**/*.tsx'],
    ignores: [
      'src/state/flowOutcomes.ts', // la source elle-même
      'src/state/rollFlowSpecs.ts', // GOULOT : déclaration `spec.issue` des flux à fenêtre
      'src/state/encounterPsychFlow.ts', // GOULOT : conséquence d'étape (freeCons → commitStep)
      'src/state/**/*.test.ts', 'src/state/**/*.test.tsx', // les tests mesurent les describeX eux-mêmes
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/flowOutcomes'],
          message: 'Canal d’issue (#1262 V3 Lj) : déclarer `issue` au flux (`RollFlowSpec.issue`) et acquitter par `flow.apply(get, …)` — un site ne rédige plus sa ligne d’issue.',
        }],
      }],
    },
  },
);
