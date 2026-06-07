import { describe, it, expect } from 'vitest';
import { parsePsychTraits, peurTerreurFromSize, resolvePeurTest, resolveTerreurTest, isFrenzyCapable, resolveFrenzyEntry, targetedTrigger, resolveCalmeSimple } from './psychology';
import { makeRNG } from './dice';
import type { Combatant } from './types';

describe('Psychologie (pur)', () => {
  it('parsePsychTraits : « Peur N » / « Terreur N » / Immunité', () => {
    expect(parsePsychTraits(['Peur 4', 'Arme +7'])).toEqual({ causesPeur: 4 });
    expect(parsePsychTraits(['Terreur 3'])).toEqual({ causesTerreur: 3 });
    expect(parsePsychTraits(['Immunité (Psychologie)'])).toEqual({ psychImmune: true });
    expect(parsePsychTraits(['Arme +7'])).toEqual({});
  });
  it('parsePsychTraits : traits ciblés → psychTraits (Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie)', () => {
    const r = parsePsychTraits(['Animosité (Elfes)', 'Haine (Skavens)', 'Préjugé (Nains)', 'Amour (Famille)', 'Camaraderie (Soldats)', 'Phobie (Araignées)']);
    expect(r.psychTraits).toEqual(expect.arrayContaining([
      { type: 'animosite', cible: 'Elfes' },
      { type: 'haine', cible: 'Skavens' },
      { type: 'prejuge', cible: 'Nains' },
      { type: 'amour', cible: 'Famille' },
      { type: 'camaraderie', cible: 'Soldats' },
      { type: 'phobie', cible: 'Araignées', indice: 1 }, // Phobie = Peur 1 sur la source (LDB 21 l.84-87)
    ]));
  });
  it('parsePsychTraits : « un au choix » → Cible indéfinie (inerte)', () => {
    expect(parsePsychTraits(['Animosité (un au choix)']).psychTraits).toEqual([{ type: 'animosite', cible: undefined }]);
  });
  it('peurTerreurFromSize : écart ≥1 → Peur ; ≥2 → Terreur (Indice = écart)', () => {
    expect(peurTerreurFromSize('grande', 'moyenne')).toEqual({ kind: 'peur', indice: 1 });
    expect(peurTerreurFromSize('enorme', 'moyenne')).toEqual({ kind: 'terreur', indice: 2 });
    expect(peurTerreurFromSize('moyenne', 'moyenne')).toBeNull();
    expect(peurTerreurFromSize('petite', 'grande')).toBeNull(); // plus petit ne fait pas peur
  });
  it('resolvePeurTest : cumule le DR jusqu’à l’Indice (vaincue)', () => {
    const r = resolvePeurTest(80, 2, 0, makeRNG(2));
    expect(r.dr).toBeGreaterThanOrEqual(0);
    expect(typeof r.calmeDR).toBe('number');
    expect(r.calmeDR >= 2).toBe(r.vaincue); // vaincue ⟺ DR cumulé ≥ Indice
  });
  it('resolveTerreurTest : échec → Brisé = Indice + |DR négatifs| ; devient Peur', () => {
    const r = resolveTerreurTest(1, 3, makeRNG(2)); // FM 1 → échec quasi sûr
    if (!r.success) expect(r.brise).toBeGreaterThanOrEqual(3);
    expect(r.devientPeur).toBe(3);
  });
  it('isFrenzyCapable : trait OU talent « Frénésie »', () => {
    expect(isFrenzyCapable({ traits: ['Frénésie'], talents: [] } as unknown as Combatant)).toBe(true);
    expect(isFrenzyCapable({ traits: [], talents: [{ name: 'Frénésie', times: 1 }] } as unknown as Combatant)).toBe(true);
    expect(isFrenzyCapable({ traits: ['Arme +7'], talents: [] } as unknown as Combatant)).toBe(false);
  });
  it('resolveFrenzyEntry : Test de FM, succès = entre', () => {
    const r = resolveFrenzyEntry(80, makeRNG(2));
    expect(typeof r.success).toBe('boolean');
    expect(typeof r.roll).toBe('number');
  });
  it('targetedTrigger : Animosité (Elfes) se déclenche sur un ENNEMI du groupe Elfe visible', () => {
    const self = { id: 's', kind: 'enemy', psychTraits: [{ type: 'animosite', cible: 'Elfes' }], psychState: [] } as unknown as Combatant;
    const foe = { id: 'f', kind: 'hero', groups: ['Elfe', 'Soldat'] } as unknown as Combatant;
    const other = { id: 'o', kind: 'hero', groups: ['Humain'] } as unknown as Combatant;
    expect(targetedTrigger(self, [other, foe])).toEqual({ type: 'animosite', cible: 'Elfes', sourceId: 'f' });
    expect(targetedTrigger(self, [other])).toBeNull(); // aucun membre du groupe visible
  });
  it('targetedTrigger : Amour cible un ALLIÉ du groupe ; déjà en psychState → pas re-déclenché', () => {
    const self = { id: 's', kind: 'hero', psychTraits: [{ type: 'amour', cible: 'Famille' }], psychState: [] } as unknown as Combatant;
    const ally = { id: 'a', kind: 'hero', groups: ['Famille'] } as unknown as Combatant;
    expect(targetedTrigger(self, [ally])?.type).toBe('amour');
    (self.psychState as { type: string; cible: string }[]).push({ type: 'amour', cible: 'Famille' });
    expect(targetedTrigger(self, [ally])).toBeNull();
  });
  it('targetedTrigger : « un au choix » (Cible indéfinie) → inerte', () => {
    const self = { id: 's', kind: 'enemy', psychTraits: [{ type: 'animosite', cible: undefined }], psychState: [] } as unknown as Combatant;
    const foe = { id: 'f', kind: 'hero', groups: ['Elfe'] } as unknown as Combatant;
    expect(targetedTrigger(self, [foe])).toBeNull();
  });
  it('resolveCalmeSimple : Test de Calme binaire (succès = résisté)', () => {
    const r = resolveCalmeSimple(80, makeRNG(2));
    expect(typeof r.success).toBe('boolean');
    expect(typeof r.roll).toBe('number');
  });
});
