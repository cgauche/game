/**
 * Terrains — la façade sert le dataset `src/data/terrains.json` (#1690).
 *
 * Trois contrats : la RÈGLE (franchissabilité, précédence, repli bloquant d'un id inconnu), la
 * FRAÎCHEUR (une entrée éditée à l'atelier est vue par la façade ET par le catalogue de rendu, alors
 * que `setDataset` mute le tableau EN PLACE et n'en change jamais l'identité), et l'ASSEMBLAGE des
 * dégradés SVG (un dégradé par terrain, ses PROPRES arrêts).
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  tousLesTerrains, terrainIds, terrainEntree, terrainLabel, terrainWalkable, terrainPriority,
  terrainOpaque, terrainBuilt, terrainSolidHeightM, terrainOverlayProp, terrainDetail,
} from './index';
import { setDataset } from '../../data/overrides';
import { terrainDef, terrainGradient, terrainGradientId, MISSING_GRADIENT } from '../../gameIso/catalog/terrain';
import { DEFS } from '../../gameIso/sprites';

const AVANT = tousLesTerrains().map((t) => ({ ...t }));
afterEach(() => setDataset('terrains', AVANT as never));

describe('terrains — la règle lue au dataset', () => {
  it('le dataset porte les ids attendus, et la façade les sert', () => {
    for (const id of ['herbe', 'sol', 'route', 'eau', 'plancher', 'bois', 'mur', 'porte', 'pave', 'terre', 'dalle'])
      expect(terrainEntree(id), id).toBeDefined();
    expect(terrainIds()).toHaveLength(tousLesTerrains().length);
  });

  it('walkability : herbe/route/pave franchissables, eau/mur non', () => {
    expect(terrainWalkable('herbe')).toBe(true);
    expect(terrainWalkable('pave')).toBe(true);
    expect(terrainWalkable('eau')).toBe(false);
    expect(terrainWalkable('mur')).toBe(false);
  });

  it('id inconnu → non franchissable, transparent, non bâti, sans bloc ni décor ni recette', () => {
    expect(terrainWalkable('zzz-inconnu')).toBe(false);
    expect(terrainOpaque('zzz-inconnu')).toBe(false);
    expect(terrainBuilt('zzz-inconnu')).toBe(false);
    expect(terrainSolidHeightM('zzz-inconnu')).toBe(0);
    expect(terrainOverlayProp('zzz-inconnu')).toBeUndefined();
    expect(terrainDetail('zzz-inconnu')).toBeNull();
    expect(terrainLabel('zzz-inconnu')).toBeUndefined();
  });

  it('précédence : pave déborde sur herbe (priorité plus haute)', () => {
    expect(terrainPriority('pave')).toBeGreaterThan(terrainPriority('herbe'));
  });

  it('mur : opaque, bâti, bloc plein ; bois : décor posé sur chaque tuile', () => {
    expect(terrainOpaque('mur')).toBe(true);
    expect(terrainBuilt('mur')).toBe(true);
    expect(terrainSolidHeightM('mur')).toBeGreaterThan(0);
    expect(terrainOverlayProp('bois')).toBe('arbre');
  });
});

describe('terrains — la façade et le catalogue de rendu lisent VIF', () => {
  it('une entrée éditée est vue par la façade ET par le catalogue, sans rechargement', () => {
    const editees = AVANT.map((t) => {
      if (t.id === 'herbe') return { ...t, walkable: false };
      if (t.id === 'eau') return { ...t, swatch: '#0d0d0d' };
      return t;
    });
    expect(terrainWalkable('herbe')).toBe(true);
    expect(terrainDef('eau').swatch).not.toBe('#0d0d0d');
    setDataset('terrains', editees as never);
    expect(terrainWalkable('herbe'), 'la façade a servi un index PÉRIMÉ').toBe(false);
    expect(terrainDef('eau').swatch, 'le catalogue de rendu a servi un index PÉRIMÉ').toBe('#0d0d0d');
  });

  it('une entrée AJOUTÉE est référençable aussitôt', () => {
    const neuf = { ...AVANT[0], id: 'terrain-neuf', label: 'Terrain neuf', walkable: true };
    setDataset('terrains', [...AVANT, neuf] as never);
    expect(terrainEntree('terrain-neuf')).toBeDefined();
    expect(terrainWalkable('terrain-neuf')).toBe(true);
  });
});

describe('terrains — dégradés SVG dérivés, jamais partagés', () => {
  it('l’id de dégradé se DÉRIVE de l’id du terrain : deux terrains n’en partagent aucun', () => {
    const ids = tousLesTerrains().map((t) => terrainGradientId(t.id));
    expect(new Set(ids).size, 'deux terrains au même dégradé').toBe(ids.length);
    expect(terrainGradient('herbe')).toBe('g_herbe');
    expect(terrainGradient('bois')).toBe('g_bois');
  });

  it('DEFS émet UN dégradé par terrain, avec SES arrêts — l’herbe garde ses couleurs', () => {
    for (const t of tousLesTerrains()) {
      expect(DEFS, t.id).toContain(`<linearGradient id="${terrainGradientId(t.id)}"`);
      for (const [off, color] of Object.entries(t.stops)) {
        expect(off, `${t.id}: offset`).toMatch(/^(?:100|[0-9]{1,2})%$/);
        expect(color, `${t.id}: couleur`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    const herbe = terrainEntree('herbe')!;
    const bois = terrainEntree('bois')!;
    expect(herbe.stops['0%']).not.toBe(bois.stops['0%']);
    expect(DEFS).toContain(`<linearGradient id="g_herbe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${herbe.stops['0%']}"/>`);
    expect(DEFS).toContain(`<linearGradient id="g_bois" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${bois.stops['0%']}"/>`);
  });

  it('aucun terrain ne dérive vers le dégradé de REPLI VISIBLE (#877)', () => {
    expect(tousLesTerrains().map((t) => terrainGradientId(t.id))).not.toContain(MISSING_GRADIENT);
  });
});
