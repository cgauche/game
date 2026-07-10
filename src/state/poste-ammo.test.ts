import { describe, it, expect } from 'vitest';
import { compatibleAmmo, selectedAmmo, consumeAmmo } from '../engine/items';
import { resolveVolley } from '../engine/volley';
import { serveChef } from './shipPostes';
import { applyOups } from './combatFlow';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { makeRNG } from '../engine/dice';
import type { Combatant, ItemInstance, ShipPoste, Weapon } from '../engine/types';

/**
 * #25 — MUNITIONS PAR POSTE (MDG ch.12 l.410-424 « Munitions pour pièces d'artillerie ») : le poste porte
 * son STOCK (`ShipPoste.ammo`) et sa SÉLECTION persistante (`ShipPoste.ammoUid`) ; le pool du chef =
 * stock du poste ∪ sa besace (`compatibleAmmo`, source unique), consommé au tir (`consumeAmmo`).
 * + INCIDENT D'ARME D'ÉQUIPE (ch.12 l.464) : « Si une arme dotée du Défaut Arme d'équipe subit un
 * Incident de tir, tous les membres de son équipage sont affectés. »
 */
const chars = { 'capacite-de-combat': 30, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const ammoItem = (uid: string, name: string, qty: number, over: Partial<ItemInstance> = {}): ItemInstance =>
  ({ uid, name, kind: 'ammo', subType: 'munition-de-siege', qty, qualities: [], enc: 0, equipped: false, ...over }) as ItemInstance;
const mkPoste = (ammo: ItemInstance[], ammoUid?: string): ShipPoste =>
  ({ side: 'tribord',
    item: { uid: 'canon', name: 'Canon (moyen)', kind: 'ranged', subType: 'armes-de-siege', weaponGroup: 'poudre-noire',
      damage: { flat: 14, plusBF: false }, range: 75, qualities: [{ id: 'arme-d-equipe', value: 2 }, { id: 'recharge', value: 6 }] },
    crewIds: ['chef', 'aide'], ammo, ammoUid }) as unknown as ShipPoste;
const mkCrew = (id: string, items: ItemInstance[] = []): Combatant =>
  ({ id, name: id, kind: 'hero', characteristics: { ...chars },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], items,
    skills: [{ skillId: 'projectiles', spec: 'poudre-noire', characteristic: 'capacite-de-tir', advances: 20 }], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } }) as unknown as Combatant;
const mkHull = (poste: ShipPoste): Combatant =>
  ({ id: 'ship', name: 'Frégate', kind: 'npc', bodyShape: 'vehicule', creatureId: 'cogue', crewIds: ['chef', 'aide'],
    postes: [poste], pos: { x: 5, y: 5 }, conditions: [], weapons: [],
    characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 40, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
    wounds: { current: 60, max: 60 }, advantage: 0, skills: [], talents: [], armour: { corps: 0 } }) as unknown as Combatant;
const foeHull = (): Combatant =>
  ({ id: 'target', name: 'Caraque', kind: 'enemy', bodyShape: 'vehicule', creatureId: 'knarr', pos: { x: 9, y: 5 },
    characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 40, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
    wounds: { current: 60, max: 60 }, advantage: 0, conditions: [], weapons: [], skills: [], talents: [], armour: { corps: 0 }, crewIds: [] }) as unknown as Combatant;

describe('Stock de munitions du poste (MDG ch.12 l.410-424)', () => {
  it('compatibleAmmo du chef = stock du POSTE (en tête) ∪ sa besace ; selectedAmmo suit poste.ammoUid', () => {
    const boulet = ammoItem('boulet', 'Boulet et poudre', 5);
    const mitraille = ammoItem('mitraille', 'Mitraille et poudre', 3);
    const perso = ammoItem('perso', 'Boulet perso', 2);
    const poste = mkPoste([boulet, mitraille], 'mitraille');
    const chef = mkCrew('chef', [perso]);
    serveChef(chef, poste); // pose mannedPoste + l'arme dérivée (mountSide)
    const gun = chef.weapons.find((w) => w.uid === 'canon')!;
    expect(compatibleAmmo(chef, gun).map((a) => a.uid)).toEqual(['boulet', 'mitraille', 'perso']);
    expect(selectedAmmo(chef, gun)!.uid).toBe('mitraille'); // sélection PERSISTANTE du poste
    chef.ammoUid = 'boulet'; // choix ponctuel du héros (hotbar) : PRIME sur le poste
    expect(selectedAmmo(chef, gun)!.uid).toBe('boulet');
  });

  it('consumeAmmo décrémente LÀ où vit la munition (stock du poste) et retire l’instance à 0', () => {
    const mitraille = ammoItem('mitraille', 'Mitraille et poudre', 1);
    const poste = mkPoste([mitraille], 'mitraille');
    const chef = mkCrew('chef');
    serveChef(chef, poste);
    consumeAmmo(chef, mitraille);
    expect(poste.ammo!.some((a) => a.uid === 'mitraille')).toBe(false); // épuisée → retirée du coffre
    expect(chef.items).toEqual([]); // jamais touchée à la besace
  });

  it('resolveVolley tire la munition du STOCK DU POSTE (qualités de la munition fusionnées)', () => {
    const boulet = ammoItem('boulet', 'Boulet et poudre', 5, { qualities: [{ id: 'percutante' }], damage: { flat: 0, plusBF: false } });
    const poste = mkPoste([boulet], 'boulet');
    const chef = mkCrew('chef');
    const aide = mkCrew('aide');
    const hull = mkHull(poste);
    serveChef(chef, poste);
    const volley = resolveVolley(hull, [poste], foeHull(), 'voile', 2, [chef, aide], makeRNG(5));
    expect(volley.shots).toHaveLength(1);
    expect(volley.shots[0].ammoName).toBe('Boulet et poudre');
    expect(volley.shots[0].ammo!.uid).toBe('boulet');
    expect(volley.shots[0].weapon.qualities.some((q) => q.id === 'percutante')).toBe(true); // munition bakée
  });

  it('bordée jouable : la munition du poste est CONSOMMÉE au « Feu ! » (shipBatteryConfirm)', () => {
    seedBattleRng(7);
    const boulet = ammoItem('boulet', 'Boulet et poudre', 2);
    const poste = mkPoste([boulet], 'boulet');
    const chef = mkCrew('chef');
    const aide = mkCrew('aide');
    const hull = mkHull(poste);
    serveChef(chef, poste);
    useGame.setState({
      battle: { combatants: [hull, chef, aide, foeHull()], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
      party: [chef, aide], facing: { ship: 'N' }, pendingShipBattery: null, scene: null as never,
    });
    useGame.getState().battleShipBattery('ship', 'target');
    const p = useGame.getState().pendingShipBattery!;
    for (const part of p.participants) useGame.getState().shipBatteryRoll(part.id);
    useGame.getState().shipBatteryConfirm();
    expect(poste.ammo![0].qty).toBe(1); // 2 → 1 : un boulet parti avec la bordée
  });
});

describe('Incident de tir d’une Arme d’équipe (MDG ch.12 l.464) — tous les servants affectés', () => {
  it('applyOups misfire sur le chef d’une pièce Arme d’équipe → l’AIDE encaisse aussi', () => {
    const poste = mkPoste([]);
    const chef = mkCrew('chef');
    const aide = mkCrew('aide');
    const hull = mkHull(poste);
    serveChef(chef, poste);
    useGame.setState({
      battle: { combatants: [hull, chef, aide], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
      party: [chef, aide], facing: { ship: 'N' }, scene: null as never,
    });
    const get = () => useGame.getState();
    const set = ((patch: never) => useGame.setState(patch)) as never;
    const gun = chef.weapons.find((w) => w.uid === 'canon')! as Weapon;
    applyOups(get, set, chef, gun, { roll: 42, kind: 'misfire', label: 'Incident de Tir !' });
    expect(chef.wounds.current).toBeLessThan(12); // le tireur encaisse (Bras principal)
    expect(aide.wounds.current).toBeLessThan(12); // « tous les membres de son équipage sont affectés » (l.464)
  });

  it('arme SANS Arme d’équipe → l’Incident ne frappe que le tireur (règle LDB inchangée)', () => {
    const poste = mkPoste([]);
    poste.item.qualities = [{ id: 'recharge', value: 6 }] as never; // pas d'arme-d-equipe
    const chef = mkCrew('chef');
    const aide = mkCrew('aide');
    const hull = mkHull(poste);
    serveChef(chef, poste);
    useGame.setState({
      battle: { combatants: [hull, chef, aide], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
      party: [chef, aide], facing: { ship: 'N' }, scene: null as never,
    });
    const get = () => useGame.getState();
    const set = ((patch: never) => useGame.setState(patch)) as never;
    const gun = chef.weapons.find((w) => w.uid === 'canon')! as Weapon;
    applyOups(get, set, chef, gun, { roll: 42, kind: 'misfire', label: 'Incident de Tir !' });
    expect(chef.wounds.current).toBeLessThan(12);
    expect(aide.wounds.current).toBe(12);
  });
});
