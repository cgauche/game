/**
 * Profil de rendu RIG d'un combattant ennemi/PNJ humanoïde — COSMÉTIQUE (l'engine
 * n'en dépend jamais). Transforme un Combatant en (apparence, carrière, équipement,
 * calques de mutation) pour le rendre via le rig au lieu du sprite monolithique.
 *
 * Décisions : voir docs/superpowers/specs/2026-06-05-F1-ennemis-rig-design.md
 */
import type { Combatant, ItemInstance, ArmourPoints, HitLocation } from '../../engine/types';
import type { Appearance } from './appearance';
import type { EquipCtx } from './parts/equipment';
import type { RigOverlay } from './bones';
import { equipFromCombatant } from './parts/equipment';
import { weaponGroupKey } from './parts/weaponGroup';
import { randomMutationOverlays } from './parts/mutations';
import { EYE_OPTIONS, eyesArtFromKeys } from './parts/eyes';
import type { MonsterParts } from './parts/monstrous';
import { hashSeed } from '../appearance';
import { norm } from '../../lib/normalize';
import { bipedDef, bipedSpeciesMatch, creaturePlanMatch } from './creatures';
import { findCreature } from '../../data';
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
  career: string;
  equip: EquipCtx;
  overlays?: RigOverlay[];
}

/**
 * Indices de NON-rig : noms qui ressemblent à des humanoïdes mais qui ont une
 * peau/tête non-humaine (peaux-vertes, skavens, hommes-bêtes, morts-vivants), ou
 * de vraies bêtes/démons. Couvre les 57 entrées du bestiaire + mots-clés généraux.
 * Un rig à tête humaine serait pire que leur sprite dédié → ils restent en sprite
 * (et héritent du facing 8-dir via F2).
 */
// Bornes de mot (\b…\b) pour éviter les faux positifs de sous-chaîne (ex. « orc »
// dans « sorcier », « gor » dans « rigori- »). Couvre les 57 entrées du bestiaire
// non-humanoïdes + synonymes courants.
/**
 * Patterns de rôles humanoïdes à peau humaine, mappés vers une carrière (pour la
 * tenue). Ordre = priorité. Le 1er match gagne pour la carrière.
 */
/** Classifieur cosmétique : 'rig' (humanoïde → rig bipède) ou 'creature' (non-humanoïde →
 *  gabarit quad/ailé/serpentin/… ou sprite monolithique). 100 % registry-driven : un def
 *  non-bipède (rigué OU monolithique) → 'creature' ; sinon humanoïde → 'rig'. */
export function classifyEnemy(name: string): 'rig' | 'creature' {
  return creaturePlanMatch(name) ? 'creature' : 'rig';
}

/** Espèce de rig détectée du nom (sinon Humain). Dérivé du registre : chaque espèce bipède
 *  porte sa regex `match` + `matchPriority` dans son fichier defs/ (l'ordre de priorité
 *  désambiguïse « rat ogre » → Skaven avant Ogre, etc.). Plus d'if-chain centrale. */
function detectSpecies(n: string): string {
  return bipedSpeciesMatch(n) ?? 'Humain';
}

// Les défauts d'apparence (career / monster / sex / parts / colors / scale) d'un bipède viennent
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
}
const eyeArt = (k?: string): string | undefined => (k ? EYE_OPTIONS[k]?.art : undefined);
export function riggedAppearance(name: string, seed: number, opts: RiggedOpts = {}): Appearance {
  const n = norm(name);
  const sex: 'M' | 'F' = opts.sex ?? (seed % 7 < 2 ? 'F' : 'M');
  const build = opts.build ?? +(0.35 + ((Math.floor(seed / 7) % 41) / 100)).toFixed(2);
  const eyes = opts.eyes && (eyeArt(opts.eyes.G) || eyeArt(opts.eyes.D))
    ? { ...(eyeArt(opts.eyes.G) ? { G: eyeArt(opts.eyes.G) } : {}), ...(eyeArt(opts.eyes.D) ? { D: eyeArt(opts.eyes.D) } : {}) }
    : undefined;
  return { species: opts.species ?? detectSpecies(n), sex, build, seed, monster: opts.monster, colors: opts.colors, parts: opts.parts, gabarit: opts.gabarit, eyes };
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
function overlayDefined(base: Appearance, over: Appearance): Appearance {
  const out: Appearance = { ...base };
  for (const k of Object.keys(over) as (keyof Appearance)[]) {
    if (over[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = over[k];
  }
  return out;
}

/**
 * Profil rig d'un combattant, ou null si non-humanoïde (→ rendu par son gabarit corporel
 * via AnimatedPlanToken, plus aucun sprite monolithique). PURE et déterministe (seed dérivé de l'id).
 */
export function enemyRigProfile(c: Combatant): EnemyRigProfile | null {
  if (classifyEnemy(c.name) === 'creature') return null;
  const n = norm(c.name);
  const seed = hashSeed(c.id);
  const species = c.species ?? detectSpecies(n);
  const d = bipedDef(species); // def bipède canonique (porte le perso éventuel + override race/gabarit)
  const race = raceById(d?.race ?? baseSpeciesOf(species)); // défauts d'apparence partagés (canon)
  const perso = d?.perso; // surcharges propres à la créature (espèces non-canoniques)
  const sex: 'M' | 'F' = perso?.sex ?? race.sex ?? (seed % 7 < 2 ? 'F' : 'M'); // ~28 % F sinon
  const build = +(0.35 + ((Math.floor(seed / 7) % 41) / 100)).toFixed(2); // 0.35..0.75
  const autoMon = perso?.monster;
  // Défauts de race/seed PUIS superposition de l'override d'auteur (champs définis seulement) :
  // un override partiel (ex. seed re-tiré, sexe forcé) conserve coiffure/couleurs/gabarit canoniques.
  const def: Appearance = { species, sex, build, seed, parts: perso?.parts ?? race.parts, colors: perso?.colors ?? race.colors, gabarit: perso?.gabarit ?? d?.gabarit, eyes: eyesArtFromKeys(perso?.eyes) };
  const baseApp: Appearance = c.appearance ? overlayDefined(def, c.appearance) : def;
  const appearance: Appearance = autoMon && !baseApp.monster ? { ...baseApp, monster: autoMon } : baseApp;
  const isMutant = /mutant|chaos spawn|mutant.?du.?chaos|corrompu|difforme|abomination/.test(n);
  const hasMonster = !!(appearance.monster && Object.keys(appearance.monster).length);
  // Tenue DATA-DRIVEN : explicite sur le Combatant → fiche bestiaire (`findCreature(name).career`) →
  // défaut de la def (perso/race, pour les espèces hors bestiaire) → Soldat. Plus de name-match
  // `ROLE_CAREERS` ni d'exception mutant→Mendiant en dur (POC retirés) : un mutant qui doit porter des
  // hardes le déclare dans SA donnée (career), pas via une règle codée.
  const career = c.career ?? findCreature(c.name)?.career ?? perso?.career ?? race.career ?? 'Soldat';

  // Équipement : l'inventaire du combattant prime ; sinon armure synthétisée des PA.
  const base = equipFromCombatant(c);
  const armour = base.armour.length ? base.armour : synthArmour(c.armour);
  const equip: EquipCtx = { weapons: base.weapons, armour, shield: base.shield };

  // Calques de mutation aléatoires SEULEMENT si pas de parts monstrueux explicites.
  const overlays = isMutant && !hasMonster ? randomMutationOverlays(seed) : undefined;

  return { appearance, career, equip, overlays };
}

/**
 * Profil rig pour une ENTITÉ de scène humanoïde (hors combat) : pas d'équipement de
 * combat (mains libres, pour les poses d'ambiance), apparence dérivée du nom + seed.
 * null si le nom désigne une créature non-humanoïde.
 */
export function entityRigProfile(
  name: string,
  seed: number,
  opts?: { species?: string; career?: string; monster?: MonsterParts; weapon?: string; colors?: import('./palette').Palette; parts?: Appearance['parts']; sex?: 'M' | 'F'; build?: number; eyes?: { G?: string; D?: string } },
): EnemyRigProfile | null {
  if (classifyEnemy(name) === 'creature') return null;
  const n = norm(name);
  const species = opts?.species ?? detectSpecies(n); // override d'auteur (Nain/Halfling…) sinon déduit du nom
  const d = bipedDef(species);
  const race = raceById(d?.race ?? baseSpeciesOf(species)); // défauts d'apparence partagés (canon)
  const perso = d?.perso; // surcharges propres à la créature (espèces non-canoniques)
  const monster = opts?.monster ?? perso?.monster; // auto skaven/… si non précisé
  const appearance: Appearance = riggedAppearance(name, seed, {
    species, monster, colors: opts?.colors ?? perso?.colors ?? race.colors,
    parts: opts?.parts ?? perso?.parts ?? race.parts,
    sex: opts?.sex ?? perso?.sex ?? race.sex, build: opts?.build, eyes: opts?.eyes ?? perso?.eyes,
    gabarit: perso?.gabarit ?? d?.gabarit,
  });
  // Calques de mutation aléatoires SEULEMENT si aucun part monstrueux explicite
  // n'est choisi (sinon on respecte le « mutant construit » à la main).
  const hasMonster = !!(monster && Object.keys(monster).length);
  // NOTE : « chaos » seul exclu — « guerrier/élu/champion/chevalier du chaos » ont leur race dédiée.
  const isMutant = /mutant|chaos spawn|mutant.?du.?chaos|corrompu|difforme|abomination/.test(n);
  return {
    appearance,
    career: opts?.career ?? findCreature(name)?.career ?? perso?.career ?? race.career ?? 'Soldat',
    equip: { weapons: opts?.weapon ? [weaponFromLabel(opts.weapon)] : [], armour: [] },
    overlays: isMutant && !hasMonster ? randomMutationOverlays(seed) : undefined,
  };
}
