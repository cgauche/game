/**
 * Profil de rendu RIG d'un combattant ennemi/PNJ humanoïde — COSMÉTIQUE (l'engine
 * n'en dépend jamais). Transforme un Combatant en (apparence, tenue, équipement,
 * calques de mutation) pour le rendre via le rig au lieu du sprite monolithique.
 *
 * Décisions : voir docs/superpowers/specs/2026-06-05-F1-ennemis-rig-design.md
 */
import type { Combatant, ItemInstance, ArmourPoints, HitLocation } from '../../engine/types';
import type { Appearance } from './appearance';
import type { EquipCtx } from './parts/equipment';
import { equipFromCombatant } from './parts/equipment';
import { newUid, emptyArmour } from '../../engine/items';
import { renderWeaponsFromTraits, armourFromTraits } from '../../engine/creatureEquip';
import type { TraitList } from '../../engine/statEntry';
import { weaponGroupKey } from './parts/weaponGroup';
import { EYE_OPTIONS, eyesArtFromKeys } from './parts/eyes';
import type { MonsterParts } from './parts/monstrous';
import { hashSeed } from '../appearance';
import { bipedDef, defByName } from './creatures';
import { resolveRender } from './bodyPlan';
import { findCreatureById } from '../../data';
import type { EntityAppearance } from '../../state/scene';
import { raceById } from './races';
import { baseSpeciesOf } from './skeletons';

const RANGED_GROUPS = new Set(['arc', 'arbalete', 'poudre', 'fronde', 'lancer', 'entraves', 'explosifs', 'ingenierie']);
/** Construit une arme minimale depuis un libellé (type déduit du Groupe canonique). */
export function weaponFromLabel(label: string): import('../../engine/types').Weapon {
  const w = { name: label, type: 'melee' as 'melee' | 'ranged', damage: '+0', qualities: [], uid: `w-${newUid()}` };
  if (RANGED_GROUPS.has(weaponGroupKey(w))) w.type = 'ranged';
  return w;
}

export interface EnemyRigProfile {
  appearance: Appearance;
  tenue: string;
  equip: EquipCtx;
}

/** Classe de rendu d'un NOM (sans espèce explicite) — délègue au résolveur unique `resolveRender`
 *  (repli name-match). 'rig' (humanoïde → rig bipède) ou 'creature' (gabarit quad/ailé/… / nuée). */
export function classifyEnemy(creatureId: string): 'rig' | 'creature' {
  return resolveRender(undefined, findCreatureById(creatureId)?.traits, creatureId).kind === 'plan' ? 'creature' : 'rig';
}

/** Classe de rendu DATA-DRIVEN (de-POC P5) — délègue au résolveur unique `resolveRender` : trait
 *  Nuée ou espèce CANONIQUE explicite (lookup exact) ; repli name-match si l'espèce est absente. */
export function classifyBy(species: string | undefined, traits: import('../../engine/statEntry').TraitList | undefined, name: string): 'rig' | 'creature' {
  return resolveRender(species, traits, name).kind === 'plan' ? 'creature' : 'rig';
}


// Les défauts d'apparence (tenue / monster / sex / parts / colors / scale) d'un bipède viennent
// désormais de sa RACE (canonique, partagée — cf. `raceById(baseSpeciesOf(species))`), surchargés
// par les éventuelles surcharges propres à la créature (`def.perso`, pour les espèces
// non-canoniques repliées sur une race partagée : Fimir/Géant/Liche/Démonette).

/** Apparence rig dérivée (espèce/sexe/carrure du nom+seed) + parts monstrueux.
 *  Source UNIQUE pour combat (spawn) et exploration (entité) → modèles identiques. */
export interface RiggedOpts {
  monster?: MonsterParts;
  species?: string;
  colors?: import('./palette').Palette;
  parts?: Appearance['parts']; // coiffure/visage épinglés (idx)
  sex?: 'M' | 'F'; // surcharge le sexe dérivé du seed
  build?: number; // surcharge la carrure dérivée du seed
  gabarit?: string; // carrure imposée (def créature : Rat ogre → brute-bras-longs)
  /** yeux personnalisés (CLÉS du catalogue EYE_OPTIONS, donnée éditeur) → art résolu ici. */
  eyes?: { G?: string; D?: string };
  features?: string[]; // traits ADDITIFS (clés du catalogue d'éléments)
}
const eyeArt = (k?: string): string | undefined => (k ? EYE_OPTIONS[k]?.art : undefined);
export function riggedAppearance(name: string, seed: number, opts: RiggedOpts = {}): Appearance {
  const sex: 'M' | 'F' = opts.sex ?? (seed % 7 < 2 ? 'F' : 'M');
  const build = opts.build ?? buildFromSeed(seed);
  const eyes = opts.eyes && (eyeArt(opts.eyes.G) || eyeArt(opts.eyes.D))
    ? { ...(eyeArt(opts.eyes.G) ? { G: eyeArt(opts.eyes.G) } : {}), ...(eyeArt(opts.eyes.D) ? { D: eyeArt(opts.eyes.D) } : {}) }
    : undefined;
  return { species: opts.species ?? 'Humain', sex, build, seed, monster: opts.monster, features: opts.features, colors: opts.colors, parts: opts.parts, gabarit: opts.gabarit, eyes };
}

/** Synthèse d'items d'armure depuis les PA par localisation (matériau via palier). */
function synthArmour(ap: ArmourPoints): ItemInstance[] {
  const items: ItemInstance[] = [];
  const piece = (uid: string, name: string, pa: number, locs: HitLocation[]) => {
    items.push({ uid, name, kind: 'armor', qualities: [], pa, locs, enc: 0, equipped: true });
  };
  if (ap.corps > 0) piece('syn-corps', 'Protection (corps)', ap.corps, ['corps']);
  if (ap.tete > 0) piece('syn-tete', 'Protection (tête)', ap.tete, ['tete']);
  const bras = Math.max(ap.brasG, ap.brasD);
  if (bras > 0) piece('syn-bras', 'Protection (bras)', bras, ['brasG', 'brasD']);
  const jambes = Math.max(ap.jambeG, ap.jambeD);
  if (jambes > 0) piece('syn-jambes', 'Protection (jambes)', jambes, ['jambeG', 'jambeD']);
  return items;
}

/** Résolution PARTAGÉE (combat ET exploration, IDENTIQUE) : espèce → def bipède canonique + race
 *  (défauts d'apparence partagés) + perso (surcharges d'espèce non-canonique). `override` = espèce
 *  explicite (combat : `c.species` ; exploration : `opts.species`), repli record créature puis nom-EXACT. */
function bipedBase(override: string | undefined, name: string, cd: EntityAppearance | undefined) {
  const species = override ?? cd?.species ?? (defByName(name) ? name : 'Humain');
  const d = bipedDef(species);
  return { species, d, race: raceById(d?.race ?? baseSpeciesOf(species)), perso: d?.perso };
}

/** Tenue PARTAGÉE : surcharge (carrière / opts) → record créature → perso/race → Nu (l'auteur l'habille). */
function bipedTenue(override: string | undefined, cd: EntityAppearance | undefined, perso: { tenue?: string } | undefined, race: { tenue?: string }): string {
  return override ?? cd?.tenue ?? perso?.tenue ?? race.tenue ?? 'Nu';
}

/** Carrure par défaut dérivée du seed (0.35..0.75) — formule UNIQUE. */
const buildFromSeed = (seed: number): number => +(0.35 + ((Math.floor(seed / 7) % 41) / 100)).toFixed(2);

/**
 * CONSTRUCTEUR UNIQUE de l'apparence rig — combat ET exploration. Une seule précédence par champ :
 * override d'instance → record créature (`cd`) → perso/race → défaut-seed. `override` porte ses YEUX
 * DÉJÀ en art (combat : `c.appearance` résolu au spawn ; exploration : `opts` pré-résolus par l'appelant).
 * Avant : deux implémentations (overlay-layering vs `riggedAppearance`) de cette MÊME précédence (dérive).
 */
function rigAppearance(seed: number, base: ReturnType<typeof bipedBase>, cd: EntityAppearance | undefined, override?: Partial<Appearance>): Appearance {
  const { species, d, race, perso } = base;
  const o = override ?? {};
  return {
    species: o.species ?? species,
    sex: o.sex ?? cd?.sex ?? perso?.sex ?? race.sex ?? (seed % 7 < 2 ? 'F' : 'M'),
    build: o.build ?? cd?.build ?? buildFromSeed(seed),
    seed: o.seed ?? cd?.seed ?? seed,
    monster: o.monster ?? cd?.monster ?? perso?.monster,
    features: o.features ?? cd?.features,
    colors: o.colors ?? cd?.colors ?? perso?.colors ?? race.colors,
    parts: o.parts ?? cd?.parts ?? perso?.parts ?? race.parts,
    gabarit: o.gabarit ?? perso?.gabarit ?? d?.gabarit,
    eyes: o.eyes ?? eyesArtFromKeys(cd?.eyes) ?? eyesArtFromKeys(perso?.eyes),
  };
}

/**
 * Profil rig d'un combattant, ou null si non-humanoïde (→ rendu par son gabarit corporel
 * via AnimatedPlanToken, plus aucun sprite monolithique). PURE et déterministe (seed dérivé de l'id).
 */
export function enemyRigProfile(c: Combatant): EnemyRigProfile | null {
  if (classifyBy(c.species, c.traits, c.creatureId ?? c.name) === 'creature') return null; // espèce explicite (data) → repli id/nom

  const seed = hashSeed(c.id);
  const cd = findCreatureById(c.creatureId)?.appearance; // apparence par défaut UNIFIÉE du record créature (par id)
  const bb = bipedBase(c.species, c.name, cd); // résolution PARTAGÉE espèce→def/race/perso
  // Apparence : SOURCE UNIQUE `rigAppearance`. `c.appearance` (override d'instance) est déjà résolu au spawn.
  const appearance = rigAppearance(seed, bb, cd, c.appearance);
  // Tenue DATA-DRIVEN : carrière du Combatant → record → défaut de la def (perso/race) → Nu (l'auteur l'habille).
  const tenue = bipedTenue(c.career, cd, bb.perso, bb.race);

  // Équipement : l'inventaire du combattant prime ; sinon armure synthétisée des PA.
  const base = equipFromCombatant(c);
  const armour = base.armour.length ? base.armour : synthArmour(c.armour);
  const equip: EquipCtx = { weapons: base.weapons, armour, shield: base.shield };

  // Calques de mutation = donnée (`combatantOverlays(c.mutations)`, appliqués par AnimatedRigToken),
  // jamais le nom : un mutant déclare son tell via un trait « Mutation (X) » → c.mutations au spawn.
  return { appearance, tenue, equip };
}

/**
 * Profil rig pour une ENTITÉ de scène humanoïde (hors combat) : pas d'équipement de
 * combat (mains libres, pour les poses d'ambiance), apparence dérivée du nom + seed.
 * null si le nom désigne une créature non-humanoïde.
 */
export function entityRigProfile(
  name: string,
  seed: number,
  opts?: { species?: string; tenue?: string; monster?: MonsterParts; features?: string[]; weapon?: string; colors?: import('./palette').Palette; parts?: Appearance['parts']; sex?: 'M' | 'F'; build?: number; eyes?: { G?: string; D?: string };
    /** Profil de combat de l'entité (statbloc d'éditeur) → équipement affiché en explo, comme au combat. */
    traits?: TraitList; armour?: number;
    /** L'entité est ENRÔLÉE dans une rencontre (membre d'un `EncounterDef`) → c'est un combattant : on
     *  affiche son équipement par défaut DÉRIVÉ du record (parité avec le spawn `creatureToCombatant`),
     *  même sans statbloc. Une entité d'AMBIANCE (non enrôlée, défaut `false`) reste mains libres, quitte
     *  à ce que son record porte un trait « Arme » (un villageois ne dégaine pas pour décorer la scène). */
    enrolled?: boolean },
): EnemyRigProfile | null {
  const rec = findCreatureById(name);
  if (classifyBy(opts?.species ?? rec?.appearance?.species, rec?.traits, name) === 'creature') return null; // espèce explicite (data) → repli id/nom
  const cd = rec?.appearance; // apparence par défaut UNIFIÉE du record créature
  const base = bipedBase(opts?.species, name, cd); // résolution PARTAGÉE espèce→def/race/perso
  // Override d'AUTHORING → `Partial<Appearance>` (yeux clés→art) passé au CONSTRUCTEUR UNIQUE `rigAppearance`.
  // Une entité d'ambiance « mutée » déclare ses parts/overlays dans son apparence (monster), pas via le nom.
  const override: Partial<Appearance> = {
    species: opts?.species, sex: opts?.sex, build: opts?.build, monster: opts?.monster,
    features: opts?.features, colors: opts?.colors, parts: opts?.parts, eyes: eyesArtFromKeys(opts?.eyes),
  };
  // Équipement : MÊME dérivation qu'au combat (parité explo↔combat). Précédence des traits de combat :
  //   statbloc d'éditeur (`opts.traits`) → record créature SI ENRÔLÉE (`rec.traits`) → mains libres.
  // Le repli sur `rec.traits` est RÉSERVÉ aux entités enrôlées (combattantes) — c'est exactement la
  // dérivation du spawn `creatureToCombatant` (ref sans statbloc). Une entité d'AMBIANCE (non enrôlée)
  // reste mains libres même si son record porte un trait « Arme ». Armes EXPLICITES seulement
  // (`renderWeaponsFromTraits` — pas de repli « Arme » générique qui serait dessiné en épée).
  const traits = opts?.traits ?? (opts?.enrolled ? rec?.traits ?? [] : []);
  const labelWeapon = opts?.weapon ? [weaponFromLabel(opts.weapon)] : [];
  const armourPA: ArmourPoints = opts?.armour != null ? emptyArmour(opts.armour) : armourFromTraits(traits);
  return {
    appearance: rigAppearance(seed, base, cd, override),
    tenue: bipedTenue(opts?.tenue, cd, base.perso, base.race),
    equip: { weapons: [...labelWeapon, ...renderWeaponsFromTraits(traits)], armour: synthArmour(armourPA) },
  };
}
