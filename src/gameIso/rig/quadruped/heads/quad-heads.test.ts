/**
 * CONTRAT des defs de TÊTE quadrupèdes (#1082 P2) : exhaustivité des vues, couverture des espèces,
 * axes DÉCLARÉS mesurés à l'exécution (design v2 §1 : « le socle ÉCHOUE si un axe consommé n'est pas
 * déclaré »), et repli VISIBLE d'une clé sans def (#223).
 */
import { describe, it, expect, vi } from 'vitest';
import { QUAD_HEADS, quadHeadDef, quadHeadBone } from './index';
import { quadArt } from '../partArt';
import type { QuadHeadDef } from './types';
import type { QuadArt } from '../partArt';
import { QUAD_SPECIES, WINGED_SPECIES } from '../../creatures';
import { MISSING_TONE } from '../../viewArt';
import type { QuadProps } from '../quadSkeleton';
import type { View } from '../../facing';

const VIEWS: View[] = ['profile', 'front', 'back'];
const SPECIES: Record<string, QuadProps> = { ...QUAD_SPECIES, ...WINGED_SPECIES };

/** Props d'une espèce qui PORTE cette tête (l'art se juge sur la donnée réelle qui l'appelle). */
const witness = (key: string): QuadProps => {
  const p = Object.values(SPECIES).find((s) => s.head === key);
  if (!p) throw new Error(`aucune espèce ne porte la tête « ${key} » — témoin introuvable`);
  return p;
};

/** Canaux d'art d'une def, nommés (les optionnels sont sautés quand absents). */
const channels = (d: QuadHeadDef): [string, QuadArt][] => [
  ...VIEWS.map((v) => [`art.${v}`, d.art[v]] as [string, QuadArt]),
  ...(['bodyHi', 'ridge', 'chestCrest', 'tailProfile'] as const)
    .filter((k) => d[k] != null)
    .map((k) => [k, d[k] as QuadArt] as [string, QuadArt]),
];

describe('defs de tête quadrupèdes : contrat de vues, d\'axes et de repli', () => {
  it('chaque clé de tête portée par une espèce a sa def enregistrée', () => {
    for (const [id, p] of Object.entries(SPECIES))
      expect(QUAD_HEADS[p.head], `espèce ${id} : tête « ${p.head} » sans def`).toBeDefined();
  });

  it('les TROIS vues sont déclarées et rendent un art non vide', () => {
    for (const d of Object.values(QUAD_HEADS)) {
      const p = witness(d.key);
      for (const v of VIEWS)
        expect(quadArt(d.art[v], p), `${d.key} / ${v}`).not.toBe('');
    }
  });

  it('le binding par vue est un os du gabarit : `tete` par défaut, `encolure` pour les clusters', () => {
    const clusters = Object.values(QUAD_HEADS).filter((d) => quadHeadBone(d, 'profile') === 'encolure');
    expect(clusters.map((d) => d.key).sort()).toEqual(['chimere', 'dechiqueteur', 'hydre']);
    for (const d of Object.values(QUAD_HEADS)) {
      expect(quadHeadBone(d, 'front')).toBe('tete');
      expect(quadHeadBone(d, 'back')).toBe('tete');
    }
  });

  it('axes DÉCLARÉS = axes CONSOMMÉS (mesure à l\'exécution, kit compris)', () => {
    for (const d of Object.values(QUAD_HEADS)) {
      const p = witness(d.key);
      const used = new Set<string>();
      const spy = new Proxy(p, { get: (t, k) => { if (typeof k === 'string') used.add(k); return t[k as keyof QuadProps]; } });
      for (const [, art] of channels(d)) quadArt(art, spy as QuadProps);
      const declared = new Set<string>(d.params ?? []);
      expect([...used].sort(), `${d.key} : axes consommés non déclarés`).toEqual([...declared].sort());
    }
  });

  it('une clé SANS def rend la silhouette de REPLI VISIBLE + un avertissement (jamais un vide silencieux)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = quadHeadDef('espece-de-tete-inconnue-xyz');
    for (const v of VIEWS) expect(quadArt(d.art[v], witness('cheval'))).toContain(MISSING_TONE);
    if (import.meta.env?.DEV) expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
