import { describe, it, expect } from 'vitest';
import { musicSelectionOf, musicDefsFor, type MusicStateSlice } from './music';

const at = (over: Partial<MusicStateSlice>): MusicStateSlice => ({
  screen: 'campaign',
  mode: 'exploration',
  battle: null,
  scene: { ambiance: 'exterieur' },
  ...over,
});

describe('musicSelectionOf — résolution de la musique (scène > contexte)', () => {
  it('combat en campagne → contexte combat', () => {
    expect(musicSelectionOf(at({ mode: 'battle', battle: {} }))).toEqual({ ctx: 'combat' });
  });
  it('exploration en intérieur → contexte interieur', () => {
    expect(musicSelectionOf(at({ scene: { ambiance: 'interieur' } }))).toEqual({ ctx: 'interieur' });
  });
  it('exploration en extérieur → contexte exploration', () => {
    expect(musicSelectionOf(at({}))).toEqual({ ctx: 'exploration' });
  });
  it('écrans hors campagne → contexte menu', () => {
    for (const screen of ['menu', 'party', 'creator', 'coop', 'test', 'interlude'] as const) {
      expect(musicSelectionOf(at({ screen, scene: null }))).toEqual({ ctx: 'menu' });
    }
  });
  it("éditeur → silence (pas de musique pendant l'outillage)", () => {
    expect(musicSelectionOf(at({ screen: 'editor' }))).toBe(null);
  });
  it("la scène impose sa piste d'ambiance (paramétrée dans l'éditeur)", () => {
    expect(musicSelectionOf(at({ scene: { ambiance: 'exterieur', music: { ambient: 'musique-taverne' } } })))
      .toEqual({ def: 'musique-taverne' });
  });
  it('la scène impose sa piste de combat', () => {
    expect(musicSelectionOf(at({ mode: 'battle', battle: {}, scene: { ambiance: 'exterieur', music: { combat: 'musique-ville' } } })))
      .toEqual({ def: 'musique-ville' });
  });
  it('la scène peut forcer le silence (null) — ambiance et combat indépendants', () => {
    const scene = { ambiance: 'exterieur' as const, music: { ambient: null } };
    expect(musicSelectionOf(at({ scene }))).toBe(null);
    // combat non précisé sur cette scène → repli contexte combat
    expect(musicSelectionOf(at({ mode: 'battle', battle: {}, scene }))).toEqual({ ctx: 'combat' });
  });
});

describe('musicDefsFor — pistes par contexte (registre)', () => {
  it('chaque contexte a au moins une piste', () => {
    for (const ctx of ['menu', 'exploration', 'interieur', 'combat'] as const) {
      expect(musicDefsFor(ctx).length, `contexte ${ctx}`).toBeGreaterThan(0);
    }
  });
  it('ne retourne que des defs musique du contexte (jamais un SFX)', () => {
    for (const ctx of ['menu', 'exploration', 'interieur', 'combat'] as const) {
      for (const def of musicDefsFor(ctx)) expect(def.music?.contexts).toContain(ctx);
    }
  });
  it('le combat joue la piste de bataille', () => {
    expect(musicDefsFor('combat').map((d) => d.id)).toContain('musique-combat');
  });
});
