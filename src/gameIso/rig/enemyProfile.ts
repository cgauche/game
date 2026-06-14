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
import { weaponGroupKey } from './parts/weaponGroup';
import { EYE_OPTIONS, eyesArtFromKeys } from './parts/eyes';
import type { MonsterParts } from './parts/monstrous';
import { hashSeed } from '../appearance';
import { norm } from '../../lib/normalize';
import { bipedDef, bipedSpeciesMatch } from './creatures';
import { resolveRender } from './bodyPlan';
import { findCreature } from '../../data';
import type { EntityAppearance } from '../../state/scene';
import { raceById } from './races';
import { baseSpeciesOf } from './skeletons';

const RANGED_GROUPS = new Set(['arc', 'arbalete', 'poudre', 'fronde', 'lancer', 'entraves', 'explosifs', 'ingenierie']);
/** Construit une arme minimale depuis un libellé (type déduit du Groupe canonique). */
export function weaponFromLabel(label: string): import('../../engine/types').Weapon {
  const w = { name: label, type: 'melee' as 'melee' | 'ranged', damage: '+0', qualities: [] };
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
export function classifyEnemy(name: string): 'rig' | 'creature' {
  return resolveRender(undefined, findCreature(name)?.traits, name).kind === 'plan' ? 'creature' : 'rig';
}

/** Classe de rendu DATA-DRIVEN (de-POC P5) — délègue au résolveur unique `resolveRender` : trait
 *  Nuée ou espèce CANONIQUE explicite (lookup exact) ; repli name-match si l'espèce est absente. */
export function classifyBy(species: string | undefined, traits: string[] | undefined, name: string): 'rig' | 'creature' {
  return resolveRender(species, traits, name).kind === 'plan' ? 'creature' : 'rig';
}

/** Espèce de rig détectée du nom (sinon Humain) : `bipedSpeciesMatch` route par name+aliases,
 *  triés par `matchPriority` (« rat ogre » → Skaven avant Ogre). Plus d'if-chain centrale. */
function detectSpecies(n: string): string {
  return bipedSpeciesMatch(n) ?? 'Humain';
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
  const n = norm(name);
  const sex: 'M' | 'F' = opts.sex ?? (seed % 7 < 2 ? 'F' : 'M');
  const build = opts.build ?? +(0.35 + ((Math.floor(seed / 7) % 41) / 100)).toFixed(2);
  const eyes = opts.eyes && (eyeArt(opts.eyes.G) || eyeArt(opts.eyes.D))
    ? { ...(eyeArt(opts.eyes.G) ? { G: eyeArt(opts.eyes.G) } : {}), ...(eyeArt(opts.eyes.D) ? { D: eyeArt(opts.eyes.D) } : {}) }
    : undefined;
  return { species: opts.species ?? detectSpecies(n), sex, build, seed, monster: opts.monster, features: opts.features, colors: opts.colors, parts: opts.parts, gabarit: opts.gabarit, eyes };
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

/** Superpose les champs DÉFINIS de `over` sur `base` (un undefined ne masque pas le défaut). */
function overlayDefined(base: Appearance, over: Partial<Appearance>): Appearance {
  const out: Appearance = { ...base };
  for (const k of Object.keys(over) as (keyof Appearance)[]) {
    if (over[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = over[k];
  }
  return out;
}

/** Apparence d'éditeur (EntityAppearance, record créature) → champs rig DÉFINIS seulement (yeux clés→art).
 *  Sert de couche de défaut superposable (overlayDefined) sans masquer les défauts de race non spécifiés. */
function rigFieldsFrom(a: EntityAppearance): Partial<Appearance> {
  const out: Partial<Appearance> = {};
  if (a.species) out.species = a.species;
  if (a.sex) out.sex = a.sex;
  if (a.build !== undefined) out.build = a.build;
  if (a.seed !== undefined) out.seed = a.seed;
  if (a.monster) out.monster = a.monster;
  if (a.features) out.features = a.features;
  if (a.colors) out.colors = a.colors;
  if (a.parts) out.parts = a.parts;
  if (a.eyes) out.eyes = eyesArtFromKeys(a.eyes);
  return out;
}

/**
 * Profil rig d'un combattant, ou null si non-humanoïde (→ rendu par son gabarit corporel
 * via AnimatedPlanToken, plus aucun sprite monolithique). PURE et déterministe (seed dérivé de l'id).
 */
export function enemyRigProfile(c: Combatant): EnemyRigProfile | null {
  if (classifyBy(c.species, c.traits, c.name) === 'creature') return null; // espèce explicite (data) → repli nom

  const n = norm(c.name);
  const seed = hashSeed(c.id);
  const cd = findCreature(c.name)?.appearance; // apparence par défaut UNIFIÉE du record créature
  const species = c.species ?? cd?.species ?? detectSpecies(n);
  const d = bipedDef(species); // def bipède canonique (porte le perso éventuel + override race/gabarit)
  const race = raceById(d?.race ?? baseSpeciesOf(species)); // défauts d'apparence partagés (canon)
  const perso = d?.perso; // surcharges propres à la créature (espèces non-canoniques)
  const sex: 'M' | 'F' = perso?.sex ?? race.sex ?? (seed % 7 < 2 ? 'F' : 'M'); // ~28 % F sinon
  const build = +(0.35 + ((Math.floor(seed / 7) % 41) / 100)).toFixed(2); // 0.35..0.75
  const autoMon = perso?.monster;
  // Empilement d'apparence : défauts de race/seed → apparence par DÉFAUT du record créature (éditeur)
  // → surcharge d'INSTANCE de scène (c.appearance). Chaque couche ne pose que ses champs définis.
  const def: Appearance = { species, sex, build, seed, parts: perso?.parts ?? race.parts, colors: perso?.colors ?? race.colors, gabarit: perso?.gabarit ?? d?.gabarit, eyes: eyesArtFromKeys(perso?.eyes) };
  const withCreature: Appearance = cd ? overlayDefined(def, rigFieldsFrom(cd)) : def;
  const baseApp: Appearance = c.appearance ? overlayDefined(withCreature, c.appearance) : withCreature;
  const appearance: Appearance = autoMon && !baseApp.monster ? { ...baseApp, monster: autoMon } : baseApp;
  // Tenue DATA-DRIVEN : carrière du Combatant (`c.career`) → record (`appearance.tenue`) → défaut de
  // la def (perso/race) → Nu (corps nu, l'auteur l'habille en donnée).
  const tenue = c.career ?? cd?.tenue ?? perso?.tenue ?? race.tenue ?? 'Nu';

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
  opts?: { species?: string; tenue?: string; monster?: MonsterParts; features?: string[]; weapon?: string; colors?: import('./palette').Palette; parts?: Appearance['parts']; sex?: 'M' | 'F'; build?: number; eyes?: { G?: string; D?: string } },
): EnemyRigProfile | null {
  const rec = findCreature(name);
  if (classifyBy(opts?.species ?? rec?.appearance?.species, rec?.traits, name) === 'creature') return null; // espèce explicite (data) → repli nom
  const n = norm(name);
  const cd = rec?.appearance; // apparence par défaut UNIFIÉE du record créature
  const species = opts?.species ?? cd?.species ?? detectSpecies(n); // override d'auteur sinon record sinon déduit du nom
  const d = bipedDef(species);
  const race = raceById(d?.race ?? baseSpeciesOf(species)); // défauts d'apparence partagés (canon)
  const perso = d?.perso; // surcharges propres à la créature (espèces non-canoniques)
  const monster = opts?.monster ?? cd?.monster ?? perso?.monster; // override scène → record → auto skaven/…
  const appearance: Appearance = riggedAppearance(name, seed, {
    species, monster, features: opts?.features ?? cd?.features,
    colors: opts?.colors ?? cd?.colors ?? perso?.colors ?? race.colors,
    parts: opts?.parts ?? cd?.parts ?? perso?.parts ?? race.parts,
    sex: opts?.sex ?? cd?.sex ?? perso?.sex ?? race.sex, build: opts?.build ?? cd?.build,
    eyes: opts?.eyes ?? cd?.eyes ?? perso?.eyes,
    gabarit: perso?.gabarit ?? d?.gabarit,
  });
  // Une entité d'ambiance « mutée » déclare ses parts/overlays dans son apparence (monster), pas via le nom.
  return {
    appearance,
    tenue: opts?.tenue ?? cd?.tenue ?? perso?.tenue ?? race.tenue ?? 'Nu',
    equip: { weapons: opts?.weapon ? [weaponFromLabel(opts.weapon)] : [], armour: [] },
  };
}
