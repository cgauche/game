/**
 * Structures DESTRUCTIBLES de siège (ADE II ch.08 « Le théâtre de la guerre ») comme `Combatant` à PV —
 * module FEUILLE. Calqué sur `engine/vehicle.ts` (coque inerte) : une structure (`structures.json`) devient
 * une cible inanimée à Blessures qui encaisse les Dégâts par la langue UNIQUE `woundsFromHit`/`GameOp`. RAW
 * dit lui-même que Structure / Véhicule / Navire suivent le MÊME modèle Endurance/Blessures (AA l.3690).
 *
 * Trois Atouts data-driven greffés sur le résolveur de Blessures (`woundsCalc`) — JAMAIS de code par-nom :
 *  - **Siège** (atout d'ARME, ADE II l.292) : « inflige le double des dégâts aux structures physiques ».
 *    Lu sur l'arme par sa capacité de qualité `siege` (`qualities.json`).
 *  - **Résistant** (atout de STRUCTURE, l.296) : « ne peuvent pas être abîmées par une Arme à distance sans
 *    l'Atout Siège » — le corps à corps passe. Capacité de trait `structResistant` (`traits.json`).
 *  - **Impénétrable** (atout de STRUCTURE, l.300) : « ne peuvent pas être abîmées par une Arme sans l'Atout
 *    Siège » — toute arme. Capacité de trait `structImpenetrable` (namespace DISTINCT de la qualité d'armure
 *    LDB 63 « Impénétrable » `critImmuneOdd` : ici c'est un Trait `impenetrable-structure`).
 *  - **Bélier** (ADE II l.249) : « n'infligent des dégâts qu'aux portes » — capacité de qualité `ram`.
 *
 * Module FEUILLE : n'importe QUE `qualities/dispatch` (caps de l'arme) + `capabilities` (caps de la cible) +
 * la donnée/`items` (le BUILDER), JAMAIS `combat`/`ops` → aucun cycle (`woundsCalc` peut le greffer).
 */
import type { Combatant, Weapon, StructureData } from './types';
import { resolveQualities } from './qualities/dispatch';
import { hasCapability } from './capabilities';
import { findStructureById } from '../data';
import { inanimateCombatant } from './inanimate';

/** Cette cible est-elle une STRUCTURE de siège (`bodyShape:'structure'`) ? Prédicat NOMMÉ (source UNIQUE —
 *  plus de littéral `'structure'` dispersé) : une structure est inerte (Tableau de Localisation propre,
 *  Psychologie ignorée) et porte les Atouts Résistant/Impénétrable. */
export function isStructure(c: Pick<Combatant, 'bodyShape'>): boolean {
  return c.bodyShape === 'structure';
}

/** Emplacement d'artillerie de siège (`bodyShape:'engin'`) — affût servi par un équipage (≠ 'structure' = mur/porte). */
export function isEngin(c: Pick<Combatant, 'bodyShape'>): boolean {
  return c.bodyShape === 'engin';
}

/** Cette cible est-elle un OBJET INANIMÉ (pas une créature) — STRUCTURE de siège (ADE II ch.08), VÉHICULE-coque
 *  (navire/chariot/barge, MDG) ou pièce SERVIE explicitement inerte (`inert`, ex. un affût d'artillerie) ? Source
 *  UNIQUE et NOMMÉE du « c'est un objet » : aucune réaction de combat (ni Parade/Esquive, ni Localisation, ni
 *  Engagement). Le littéral `'vehicule'` est INLINÉ à dessein : importer `isVehicle` créerait un cycle
 *  `structures → vehicle → ops → woundsCalc → structures`. La DESTRUCTION reste, elle, par-type (Siège ×2 propre
 *  aux structures, Critiques navals propres aux véhicules) → garder `isStructure`/`isVehicle` à ces sites-là. */
export function isInanimate(c: Pick<Combatant, 'bodyShape' | 'inert'>): boolean {
  return isStructure(c) || c.bodyShape === 'vehicule' || !!c.inert;
}

/** L'arme porte-t-elle la capacité de qualité `cap` (`siege`/`ram`) ? Lue dans la DONNÉE (`qualities.json`)
 *  par le MÊME résolveur que tous les Atouts d'arme — aucun test par libellé. */
function weaponHasCap(weapon: Pick<Weapon, 'qualities'> | undefined, cap: 'siege' | 'ram'): boolean {
  return resolveQualities(weapon).some((r) => !!r.caps?.[cap]);
}

/** Catégorie physique de la structure cible (`porte`/`mur`), lue dans le catalogue par son `id` (posé sur
 *  `creatureId` au build) — pour la règle « Bélier : portes uniquement ». `undefined` si la cible n'est pas
 *  une structure du catalogue. */
function structureKind(target: Combatant): 'porte' | 'mur' | undefined {
  return target.creatureId ? findStructureById(target.creatureId)?.kind : undefined;
}

/**
 * La structure `target` est-elle IMPARABLE par cette `weapon` (le coup ne l'abîme pas → 0 Blessure) ?
 *  - **Bélier** (`ram`, ADE II l.249) : n'endommage QUE les portes → toute structure non-porte est imparable.
 *  - **Impénétrable** (`structImpenetrable`, l.300) : imparable par TOUTE arme sans l'Atout Siège.
 *  - **Résistant** (`structResistant`, l.296) : imparable par une Arme À DISTANCE sans Siège (le corps à corps passe).
 */
export function structureImmune(weapon: Weapon | undefined, target: Combatant): boolean {
  const siege = weaponHasCap(weapon, 'siege');
  if (weaponHasCap(weapon, 'ram') && structureKind(target) !== 'porte') return true;
  if (!siege && hasCapability(target, 'structImpenetrable')) return true;
  if (!siege && weapon?.type === 'ranged' && hasCapability(target, 'structResistant')) return true;
  return false;
}

/** Multiplicateur de Dégâts de l'Atout Siège (ADE II l.292) : ×2 pour une arme à Atout Siège frappant une
 *  STRUCTURE, ×1 sinon. Appliqué au TOTAL de Dégâts entrant (avant Bonus d'Endurance) par `woundsFromHit`. */
export function siegeMultiplier(weapon: Weapon | undefined, target: Combatant): number {
  return isStructure(target) && weaponHasCap(weapon, 'siege') ? 2 : 1;
}

/** Les DEUX cases bordant l'arête d'une structure (ses deux FACES) — calque `parapetTilesAbove` au sol
 *  (z de l'arête). Une arête N borde `(x,y)` (intérieur) ET `(x,y-1)` (extérieur) ; E borde `(x,y)` et
 *  `(x+1,y)` ; une cloison diagonale n'a qu'une case. Vide si la structure ne porte pas d'arête. */
export function structureFaceCells(c: Pick<Combatant, 'structureEdge'>): { x: number; y: number }[] {
  const e = c.structureEdge;
  if (!e) return [];
  if (e.side === 'N') return [{ x: e.x, y: e.y }, { x: e.x, y: e.y - 1 }];
  if (e.side === 'E') return [{ x: e.x, y: e.y }, { x: e.x + 1, y: e.y }];
  return [{ x: e.x, y: e.y }];
}

/** Case de VISÉE d'une structure depuis `from` : sa FACE la plus proche de l'attaquant. C'est la seule
 *  par laquelle la Ligne de Vue n'est PAS coupée par l'arête de la structure ELLE-MÊME (on voit/frappe la
 *  face d'un mur depuis son côté ; on ne « voit pas à travers » jusqu'à la case derrière). Repli sur `pos`
 *  (structure sans arête / fixture de test). Réutilisé par l'IA (cible la porte) ET la résolution (LdV de tir). */
export function structureAimCell(from: { x: number; y: number }, target: Pick<Combatant, 'structureEdge' | 'pos'>): { x: number; y: number } {
  const faces = structureFaceCells(target);
  if (!faces.length) return target.pos ?? from;
  const cheb = (p: { x: number; y: number }) => Math.max(Math.abs(p.x - from.x), Math.abs(p.y - from.y));
  return faces.reduce((best, f) => (cheb(f) < cheb(best) ? f : best));
}

/** Adaptateur de `inanimateCombatant` (builder UNIQUE des objets inanimés) pour une structure de siège
 *  (`structures.json`). `E = BE × 10` (la table ADE II donne le Bonus d'Endurance ⇒ `bonus(E)` retrouve
 *  `BE`) ; `wounds = Blessures`. Les Atouts Résistant/Impénétrable sont posés en `traits` (lus par
 *  `hasCapability` dans `structureImmune`). */
export function structureCombatant(struct: StructureData, id = `structure-${struct.id}`): Combatant {
  return inanimateCombatant({
    id,
    name: struct.label,
    refId: struct.id, // clé du catalogue (porte/mur) — lue par `structureKind`
    bodyShape: 'structure',
    hull: { e: struct.char.BE * 10, woundsB: struct.char.B }, // ADE II donne le Bonus d'Endurance ⇒ E = BE × 10 (verbatim)
    traits: struct.traits.map((t) => (t.value != null ? { id: t.id, value: t.value } : { id: t.id })),
  });
}
