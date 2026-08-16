import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Configuration ESLint « plate » (flat config), volontairement PRAGMATIQUE :
 * on cible les vrais bugs (le typecheck strict couvre déjà beaucoup), pas le
 * style. Les conventions stylistiques sont en `warn` (n'échouent pas la CI) pour
 * établir une base sans bloquer le développement en cours. À durcir au fil de l'eau.
 */

/** Un NOM de marque, cherché en DESCENDANT (le cast se forge tout autant sous un tableau/`readonly`). */
const MARQUES = '/^(Built(CascadeStep|RollRow)|PlayerText)$/';
const MSG_FORGE = 'Marque d’origine (#1262/#1318) : forger un `Built*`/`PlayerText` par cast rend la marque décorative. Passer par un constructeur de la porte (rollSeam), par `revealToStep`, ou par un minteur de texte (`t`, `refLabel`, `composeRollLabel`).';

/** VERROU DES MARQUES — les trois ROUTES DE FORGE (cast `as`, cast `<T>`, alias qui déguiserait le nom).
 *  Défini ICI parce que DEUX blocs le déclarent : en flat config, le dernier bloc qui pose une règle
 *  REMPLACE ses options — un bloc qui l'omettrait désarmerait le verrou au lieu de s'y ajouter. */
const VERROU_MARQUES = [{
  selector: `TSAsExpression TSTypeReference > Identifier[name=${MARQUES}]`,
  message: MSG_FORGE,
}, {
  selector: `TSTypeAssertion TSTypeReference > Identifier[name=${MARQUES}]`,
  message: MSG_FORGE,
}, {
  selector: [
    `TSTypeAliasDeclaration > TSTypeReference > Identifier[name=${MARQUES}]`,
    `TSTypeAliasDeclaration > TSArrayType > TSTypeReference > Identifier[name=${MARQUES}]`,
    `TSTypeAliasDeclaration > TSTypeOperator > TSArrayType > TSTypeReference > Identifier[name=${MARQUES}]`,
    `TSTypeAliasDeclaration > TSUnionType > TSTypeReference > Identifier[name=${MARQUES}]`,
    `TSTypeAliasDeclaration > TSUnionType > TSArrayType > TSTypeReference > Identifier[name=${MARQUES}]`,
    `TSTypeAliasDeclaration > TSUnionType > TSTypeOperator > TSArrayType > TSTypeReference > Identifier[name=${MARQUES}]`,
  ].join(', '),
  message: 'Marque d’origine (#1262/#1318) : aliaser un `Built*`/`PlayerText` rouvre la route de forge par cast (le verrou filtre par NOM). Nommer la marque au site, ou passer par un minteur.',
}];

/** VERROU DES CONTENEURS (#1318 V8a₀ T1/T2) — les deux voies qui recomposent l'ÉTAPE entière et
 *  blanchissent son `label` au passage. Portée plus étroite que les marques (cf. le bloc qui l'emploie). */
const VERROU_CONTENEUR = [{
  selector: "CallExpression[callee.object.name='Object'][callee.property.name='assign'] > ObjectExpression > Property[key.name='label']",
  message: 'Contournement de conteneur (#1318 T1) : `Object.assign` ne vérifie pas le type de la cible — un `label` y rentre en `string` et blanchit la marque. Déclarer le libellé à la porte (spec), ou passer par un minteur.',
}, {
  selector: [
    'TSAsExpression TSTypeReference > Identifier[name=/^CascadeStep$/]',
    'TSTypeAssertion TSTypeReference > Identifier[name=/^CascadeStep$/]',
  ].join(', '),
  message: 'Contournement de conteneur (#1318 T2) : caster en `CascadeStep` fait entrer un littéral entier, `label` compris. Passer par une porte du seam (`monoStep`/`tableStep`/`choiceStep`/`quantityStep`/`displayStep`/`bandStep`/`hostStep`).',
}];
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
    // une est le cast. L'exemption est AUX MINTEURS (`rollSeam`, `revealStep`, `rollRowBuild` : forger la
    // marque EST leur corps de métier, une fois, dans leur corps). `saves.ts` — seul FORGEUR licite, la
    // réhydratation POSTULE une marque que le JSON a effacée — l'a AU SITE et non au fichier (#1262 V4) :
    // chacun de ses casts porte sa `eslint-disable-next-line` et sa raison, tout autre y échoue.
    // Partout ailleurs le cast rendrait la marque décorative.
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
    //
    // TROISIÈME MARQUE, mêmes routes, même verrou (#1318 V8a₀) : `PlayerText` (`src/i18n/playerText.ts`),
    // le texte destiné à l'œil du joueur. Ses MINTEURS sont exemptés au FICHIER (`i18n/index.ts` pour
    // `t()`, `state/rollSeam.ts` pour `composeRollLabel` — déjà dans la liste), et le FOSSILE
    // `i18n/rawText.ts` est SOUS la règle avec son exemption AU SITE (patron `saves.ts`) : un second cast
    // y échouerait. `data/index.ts` (minteur des libellés de donnée) est hors du périmètre ESLint du
    // dépôt (`ignores` de tête `src/data/**`) — dit au JSDoc de `playerText.ts`, jamais un oubli.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/state/rollSeam.ts', 'src/state/revealStep.ts', 'src/ui/rollRowBuild.ts', 'src/i18n/index.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...VERROU_MARQUES],
    },
  },
  {
    // LES DEUX CONTOURNEMENTS DE CONTENEUR (#1318 V8a₀) — marquer `label` au type ferme la déclaration
    // DIRECTE, pas les deux voies qui recomposent l'étape ENTIÈRE et blanchissent le champ au passage :
    //  T1. `Object.assign(step, { label: '…' })` — la signature `assign<T,U>(t: T, s: U): T & U` ne
    //      vérifie RIEN contre `T` : le champ marqué se réécrit en `string` sans un mot de `tsc`.
    //  T2. `x as CascadeStep` — le cast de CONTENEUR : tout littéral y entre, `label` compris. Les casts
    //      internes des 7 portes du seam visent `BuiltCascadeStep` et restent exemptés AU FICHIER
    //      (`rollSeam`/`revealStep`) : ils ne blanchissent plus rien depuis que la marque est exigée EN
    //      AMONT, au paramètre de leur SPEC — c'est la déclaration qui est murée, pas la sortie.
    // Le sélecteur T1 est SYNTAXIQUE (un lint ne type pas la cible) : il vise `Object.assign` dont un
    // argument littéral porte un `label`. Le seul site RÉEL du dépôt (`interludeFlow.ts`, un
    // `Partial<PendingActivityFields>` — pas une étape) porte son exemption AU SITE avec sa raison.
    // Les fichiers de TEST sont hors du sélecteur T2 : leurs 38 `as CascadeStep` sont GELÉS nominativement
    // et décroissants (`state/player-text-ratchet.test.ts`, cible 0, éteints par V8a₁) — un gel mesuré
    // vaut mieux qu'une exemption muette, et le code de PRODUCTION, lui, n'en a plus AUCUN (mesuré).
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/state/rollSeam.ts', 'src/state/revealStep.ts', 'src/ui/rollRowBuild.ts', 'src/i18n/index.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      // Les marques sont REDITES ici : en flat config, le DERNIER bloc qui déclare une règle REMPLACE
      // ses options — les omettre désarmerait le verrou #1262/#1318 sur tout le code de production
      // (mesuré : les `eslint-disable` de `saves.ts` devenaient INUTILISÉS, symptôme du désarmement).
      'no-restricted-syntax': ['error', ...VERROU_MARQUES, ...VERROU_CONTENEUR],
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
