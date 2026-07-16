import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Combatant, ItemInstance, Weapon } from '../engine/types';
import { firedWeapon, weaponContextOf } from './combatFlow';
import * as capabilities from '../engine/capabilities';

// Mode de tir « corde séparée » (Lance-harpon, ADE II 02 l.677) : choix joueur AVANT le jet
// (`PendingAttack.harpoonRopeCut`), GATÉ sur la capacité `ItemCapabilities.ropeMode` de l'arme
// tirée (jamais un id d'arme en dur, #476). `trappings.json` ne porte pas encore cette capacité
// sur `lance-harpon` (gel #476, cf. rendu de session) : `itemCapability` est stubbé pour
// verrouiller le CÂBLAGE (weaponContextOf/firedWeapon) indépendamment de la donnée catalogue —
// le test « arme réelle sans le flag » ci-dessous, lui, tourne SANS stub contre le catalogue réel.
afterEach(() => vi.restoreAllMocks());

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const mk = (p: Partial<Combatant>): Combatant => ({
  id: 'a', name: 'X', kind: 'hero', characteristics: CHARS,
  wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
  engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  ...p,
} as unknown as Combatant);

const target = mk({ id: 't', kind: 'enemy', pos: { x: 1, y: 0 } });

const harpoon: Weapon = {
  name: 'Lance-harpon', type: 'ranged', hands: 2, uid: 'hp', range: 20,
  damage: { plusBF: false, flat: 10 }, qualities: [{ id: 'immobilisante' }, { id: 'recharge', value: 2 }],
};
const harpoonItem: ItemInstance = { uid: 'hp', trappingId: 'lance-harpon', name: 'Lance-harpon', kind: 'ranged', qualities: [], enc: 5, equipped: true };

describe('Mode de tir « corde séparée » (Lance-harpon, ADE II 02 l.677, #476)', () => {
  it('toggle posé + arme éligible (ropeMode) → arme résolue au tir Portée 60, Immobilisante perdue', () => {
    vi.spyOn(capabilities, 'itemCapability').mockReturnValue(true);
    const atk = mk({ weapons: [harpoon], items: [harpoonItem] });
    const w = firedWeapon(atk, target, 'hp', undefined, true);
    expect(w.range).toBe(60);
    expect(w.qualities.some((q) => q.id === 'immobilisante')).toBe(false);
    expect(w.qualities.some((q) => q.id === 'recharge')).toBe(true); // Recharge(2) conservée
  });

  it('toggle NON posé (même arme éligible) → profil de base inchangé (Portée 20, Immobilisante conservée)', () => {
    vi.spyOn(capabilities, 'itemCapability').mockReturnValue(true);
    const atk = mk({ weapons: [harpoon], items: [harpoonItem] });
    const w = firedWeapon(atk, target, 'hp', undefined, false);
    expect(w.range).toBe(20);
    expect(w.qualities.some((q) => q.id === 'immobilisante')).toBe(true);
  });

  it('arme RÉELLE du catalogue (lance-harpon, sans capacité ropeMode encore posée) → le toggle est ignoré même déclaré', () => {
    const atk = mk({ weapons: [harpoon], items: [harpoonItem] });
    const ctx = weaponContextOf(atk, harpoon, target, { harpoonRopeCut: true });
    expect(ctx.harpoonRopeCut).toBe(false);
  });

  it('arme SANS aucune capacité ropeMode (trapping inconnu) → le toggle est ignoré même posé', () => {
    const otherItem: ItemInstance = { uid: 'hp', trappingId: 'autre-arme-inconnue', name: 'Autre', kind: 'ranged', qualities: [], enc: 5, equipped: true };
    const atk = mk({ weapons: [harpoon], items: [otherItem] });
    const ctx = weaponContextOf(atk, harpoon, target, { harpoonRopeCut: true });
    expect(ctx.harpoonRopeCut).toBe(false);
  });
});
