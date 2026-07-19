import { describe, it, expect } from 'vitest';
import { resolveVolley } from './volley';
import type { RNG } from './dice';
import type { Combatant, ShipPoste } from './types';

const gunner = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ id, label: id, kind: 'npc', characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 0, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 }, conditions: [], wounds: { current: 10, max: 10, base: 10 }, items: [], ...over }) as unknown as Combatant;

/** Pièce d'artillerie : Dégâts plats `flat`, qualités optionnelles, servie par `crewIds`. */
const poste = (crewIds: string[], flat = 14, qualities: { id: string; value?: number }[] = []): ShipPoste =>
  ({ side: 'tribord', item: { uid: 'gun-' + crewIds.join('') + flat, label: 'Canon', kind: 'ranged', subType: 'armes-de-siege', damage: { flat, plusBF: false }, range: 75, qualities }, crewIds }) as unknown as ShipPoste;

const ship = (): Combatant => ({ id: 'ship', label: 'Navire', kind: 'npc', bodyShape: 'vehicule', conditions: [], weapons: [] }) as unknown as Combatant;

const hull = (E: number, armourCorps = 0, wounds = 90): Combatant =>
  ({ id: 'target', label: 'Coque', kind: 'enemy', bodyShape: 'vehicule', characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: E, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 }, armour: { corps: armourCorps }, conditions: [], wounds: { current: wounds, max: 90, base: 90 } }) as unknown as Combatant;

const fixed = (n: number): RNG => ({ int: () => n }) as unknown as RNG;

describe('resolveVolley — la bordée RÉUTILISE le pipeline de tir (MDG 14 l.128)', () => {
  const firing = ship();
  const target = () => hull(40); // BE 4

  it('pièce servie : Dégâts = arme + DR partagé − BE ; une pièce NON servie ne tire pas', () => {
    const r = resolveVolley(firing, [poste(['g1']), poste([])], target(), 'voile', 3, [gunner('g1')], fixed(34));
    expect(r.shots).toHaveLength(1); // seule la pièce servie tire
    expect(r.shots[0].damage).toBe(17); // 14 + 3
    expect(r.shots[0].wounds).toBe(13); // 17 − BE 4
  });

  it('« pour le pire » : DR négatif RÉDUIT les Dégâts, plancher 0 (ch.13 l.605)', () => {
    const r = resolveVolley(firing, [poste(['g1'])], target(), 'voile', -20, [gunner('g1')], fixed(34));
    expect(r.shots[0].damage).toBe(-6); // 14 − 20
    expect(r.shots[0].wounds).toBe(0);
  });

  it('munition fusionnée : Dégâts de la munition s’appliquent (réutilise weaponWithAmmo)', () => {
    const g = gunner('g1', { ammoUid: 'boulet', items: [{ uid: 'boulet', label: 'Boulet', kind: 'ammo', subType: 'munition-de-siege', damage: { flat: 4, plusBF: false }, qualities: [], qty: 5 } as never] });
    const r = resolveVolley(firing, [poste(['g1'])], target(), 'voile', 3, [g], fixed(34));
    expect(r.shots[0].damage).toBe(21); // 14 + 4 (boulet) + 3
    expect(r.shots[0].ammoName).toBe('Boulet');
  });

  it('Perforante de la munition perce le blindage (réutilise woundsFromHit)', () => {
    const armored = () => hull(40, 4); // BE 4 + blindage 4
    const plain = resolveVolley(firing, [poste(['g1'])], armored(), 'voile', 3, [gunner('g1')], fixed(34));
    const perf = gunner('g1', { ammoUid: 'p', items: [{ uid: 'p', label: 'Carreau', kind: 'ammo', subType: 'munition-de-siege', damage: { flat: 0, plusBF: false }, qualities: [{ id: 'perforante' }], qty: 5 } as never] });
    const r = resolveVolley(firing, [poste(['g1'])], armored(), 'voile', 3, [perf], fixed(34));
    expect(r.shots[0].wounds).toBeGreaterThan(plain.shots[0].wounds); // Perforante réduit la PA → plus de Blessures
  });

  it('sous-effectif (Arme d’équipe 3 à 1 servant) → Imprécise : −1 DR sur la pièce', () => {
    const adE = [{ id: 'arme-d-equipe', value: 3 }];
    const full = resolveVolley(firing, [poste(['a', 'b', 'c'], 14, adE)], target(), 'voile', 5, [gunner('a'), gunner('b'), gunner('c')], fixed(34));
    const short = resolveVolley(firing, [poste(['a'], 14, adE)], target(), 'voile', 5, [gunner('a')], fixed(34));
    expect(short.shots[0].damage).toBe(full.shots[0].damage - 1); // Imprécise (−1 DR) du sous-effectif
  });

  it('coque à 0 Blessure → tout coup est un Critique (ch.13 l.656)', () => {
    const r = resolveVolley(firing, [poste(['g1'])], hull(40, 0, 0), 'voile', 3, [gunner('g1')], fixed(34));
    expect(r.shots[0].critical).toBe(true); // 34 ≠ double, mais coque à 0
  });

  it('double sur le 1d100 → Critique', () => {
    const r = resolveVolley(firing, [poste(['g1'])], target(), 'voile', 3, [gunner('g1')], fixed(33));
    expect(r.shots[0].critical).toBe(true);
  });
});
