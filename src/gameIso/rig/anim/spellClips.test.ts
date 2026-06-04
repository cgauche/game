import { describe, it, expect } from 'vitest';
import { spellCastStyle, spellCastClip, isSupportiveCast, classifySpellByLabel } from './spellClips';
import { clipDuration } from './clips';

describe('spellCastStyle — offensif vs soutien (depuis la relation lanceur↔cible)', () => {
  it('sur soi-même → bénédiction', () => {
    expect(spellCastStyle('hero', 'hero', true)).toBe('blessing');
  });
  it('sur un allié (même camp) → bénédiction', () => {
    expect(spellCastStyle('hero', 'hero', false)).toBe('blessing');
  });
  it('sur un ennemi → bolt offensif', () => {
    expect(spellCastStyle('hero', 'enemy', false)).toBe('bolt');
    expect(spellCastStyle('enemy', 'hero', false)).toBe('bolt');
  });
});

describe('spellCastClip — gestes distincts', () => {
  it('la bénédiction (bras levés soutenus) dure plus longtemps que le bolt', () => {
    expect(clipDuration(spellCastClip('blessing'))).toBeGreaterThan(clipDuration(spellCastClip('bolt')));
  });
  it('le bolt projette en avant (épaules positives à la libération)', () => {
    const release = spellCastClip('bolt').steps[1].pose as Record<string, number>;
    expect(release.epauleD!).toBeGreaterThan(0);
    expect(release.epauleG!).toBeGreaterThan(0);
  });
  it('la bénédiction lève les bras (épaules très négatives) et la tête', () => {
    const raise = spellCastClip('blessing').steps[0].pose as Record<string, number>;
    expect(raise.epauleD!).toBeLessThan(-60);
    expect(raise.tete!).toBeLessThan(0);
  });
});

describe('isSupportiveCast — gating du projectile', () => {
  it('soutien = pas de projectile', () => {
    expect(isSupportiveCast('hero', 'hero', true)).toBe(true);
    expect(isSupportiveCast('hero', 'enemy', false)).toBe(false);
  });
});

describe('classifySpellByLabel — data-driven (spells.json + engine/magic)', () => {
  it('un sort « Béni » est divin', () => {
    expect(classifySpellByLabel('Bénédiction de Bataille').school).toBe('divine');
  });
  it('un sort de Magie mineure est arcanique', () => {
    expect(classifySpellByLabel('Drain').school).toBe('arcane');
  });
  it('« Drain » est un projectile magique (desc)', () => {
    expect(classifySpellByLabel('Drain').missile).toBe(true);
  });
  it('libellé inconnu → défaut arcanique non-missile', () => {
    expect(classifySpellByLabel('Sort Imaginaire')).toEqual({ school: 'arcane', missile: false });
  });
});
