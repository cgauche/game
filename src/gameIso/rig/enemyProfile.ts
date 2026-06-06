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
import type { MonsterParts } from './parts/monstrous';
import { hashSeed } from '../appearance';
import { norm } from '../../lib/normalize';
import { quadSpeciesMatch } from './quadruped/quadSkeleton';
import { wingSpeciesMatch } from './winged/composeWing';
import { bipedConfig, bipedSpeciesMatch } from './creatures';

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
// Exotiques restant en sprite MONOLITHIQUE (pas encore de gabarit rigué dédié). Les bêtes/
// ailés couverts par un gabarit (loup, dragon, griffon, hippogriffe, cheval…) ne sont PLUS
// listés ici : ils sont reconnus via quadSpeciesMatch/wingSpeciesMatch (source unique = tables).
const EXOTIC_RE = new RegExp(
  '\\b(' + [
    'squig',
    // morts-vivants NON humanoïdes (Liche=bipède squelettique, Varghulf=ailé → defs/)
    'spectre', 'fantome', 'banshee', 'necarque',
    // démons / Chaos « bête »
    'demonette', 'slaanesh', 'nurgle', 'tzeentch',
    'mournbreath', 'whiptongue', 'slenderthigh', 'jabberslythe',
    // bêtes exotiques sans gabarit qui colle (serpent/pieuvre/araignée… restent monolithiques ;
    // Manticore=ailée → defs/)
    'serpent', 'araignee', 'basilic', 'hydre',
    'pieuvre', 'fimir', 'geant', 'pigeon', 'bete des marais',
    'sangsue', 'crapaud',
  ].join('|') + ')\\b',
);

/**
 * Patterns de rôles humanoïdes à peau humaine, mappés vers une carrière (pour la
 * tenue). Ordre = priorité. Le 1er match gagne pour la carrière.
 */
const ROLE_CAREERS: [RegExp, string][] = [
  [/flagellant|zelote|zealot|penitent|fanatique flagell/, 'Flagellant'],
  [/repurgateur|chasseur de sorcier|witch ?hunter/, 'Répurgateur'],
  [/sorcier|magister|necromancien|hierophante|mage|enchanteur|invocateur/, 'Sorcier'],
  [/cultiste|sectateur|adepte|fanatique|illumine|hereux|heretique/, 'Sorcier'],
  [/pretre|prelat|moine|prieur|abbe|hierophante|sceur|soeur|nonne|clerc/, 'Nonne'],
  [/noble|courtisan|aristocrate|seigneur|baron|comte|dame|patricien|bourgeois/, 'Noble'],
  [/repurg/, 'Répurgateur'],
  [/voleur|coupe-jarret|coupe jarret|larron|cambrioleur|detrousseur|tire-laine/, 'Voleur'],
  [/bandit|brigand|pillard|racaille|spadassin|sbire|homme de main|deserteur|hors-la-loi|maraudeur|coupe-gorge/, 'Voleur'],
  [/soldat|garde|milicien|mercenaire|sergent|capitaine|garnison|reitre|hallebardier|piquier|arbaletrier|archer|homme d.?armes|guerrier/, 'Soldat'],
  [/batelier|marin|matelot|gabarier|passeur/, 'Batelier'],
  [/mendiant|gueux|paysan|rustre|vagabond|miserable|manant|villageois|habitant|quidam/, 'Mendiant'],
  [/mutant/, 'Mendiant'],
];

/** Classifieur cosmétique : 'rig' (humanoïde → rig bipède) ou 'creature' (non-humanoïde →
 *  gabarit quad/ailé ou sprite monolithique). Dérivé des tables d'espèces + liste exotique. */
export function classifyEnemy(name: string): 'rig' | 'creature' {
  if (quadSpeciesMatch(name) || wingSpeciesMatch(name)) return 'creature';
  return EXOTIC_RE.test(norm(name)) ? 'creature' : 'rig';
}

/** Espèce de rig détectée du nom (sinon Humain). Dérivé du registre : chaque espèce bipède
 *  porte sa regex `match` + `matchPriority` dans son fichier defs/ (l'ordre de priorité
 *  désambiguïse « rat ogre » → Skaven avant Ogre, etc.). Plus d'if-chain centrale. */
function detectSpecies(n: string): string {
  return bipedSpeciesMatch(n) ?? 'Humain';
}

// La config d'espèce bipède (career / monster / sex / parts / colors) vit désormais dans
// `creatures/defs/<Nom>.ts` (un fichier par espèce) et est lue via `bipedConfig(species)` —
// plus de tables SPECIES_* éparpillées ici.

/** Carrière (→ tenue) mappée du nom. */
function detectCareer(n: string): string {
  for (const [re, career] of ROLE_CAREERS) if (re.test(n)) return career;
  return 'Soldat';
}

/** Apparence rig dérivée (espèce/sexe/carrure du nom+seed) + parts monstrueux.
 *  Source UNIQUE pour combat (spawn) et exploration (entité) → modèles identiques. */
export interface RiggedOpts {
  monster?: MonsterParts;
  species?: string;
  colors?: import('./palette').Palette;
  parts?: Appearance['parts']; // coiffure/visage épinglés (idx)
  sex?: 'M' | 'F'; // surcharge le sexe dérivé du seed
  build?: number; // surcharge la carrure dérivée du seed
}
export function riggedAppearance(name: string, seed: number, opts: RiggedOpts = {}): Appearance {
  const n = norm(name);
  const sex: 'M' | 'F' = opts.sex ?? (seed % 7 < 2 ? 'F' : 'M');
  const build = opts.build ?? +(0.35 + ((Math.floor(seed / 7) % 41) / 100)).toFixed(2);
  return { species: opts.species ?? detectSpecies(n), sex, build, seed, monster: opts.monster, colors: opts.colors, parts: opts.parts };
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

// --- Calques de mutation (cosmétiques) ------------------------------------
const M_HORN = '<path d="M3 -3 q5 -9 2 -16 q-5 5 -5 16 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.6"/>';
const M_HORN2 = '<path d="M-3 -3 q-5 -9 -2 -16 q5 5 5 16 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.6"/>';
const M_CLAW = '<path d="M-3 1 l1 8 M0 1 l0 9 M3 1 l-1 8" stroke="#5a3a2a" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
const M_EYE = '<ellipse cx="0" cy="-8" rx="3" ry="2" fill="#e8e0c0"/><circle cx="0" cy="-8" r="1.1" fill="#5a0a0a"/>';
const M_TENTACLE = '<path d="M2 -2 q10 4 8 14 q-2 6 -6 4 q3 -6 -1 -10 q-3 -3 -1 -8z" fill="#7a8a5a" stroke="#3a4026" stroke-width="0.6"/>';

const MUTATIONS: RigOverlay[] = [
  { bone: 'tete', svg: M_HORN },
  { bone: 'tete', svg: M_HORN2 },
  { bone: 'mainD', svg: M_CLAW },
  { bone: 'torse', svg: M_EYE },
  { bone: 'epauleD', svg: M_TENTACLE },
];

/** 1 à 3 calques de mutation choisis de façon déterministe depuis le seed. */
function mutationOverlays(seed: number): RigOverlay[] {
  const count = 1 + (seed % 3); // 1..3
  const out: RigOverlay[] = [];
  for (let i = 0; i < count; i++) out.push(MUTATIONS[(seed + i * 5) % MUTATIONS.length]);
  // déduplique par (bone+svg)
  const seen = new Set<string>();
  return out.filter((o) => {
    const k = o.bone + o.svg;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Profil rig d'un combattant, ou null si non-humanoïde (→ garder enemySprite).
 * PURE et déterministe (seed dérivé de l'id).
 */
export function enemyRigProfile(c: Combatant): EnemyRigProfile | null {
  if (classifyEnemy(c.name) === 'creature') return null;
  const n = norm(c.name);
  const seed = hashSeed(c.id);
  const species = c.species ?? detectSpecies(n);
  const cfg = bipedConfig(species); // config d'espèce (career/monster/sex/parts/colors), dérivée du registre
  const sex: 'M' | 'F' = cfg?.sex ?? (seed % 7 < 2 ? 'F' : 'M'); // ~28 % F sinon
  const build = +(0.35 + ((Math.floor(seed / 7) % 41) / 100)).toFixed(2); // 0.35..0.75
  const autoMon = cfg?.monster;
  const baseApp: Appearance = c.appearance ?? { species, sex, build, seed, parts: cfg?.parts, colors: cfg?.colors };
  const appearance: Appearance = autoMon && !baseApp.monster ? { ...baseApp, monster: autoMon } : baseApp;
  // Un mutant HUMAIN (parts greffés sur un Humain, ou nom « mutant ») porte des hardes
  // (Mendiant). Une ESPÈCE monstrueuse (Skaven…) garde sa carrière/tenue (guerrier→Soldat).
  const isMutant = /mutant|chaos|corrompu|difforme|abomination/.test(n);
  const hasMonster = !!(appearance.monster && Object.keys(appearance.monster).length);
  const isHumanMutant = isMutant || (hasMonster && species === 'Humain');
  const career = c.career ?? (isHumanMutant ? 'Mendiant' : (cfg?.career ?? detectCareer(n)));

  // Équipement : l'inventaire du combattant prime ; sinon armure synthétisée des PA.
  const base = equipFromCombatant(c);
  const armour = base.armour.length ? base.armour : synthArmour(c.armour);
  const equip: EquipCtx = { weapons: base.weapons, armour, shield: base.shield };

  // Calques de mutation aléatoires SEULEMENT si pas de parts monstrueux explicites.
  const overlays = isMutant && !hasMonster ? mutationOverlays(seed) : undefined;

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
  opts?: { career?: string; monster?: MonsterParts; weapon?: string; colors?: import('./palette').Palette; parts?: Appearance['parts']; sex?: 'M' | 'F'; build?: number },
): EnemyRigProfile | null {
  if (classifyEnemy(name) === 'creature') return null;
  const n = norm(name);
  const species = detectSpecies(n);
  const cfg = bipedConfig(species);
  const monster = opts?.monster ?? cfg?.monster; // auto skaven/… si non précisé
  const appearance: Appearance = riggedAppearance(name, seed, {
    monster, colors: opts?.colors ?? cfg?.colors,
    parts: opts?.parts ?? cfg?.parts,
    sex: opts?.sex ?? cfg?.sex, build: opts?.build,
  });
  // Calques de mutation aléatoires SEULEMENT si aucun part monstrueux explicite
  // n'est choisi (sinon on respecte le « mutant construit » à la main).
  const hasMonster = !!(monster && Object.keys(monster).length);
  const isMutant = /mutant|chaos|corrompu|difforme|abomination/.test(n);
  return {
    appearance,
    career: opts?.career ?? cfg?.career ?? detectCareer(n),
    equip: { weapons: opts?.weapon ? [weaponFromLabel(opts.weapon)] : [], armour: [] },
    overlays: isMutant && !hasMonster ? mutationOverlays(seed) : undefined,
  };
}
