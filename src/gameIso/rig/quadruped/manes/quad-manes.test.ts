/**
 * CONTRAT des defs de CRINIÈRE quadrupèdes (#1082 P2-ter) — même contrat que les têtes et les
 * queues : art d'encolure non vide, couverture des espèces, axes DÉCLARÉS mesurés à l'exécution
 * (tous les témoins × produit des valeurs déclarées), repli VISIBLE d'une clé sans def, et canal
 * déclaré = canal PEINT (aucun site du socle qui ne consulte plus sa def).
 */
import { describe, it, expect, vi } from 'vitest';
import { QUAD_MANES, quadManeDef } from './index';
import { quadArt } from '../partArt';
import { quadParts } from '../quadParts';
import { consumedAxes } from '../axis-fuzz.fixture';
import type { QuadManeDef } from './types';
import type { QuadArt } from '../partArt';
import { QUAD_SPECIES, WINGED_SPECIES } from '../../creatures';
import { MISSING_TONE } from '../../viewArt';
import type { QuadProps } from '../quadSkeleton';
import type { View } from '../../facing';

const SPECIES: Record<string, QuadProps> = { ...QUAD_SPECIES, ...WINGED_SPECIES };
const arts = (d: QuadManeDef): (QuadArt | undefined)[] => [d.art.neck, d.art.chestRuff, d.art.backTuft];
/** Espèces qui portent cette crinière. */
const witnesses = (key: string): QuadProps[] => {
  const w = Object.values(SPECIES).filter((p) => p.mane === key);
  if (!w.length) throw new Error(`aucune espèce ne porte la crinière « ${key} » — témoin introuvable`);
  return w;
};
/** Vue où le socle consulte chaque canal, et carrure qui le porte. */
const CANAUX: [keyof QuadManeDef['art'], View, QuadProps['build']][] = [
  ['neck', 'profile', 'equine'], ['chestRuff', 'front', 'canine'], ['backTuft', 'back', 'canine'],
];
const builtSvg = (p: QuadProps, view: View): string =>
  Object.values(quadParts(p, view, 'folded')).flat().map((l) => l.svg).join('');

describe('defs de crinière quadrupèdes : contrat d\'art, d\'axes et de repli', () => {
  it('chaque clé de crinière portée par une espèce a sa def enregistrée', () => {
    for (const [id, p] of Object.entries(SPECIES))
      expect(QUAD_MANES[p.mane], `espèce ${id} : crinière « ${p.mane} » sans def`).toBeDefined();
  });

  it('l\'art d\'encolure est non vide pour TOUTE crinière — `sans` compris (ligne de dos déclarée)', () => {
    for (const d of Object.values(QUAD_MANES))
      expect(quadArt(d.art.neck, witnesses(d.key)[0]), d.key).not.toBe('');
    expect(Object.keys(QUAD_MANES).sort()).toEqual(['crin', 'hirsute', 'sans']);
  });

  it('axes DÉCLARÉS = axes CONSOMMÉS (TOUS les témoins × produit des valeurs déclarées)', () => {
    for (const d of Object.values(QUAD_MANES)) {
      const declared = [...new Set<string>(d.params ?? [])].sort();
      const { used, missingDomain } = consumedAxes(arts(d), witnesses(d.key), declared);
      expect(missingDomain, `${d.key} : axe déclaré sans domaine de fuzz (AXIS_FUZZ)`).toEqual([]);
      expect(used, `${d.key} : axes consommés non déclarés`).toEqual(declared);
    }
  });

  it('canal DÉCLARÉ = canal PEINT : chaque canal d\'une def est consulté par le socle', () => {
    // Les trois canaux vivent sur des vues et des carrures distinctes ; on éprouve chacun sur une
    // espèce porteuse RÉELLE dont la carrure passe par le site (le poitrail et la croupe hirsutes
    // sont les variantes canidée/féline).
    const base = witnesses('hirsute')[0];
    for (const [canal, vue, build] of CANAUX)
      for (const d of Object.values(QUAD_MANES)) {
        const a = d.art[canal];
        if (a == null) continue;
        const p: QuadProps = { ...base, build, mane: d.key as QuadProps['mane'] };
        expect(builtSvg(p, vue), `${d.key}.${canal} : canal déclaré, jamais peint (vue ${vue}, build ${build})`)
          .toContain(quadArt(a, p));
      }
  });

  it('une clé SANS def rend la silhouette de REPLI VISIBLE + un avertissement', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = quadManeDef('espece-de-criniere-inconnue-xyz');
    expect(quadArt(d.art.neck, witnesses('sans')[0])).toContain(MISSING_TONE);
    if (import.meta.env?.DEV) expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
