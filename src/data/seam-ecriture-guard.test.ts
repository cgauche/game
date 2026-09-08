/**
 * GARDE STRUCTURELLE (#1692) — le seam d'ÉCRITURE des datasets est UNIQUE.
 *
 * `setDataset`/`setObjectDataset`/`resetData` (`src/data/overrides.ts`) sont les seules portes qui
 * mutent un dataset : elles remplacent son contenu EN PLACE **et** versionnent l'écriture
 * (`bumperDataset`, `src/data/versionDataset.ts`). Un `push`/`splice` posé directement sur le binding
 * exporté change bien la donnée, mais AUCUN index mémoïsé ne l'apprend — le monde de la donnée et
 * celui des lecteurs divergent en silence (c'était le cas de deux tests, dont un qui se disait
 * « exactement ce que fait l'éditeur du Codex » alors que l'atelier passe par `setDataset`).
 *
 * Périmètre : tout `src/**` en `.ts(x)`, TESTS COMPRIS (c'est là que vivaient les écritures sauvages).
 * Vocabulaire IMPORTÉ du seam (`bindingsVifs`, dérivé du littéral `ARRAYS` d'`overrides.ts`), et un
 * nom n'est retenu que s'il est IMPORTÉ par le fichier (ou exporté par le module propriétaire) : un
 * `props` local d'une scène n'est pas le dataset `props`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bindingsVifs, ecrituresHorsSeam, fichiersSources, RACINE } from '../../scripts/guards/lib/bindingsVifs.mjs';

/** Le seam LUI-MÊME : c'est son métier de muter en place. */
const SEAM = 'src/data/overrides.ts';

describe('#1692 — aucune écriture de dataset hors du seam `overrides.ts`', () => {
  const parBinding = bindingsVifs();

  it('aucun `push`/`splice`/`sort`… ni écriture PAR INDEX sur un binding de dataset, tests compris', () => {
    const fautifs = fichiersSources()
      .filter((f) => f !== SEAM)
      .flatMap((f) => ecrituresHorsSeam(f, readFileSync(join(RACINE, f), 'utf8'), parBinding));
    expect(fautifs, 'passer par `setDataset(clé, …)` : elle seule versionne l’écriture (les index mémoïsés ne verraient rien)').toEqual([]);
  });

  it('CONTRÔLE POSITIF : le même détecteur voit un `push` injecté dans une COPIE en mémoire', () => {
    const sauvage = `import { lightTones } from '../data';\nlightTones.push(ton);\n`;
    expect(ecrituresHorsSeam('copie.ts', sauvage, parBinding)).toHaveLength(1);
    const parLeSeam = `import { lightTones } from '../data';\nsetDataset('lightTones', [...lightTones, ton]);\n`;
    expect(ecrituresHorsSeam('copie.ts', parLeSeam, parBinding)).toEqual([]);
    const homonymeLocal = `const props = [];\nprops.push(1);\n`;
    expect(ecrituresHorsSeam('copie.ts', homonymeLocal, parBinding)).toEqual([]);
    const renomme = `import { props as propsData } from '../data';\npropsData.splice(0, 1);\n`;
    expect(ecrituresHorsSeam('copie.ts', renomme, parBinding)).toHaveLength(1);
  });

  it('CONTRÔLE POSITIF : l’ÉCRITURE PAR INDEX est vue elle aussi (elle ne passe par aucune méthode)', () => {
    const parIndex = `import { traits } from '../data';\ntraits[0] = neuf;\n`;
    expect(ecrituresHorsSeam('copie.ts', parIndex, parBinding)).toHaveLength(1);
    const parIndexProfond = `import { traits } from '../data';\ntraits[i].label = 'X';\n`;
    expect(ecrituresHorsSeam('copie.ts', parIndexProfond, parBinding)).toHaveLength(1);
    const lectureParIndex = `import { traits } from '../data';\nconst t = traits[0].label === 'X';\n`;
    expect(ecrituresHorsSeam('copie.ts', lectureParIndex, parBinding)).toEqual([]);
    const comparaison = `import { traits } from '../data';\nif (traits[0] === neuf) f();\n`;
    expect(ecrituresHorsSeam('copie.ts', comparaison, parBinding)).toEqual([]);
  });
});
