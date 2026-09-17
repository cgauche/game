/**
 * L'INDEX VIF — ce qu'il REND, et quand il se refait (#1692).
 *
 * Un index VIF (`indexParId`/`memoParVersion`) est une `Map` qui se reconstruit sur écriture au seam
 * (`overrides.ts`) : deux contrats, tous deux vérifiables sur l'ARTEFACT, sans horloge.
 *  1. il rend EXACTEMENT ce qu'une `Map` figée à l'import rendrait — sans quoi il ne remplace rien ;
 *  2. il se REFAIT à l'écriture — sans quoi ce serait un mémo mort, et le premier contrat ne
 *     prouverait qu'un instantané.
 * Ce que ce contrôle de fraîcheur COÛTE est une durée : elle vit au banc
 * `gameIso/stage/versionDataset.bench.ts` (`npm run bench`), hors de `npm test` et de la CI (#1788).
 * Le banc et sa prémisse vivent sous `gameIso/` parce qu'ils CUISENT des scènes : ce fichier-ci ne
 * prouve que du PUR, et n'importe donc rien hors de `src/data` (pureté de couche, #1709).
 */
import { describe, it, expect } from 'vitest';
import { props } from './index';
import { indexParId } from './versionDataset';
import { setDataset } from './overrides';

const ids = (): string[] => props.map((p) => p.id);

describe('#1692 — l’index vif d’un dataset', () => {
  it('rend la MÊME entrée qu’une Map figée à l’import, et rien pour un id inconnu', () => {
    const cles = ids();
    const vif = indexParId('props', props);
    const FIGE = new Map(props.map((p) => [p.id, p] as const));
    expect(cles.length).toBeGreaterThan(50);
    for (const id of cles) expect(vif(id)).toBe(FIGE.get(id));
    expect(vif('rien-de-tel')).toBeUndefined();
  });

  it('se RECONSTRUIT à l’écriture au seam — un mémo mort servirait l’ancien dataset', () => {
    const vif = indexParId('props', props);
    const livres = [...props];
    const premier = vif(livres[0].id);
    try {
      setDataset('props', [...livres, { ...livres[0], id: '__vif-1692__' }]);
      expect(vif('__vif-1692__')?.id).toBe('__vif-1692__');
      expect(vif(livres[0].id)).toBe(premier);
    } finally {
      setDataset('props', livres);
    }
    expect(vif('__vif-1692__')).toBeUndefined();
  });
});
