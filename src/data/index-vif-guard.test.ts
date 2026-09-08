/**
 * GARDE STRUCTURELLE (#1692) — aucune VALEUR FIGÉE à l'import sur un dataset MUTABLE.
 *
 * `src/data/overrides.ts` remplace le CONTENU des datasets sans réassigner leur binding : toute
 * valeur dérivée du CONTENU et calculée au NIVEAU MODULE sert donc l'ancien monde jusqu'au
 * rechargement de la page — l'entrée éditée au Codex reste invisible, l'entrée neuve n'existe pas.
 * Deux staleness étaient prouvées en exécution (`fraicheur-datasets.test.ts`).
 *
 * Sont équivalents devant ce défaut, et tous couverts ici : l'INDEX (`new Map(traits.map(…))`,
 * `Object.fromEntries`, `.reduce` en Record), l'index rempli PAR UNE BOUCLE de niveau module, la VUE
 * dérivée (`const armes = trappings.filter(…)`, `species[0]`, `[...creatures]`), l'accès par
 * ESPACE DE NOMS (`import * as D` → `D.traits.map`) et l'accès par la CLÉ (`datasetArray('traits').map`).
 * Le nom déclaré par une déclaration fautive rejoint le vocabulaire : l'index bâti ENSUITE sur cette
 * vue est nommé lui aussi.
 *
 * S'y ajoutent les formes qui n'ont ni `const` ni méthode pour se trahir : le DÉCLARATEUR SŒUR d'une
 * flèche (`const f = () => 1, PAR_ID = new Map(traits.map(…))`), l'IIFE de module
 * (`const M = (() => …)()`), la DÉSTRUCTURATION (`const [premier] = traits`), l'`export default`,
 * l'AFFECTATION NUE (`let M; M = new Map(…)`), et l'ACCESSEUR VIF RE-FIGÉ — appeler au niveau module
 * un accesseur issu de `memoParVersion`/`indexParId`/`indexParChamp` (`const ENGINS = siegeEngines()`)
 * re-fige exactement ce que cet accesseur venait de dévier.
 *
 * Périmètre : tout `src/**` en `.ts(x)` NON-test. Vocabulaire IMPORTÉ du seam (`bindingsVifs`, dérivé
 * du littéral `ARRAYS` d'`overrides.ts`) et des accesseurs DÉCLARÉS sous `src/` (`accesseursVifs`) —
 * jamais une liste recopiée ici. Le SEAM exclu du balayage est DÉRIVÉ lui aussi (`fichiersDuSeam` :
 * le module NON-test qui DÉFINIT `bumperDataset`, et celui qui l'IMPORTE pour versionner ses
 * écritures) — ce sont les deux porteurs de la mécanique.
 * Est INNOCENTE toute déclaration qui passe par les primitives d'index
 * VIF (`indexParId`/`indexParChamp`/`memoParVersion`, `src/data/versionDataset.ts`) et toute lecture
 * située DANS un corps de fonction (flèche, `function`, accesseur `get x()`, méthode abrégée) qui
 * n'est pas appelé sur place — elle se refait à chaque appel.
 *
 * CE QUE CETTE GARDE NE VOIT PAS, mesuré par injection (chaque cas rend 0 ligne aujourd'hui) :
 *  - CHAMP STATIQUE DE CLASSE — `export class R { static PAR_ID = new Map(traits.map((t) => [t.id, t])); }`
 *    (le corps de classe est à profondeur > 0 : aucune déclaration de niveau module n'y est vue) ;
 *  - FABRIQUE INTER-MODULE — `const PAR_ID = construire();` où `construire()` (autre fichier) lit le
 *    dataset : le détecteur ne suit aucun appel hors du fichier ;
 *  - RÉ-EXPORT RENOMMÉ — `export { traits as tousLesTraits }` dans un module tiers, puis
 *    `new Map(tousLesTraits.map(…))` chez son importateur : le vocabulaire ne suit que le seam.
 *
 * ASYMÉTRIE DE PÉRIMÈTRE, dite : la garde d'ÉCRITURE (`seam-ecriture-guard.test.ts`) balaie AUSSI les
 * `.test.ts` (une écriture hors seam dans un test contamine les autres tests du même processus) ;
 * celle-ci s'arrête aux non-tests. Stock résiduel dans les `.test.ts`, MESURÉ à ce lot : 46 valeurs
 * figées à l'import (fixtures d'arbre livré, la plupart légitimes — `const TRAITS_LIVRES = [...traits]` de
 * `fraicheur-datasets.test.ts` EST la sauvegarde qui restaure le seam). Les migrer relève d'un tri
 * cas par cas, pas d'un motif.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bindingsVifs, clesDuSeam, indexFiges, fichiersSources, fichiersDuSeam, accesseursVifs, sansCommentaires, RACINE } from '../../scripts/guards/lib/bindingsVifs.mjs';
import { DATASET_KEYS } from './overrides';

describe('#1692 — aucun index figé à l’import sur un dataset mutable', () => {
  const parBinding = bindingsVifs();

  it('le vocabulaire vient du seam, pas d’une liste recopiée : ses clés SONT `DATASET_KEYS`', () => {
    // Le littéral `ARRAYS` donne ce que `DATASET_KEYS` (la clé) ne donne pas : le NOM du binding que
    // les modules importent — mais les deux décrivent le MÊME ensemble, et c'est vérifié ici.
    expect(clesDuSeam().sort()).toEqual([...DATASET_KEYS].sort());
    expect(parBinding.get('traits')).toBe('traits');
    expect(parBinding.get('allAxes')).toBe('axes');
    expect(parBinding.get('MOUNT_PROFILES')).toBe('montures');
  });

  it('le SEAM se DÉRIVE de ce que les fichiers déclarent, pas d’une liste de chemins', () => {
    // Ce qu'il PORTE le désigne : définir `bumperDataset`, ou l'importer pour versionner ses écritures.
    expect([...fichiersDuSeam()].sort()).toEqual(['src/data/overrides.ts', 'src/data/versionDataset.ts']);
  });

  it('aucun index NI aucune vue dérivée de niveau module sur un dataset du seam', () => {
    const seam = fichiersDuSeam();
    const fautifs = fichiersSources()
      .filter((f) => !/\.test\.tsx?$/.test(f) && !seam.has(f))
      .flatMap((f) => indexFiges(f, readFileSync(join(RACINE, f), 'utf8'), parBinding));
    expect(fautifs, 'ces index servent l’ancien monde après une édition au Codex — passer par `indexParId`/`indexParChamp` (src/data/versionDataset.ts)').toEqual([]);
  });

  it('CONTRÔLE POSITIF : un `/*` cité dans un commentaire de LIGNE n’efface pas la source qui suit', () => {
    // Le commentaire de ligne gagne : sans cela, tout le code jusqu'au prochain `*/` disparaît du
    // vocabulaire — et le seam, dérivé de ce que les fichiers déclarent, cesse d'être vu.
    const src = '// a /* b\nconst x = 1; /* c */ const y = 2;';
    const net = sansCommentaires(src);
    expect(net).toContain('const x = 1;');
    expect(net).toContain('const y = 2;');
    expect(net).not.toContain('/* c */');
    expect(net).not.toContain(' b');
  });

  it('CONTRÔLE POSITIF : le même détecteur voit un index figé injecté dans une COPIE en mémoire', () => {
    const fige = `import { traits } from '../data';\nconst PAR_ID = new Map(traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', fige, parBinding)).toHaveLength(1);
    const vif = `import { traits } from '../data';\nconst parId = indexParId('traits', traits);\n`;
    expect(indexFiges('copie.ts', vif, parBinding)).toEqual([]);
    const dansUneFonction = `import { traits } from '../data';\nexport const f = () => new Map(traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', dansUneFonction, parBinding)).toEqual([]);
    const homonymeNonImporte = `const traits = [];\nconst PAR_ID = new Map(traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', homonymeNonImporte, parBinding)).toEqual([]);
  });

  it('CONTRÔLE POSITIF : chaque MOTIF élargi est vu — vue dérivée, reduce en Record, boucle, espace de noms, clé', () => {
    const vueDerivee = `import { trappings } from '../data';\nconst armes = trappings.filter((t) => t.categorie === 'melee');\n`;
    expect(indexFiges('copie.ts', vueDerivee, parBinding)).toHaveLength(1);
    // Une vue figée CONTAMINE : l'index bâti dessus est nommé lui aussi (2 lignes rendues).
    const vuePuisIndex = `${vueDerivee}const PAR_ID = new Map(armes.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', vuePuisIndex, parBinding)).toHaveLength(2);
    const reduceEnRecord = `import { traits } from '../data';\nconst PAR_ID = traits.reduce((m, t) => ({ ...m, [t.id]: t }), {});\n`;
    expect(indexFiges('copie.ts', reduceEnRecord, parBinding)).toHaveLength(1);
    const parBoucle = `import { traits } from '../data';\nconst PAR_ID = new Map();\nfor (const t of traits) PAR_ID.set(t.id, t);\n`;
    expect(indexFiges('copie.ts', parBoucle, parBinding)).toHaveLength(1);
    const parIndexation = `import { species } from '../data';\nconst PREMIERE = species[0];\n`;
    expect(indexFiges('copie.ts', parIndexation, parBinding)).toHaveLength(1);
    const parEtalement = `import { creatures } from '../data';\nconst TOUTES = [...creatures];\n`;
    expect(indexFiges('copie.ts', parEtalement, parBinding)).toHaveLength(1);
    const parEspaceDeNoms = `import * as D from '../data';\nconst PAR_ID = new Map(D.traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', parEspaceDeNoms, parBinding)).toHaveLength(1);
    const parLaCle = `import { datasetArray } from '../data/overrides';\nconst IDS = new Set(datasetArray('traits').map((t) => t.id));\n`;
    expect(indexFiges('copie.ts', parLaCle, parBinding)).toHaveLength(1);
  });

  it('CONTRÔLE POSITIF : les formes SANS méthode ni `const` porteur — sœur, IIFE, déstructuration, `export default`, affectation nue', () => {
    const soeurDUneFleche = `import { traits } from '../data';\nconst f = () => 1, PAR_ID = new Map(traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', soeurDUneFleche, parBinding)).toHaveLength(1);
    const iife = `import { traits } from '../data';\nconst PAR_ID = (() => new Map(traits.map((t) => [t.id, t])))();\n`;
    expect(indexFiges('copie.ts', iife, parBinding)).toHaveLength(1);
    const iifeFunction = `import { traits } from '../data';\nconst V = (function () { return traits.filter((t) => t.id); })();\n`;
    expect(indexFiges('copie.ts', iifeFunction, parBinding)).toHaveLength(1);
    const destructuration = `import { traits } from '../data';\nconst [PREMIER] = traits;\n`;
    expect(indexFiges('copie.ts', destructuration, parBinding)).toHaveLength(1);
    const destructurationObjet = `import { creatures } from '../data';\nconst { length } = creatures;\n`;
    expect(indexFiges('copie.ts', destructurationObjet, parBinding)).toHaveLength(1);
    const exportDefault = `import { traits } from '../data';\nexport default new Map(traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', exportDefault, parBinding)).toHaveLength(1);
    const affectationNue = `import { traits } from '../data';\nlet M;\nM = new Map(traits.map((t) => [t.id, t]));\n`;
    expect(indexFiges('copie.ts', affectationNue, parBinding)).toHaveLength(1);
  });

  it('CONTRÔLE POSITIF : l’ACCESSEUR VIF appelé au niveau module est re-figé — la classe née de #1692', () => {
    // `siegeEngines`/`oupsTable` sont des accesseurs RÉELS du dépôt (`memoParVersion`) : le
    // vocabulaire les connaît parce qu'il les LIT sous `src/`, pas parce qu'ils sont nommés ici.
    expect([...accesseursVifs()]).toContain('siegeEngines');
    const vueRefigee = `import { siegeEngines } from '../data';\nconst ENGINS = siegeEngines().filter((t) => t.siegeRig);\n`;
    expect(indexFiges('copie.ts', vueRefigee, parBinding)).toHaveLength(1);
    const indexRefige = `import { oupsTable } from '../data/oups';\nconst PAR_ID = new Map(oupsTable().map((o) => [o.id, o]));\n`;
    expect(indexFiges('copie.ts', indexRefige, parBinding)).toHaveLength(1);
    const captureNue = `import { siegeEngines } from '../data';\nconst ENGINS = siegeEngines();\n`;
    expect(indexFiges('copie.ts', captureNue, parBinding)).toHaveLength(1);
    const dansUnCorps = `import { siegeEngines } from '../data';\nexport const f = () => siegeEngines().filter((t) => t.siegeRig);\n`;
    expect(indexFiges('copie.ts', dansUnCorps, parBinding)).toEqual([]);
  });

  it('CE QUE LA GARDE NE VOIT PAS est MESURÉ, pas supposé (cf. en-tête)', () => {
    const champStatique = `import { traits } from '../data';\nexport class R { static PAR_ID = new Map(traits.map((t) => [t.id, t])); }\n`;
    const fabriqueInterModule = `import { construire } from './autre';\nconst PAR_ID = construire();\n`;
    const reexportRenomme = `import { tousLesTraits } from './reexport';\nconst PAR_ID = new Map(tousLesTraits.map((t) => [t.id, t]));\n`;
    for (const cas of [champStatique, fabriqueInterModule, reexportRenomme]) {
      expect(indexFiges('copie.ts', cas, parBinding), 'angle mort couvert : l’en-tête de ce fichier ne dit plus vrai').toEqual([]);
    }
  });

  it('CONTRÔLE NÉGATIF : une lecture dans un CORPS (flèche, `function`, accesseur, méthode) est innocente', () => {
    const accesseur = `import { creatures } from '../data';\nexport const s = { get n(): number { return creatures.length; } };\n`;
    expect(indexFiges('copie.ts', accesseur, parBinding)).toEqual([]);
    const methodeAbregee = `import { gods } from '../data';\nexport const S = { pool(): string[] { return gods.map((g) => g.id); } };\n`;
    expect(indexFiges('copie.ts', methodeAbregee, parBinding)).toEqual([]);
    const declaration = `import { gods } from '../data';\nexport function pool(): string[] { return gods.map((g) => g.id); }\n`;
    expect(indexFiges('copie.ts', declaration, parBinding)).toEqual([]);
    const bouclePropre = `import { traits } from '../data';\nexport const f = () => { for (const t of traits) g(t); };\n`;
    expect(indexFiges('copie.ts', bouclePropre, parBinding)).toEqual([]);
  });
});
