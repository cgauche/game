import { describe, it, expect, afterEach } from 'vitest';
import { props, refEstVolumique, type PropData } from './index';
import { setDataset } from './overrides';
import { idDe } from './schemas/grammaire/ref';
import { poserSourceDIdsVivants, type SourceDIdsVivants } from './schemas/grammaire/idsVivants';
import { sceneEntitySchema } from './schemas/defs-scenes/scene';

/**
 * RÉGIME VIF DES IDS (#1897) — tout dataset-tableau du seam (`ARRAYS`, `data/overrides.ts`) est lu en
 * MÉMOIRE par `ref.ts`, qu'il ait une route d'édition au Codex ou non (`props.json` est `edit: none` :
 * il s'édite à la palette de l'éditeur de carte). Chaque cas LIT d'abord (le mémo de `idsVivants.ts`
 * se remplit), ÉCRIT au seam, puis relit : un mémo qui ignorerait la version servirait l'ancien monde.
 */

const DECORS_LIVRES: PropData[] = [...props];
afterEach(() => setDataset('props', DECORS_LIVRES));

const entite = (ref: string, facing?: string) => ({ id: 'p-1', kind: 'prop', ref, pos: { x: 1, y: 1 }, ...(facing ? { facing } : {}) });

describe('régime vif — `props.json` sans route d’édition', () => {
  it('un décor posé par `setDataset` est accepté par `idDe(\'prop\')` et par le schéma d’entité', () => {
    const base = props.find((p) => p.id === 'tonneau')!;
    const noeud = idDe('prop');
    expect(noeud.safeParse('decor-neuf').success).toBe(false);
    setDataset('props', [...DECORS_LIVRES, { ...base, id: 'decor-neuf', label: 'Décor neuf' }]);
    expect(noeud.safeParse('decor-neuf').success).toBe(true);
    expect(sceneEntitySchema.safeParse(entite('decor-neuf')).success).toBe(true);
  });

  it('un `volume` posé par `setDataset` sur un décor plat rend son cap diagonal refusé', () => {
    const plat = props.find((p) => !p.volume && !p.foot)!;
    const volumique = props.find((p) => p.volume)!;
    expect(refEstVolumique(plat.id)).toBe(false);
    expect(sceneEntitySchema.safeParse(entite(plat.id, 'NE')).success).toBe(true);
    setDataset('props', DECORS_LIVRES.map((p) => (p.id === plat.id ? { ...p, volume: volumique.volume } : p)));
    expect(refEstVolumique(plat.id)).toBe(true);
    const verdict = sceneEntitySchema.safeParse(entite(plat.id, 'NE'));
    expect(verdict.success).toBe(false);
    expect(verdict.error?.issues.map((i) => i.message).join('\n')).toMatch(/cap cardinal/);
  });
});

describe('mémo des ids vivants — daté par la source', () => {
  it('poser une autre source vide le mémo, même à version égale', () => {
    const noeud = idDe('etat');
    expect(noeud.safeParse('etat-synthetique').success).toBe(false);
    const vraie: SourceDIdsVivants = poserSourceDIdsVivants(undefined)!;
    poserSourceDIdsVivants({
      entrees: (f) => (f === 'etats.json' ? [...vraie.entrees(f)!, { id: 'etat-synthetique' }] : vraie.entrees(f)),
      version: vraie.version,
      discriminantDe: vraie.discriminantDe,
    });
    try {
      expect(noeud.safeParse('etat-synthetique').success).toBe(true);
    } finally {
      poserSourceDIdsVivants(vraie);
    }
    expect(noeud.safeParse('etat-synthetique').success).toBe(false);
  });
});
