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
import { quadSpeciesMatch } from './quadruped/quadSkeleton';
import { wingSpeciesMatch } from './winged/composeWing';

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

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

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
    // morts-vivants NON humanoïdes
    'spectre', 'fantome', 'banshee', 'varghulf', 'liche', 'necarque',
    // démons / Chaos « bête »
    'demonette', 'slaanesh', 'nurgle', 'tzeentch',
    'mournbreath', 'whiptongue', 'slenderthigh', 'jabberslythe',
    // bêtes exotiques sans gabarit
    'serpent', 'araignee', 'basilic', 'hydre', 'manticore',
    'pieuvre', 'fimir', 'geant', 'pigeon',
    'chauve.?souris', 'sangsue', 'crapaud',
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

/** Espèce de rig détectée du nom (sinon Humain). L'ORDRE compte : les pièges de sous-chaîne
 *  (« rat ogre » → Skaven avant ogre ; « goule » avant les bêtes) sont gérés en plaçant le
 *  cas spécifique d'abord. */
function detectSpecies(n: string): string {
  if (/\bnain/.test(n)) return 'Nain';
  if (/\bhalfling/.test(n)) return 'Halfling';
  if (/haut.?elfe/.test(n)) return 'Haut-Elfe';
  if (/elfe sylvain|elfe des bois/.test(n)) return 'Elfe sylvain';
  if (/\belfe/.test(n)) return 'Haut-Elfe';
  if (/\bgnome/.test(n)) return 'Gnome';
  if (/skaven|homme.?rat|\brat\b|vermine|guerrier des clans|rat ogre/.test(n)) return 'Skaven'; // AVANT ogre (« rat ogre »)
  // Morts-vivants humanoïdes
  if (/squelette/.test(n)) return 'Squelette';
  if (/goule|ghoul/.test(n)) return 'Goule'; // AVANT zombie/bêtes
  if (/zombie/.test(n)) return 'Zombie';
  if (/vampire|comte sanguin|comtesse sanguine/.test(n)) return 'Vampire';
  // Hommes-bêtes
  if (/minotaure/.test(n)) return 'Minotaure'; // AVANT homme-bête générique (tête de taureau)
  if (/\bgor\b|ungor|bestigor|homme.?bete|beastman|brey|chamane.?brey/.test(n)) return 'Homme-bête';
  // Peaux-vertes
  if (/snotling/.test(n)) return 'Snotling'; // AVANT gobelin (« petit gobelin »)
  if (/gobelin|gobbo|gobbe/.test(n)) return 'Gobelin';
  if (/\borc\b|\borque\b|peau.?verte/.test(n)) return 'Orc';
  // Gros / démons
  if (/sanguinaire|khorne/.test(n)) return 'Démon';
  if (/\btroll/.test(n)) return 'Troll';
  if (/\bogre/.test(n)) return 'Ogre';
  return 'Humain';
}

/** Tenue par défaut d'une ESPÈCE monstrueuse, quand le nom ne désigne pas un rôle précis.
 *  Les morts-vivants nus / trolls / snotlings portent des hardes (Mendiant) ; le vampire une
 *  robe (Noble). Les peaux-vertes et hommes-bêtes gardent l'armure de soldat. */
const SPECIES_CAREER: Record<string, string> = {
  Skaven: 'Skaven', // tenue dédiée : pelage + lamelles de récup (bras velus → poing raccordé)
  Vampire: 'Vampire', // tenue dédiée : manteau sombre à col haut (réutilisable pour tout humanoïde)
  Zombie: 'Mendiant', // hardes en lambeaux
  Orc: 'Mendiant', Gobelin: 'Mendiant', // hardes/cuir brun (la tenue Soldat a un tabard rouge hardcodé non recolorable)
  // Pelage couvrant tout le corps / mort-vivant nu / monstre sans habit → corps de chair.
  'Homme-bête': 'Nu', Minotaure: 'Nu',
  Squelette: 'Squelette', // tenue dédiée : ossature (cage thoracique + os des membres)
  Goule: 'Nu', Troll: 'Nu', Snotling: 'Nu', Ogre: 'Nu', Démon: 'Nu',
};

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

/** Parts monstrueuses AUTO par espèce (Phase B) : une espèce monstrueuse implique sa tête/
 *  queue sans config manuelle (un « Guerrier des clans » est rendu homme-rat d'office). */
const SPECIES_AUTO_MONSTER: Record<string, MonsterParts> = {
  Skaven: { tete: 'rat', queue: true },
  // Peaux-vertes (oreilles/défenses dans la tête ; pas de queue sauf snotling).
  Orc: { tete: 'orc' },
  Gobelin: { tete: 'gobelin' },
  Snotling: { tete: 'gobelin', queue: true },
  // Hommes-bêtes : cornes + jambes de chèvre + queue.
  'Homme-bête': { tete: 'caprin', cornes: true, jambes: 'chevre', queue: true },
  Minotaure: { tete: 'taureau', cornes: true, jambes: 'chevre', queue: true },
  // Morts-vivants.
  Squelette: { tete: 'crane' }, // côtes fournies par la tenue dédiée (cage thoracique)
  Zombie: { tete: 'pourri', plaie: true },
  Goule: { tete: 'goule', griffes: true }, // humanoïde décharné à gueule de crocs (PAS un chien) + griffes
  // Gros / démons (Vampire = humain pâle → pas de tête monstrueuse : visage humain + col de
  // cape + crocs, géré par overlays/palette).
  Troll: { tete: 'troll', verrues: true }, // peau verruqueuse + ventre pâle (anti-blob)
  Ogre: { tete: 'ogre', ventre: true },
  Vampire: { cape: true },
  Démon: { tete: 'demon', cornes: true, membresRouges: true },
};

/** Coiffure/visage épinglés par espèce (sinon le tirage de seed donne une coiffure aléatoire
 *  peu adaptée). Le vampire = cheveux lissés en arrière (idx 1), visage soigné. */
const SPECIES_PARTS: Record<string, Appearance['parts']> = {
  Vampire: { cheveux: 1, visage: 0 },
};
/** Sexe forcé par espèce (aristocrate vampire = masculin par défaut). */
const SPECIES_SEX: Record<string, 'M' | 'F'> = { Vampire: 'M' };

/** Surcharges de couleur par espèce (sur la tenue) — les peaux-vertes et hommes-bêtes portent
 *  du cuir/bois brun, pas l'écarlate impérial de la tenue Soldat (vet2 rouge → cuir brun). */
const SPECIES_COLORS: Record<string, import('./palette').Palette> = {
  Orc: { vet1: '#5a4a30', vet2: '#3a2a1c', cuir: '#5a3f24' }, // hardes cuir/toile brunes
  Gobelin: { vet1: '#3a5a28', vet2: '#5a3f24', cuir: '#4a3320' }, // hardes vert-brun
  // Vampire : robe d'aristocrate NOIRE à parements cramoisis (pas l'écarlate d'officier qui le
  // faisait lire « noble humain ») → silhouette de comte vampire avec le col de cape dressé.
  Vampire: { vet1: '#241018', vet2: '#6a0e18', cuir: '#1a0e12', metal: '#8a8f9e' },
};

/**
 * Profil rig d'un combattant, ou null si non-humanoïde (→ garder enemySprite).
 * PURE et déterministe (seed dérivé de l'id).
 */
export function enemyRigProfile(c: Combatant): EnemyRigProfile | null {
  if (classifyEnemy(c.name) === 'creature') return null;
  const n = norm(c.name);
  const seed = hashSeed(c.id);
  const species = c.species ?? detectSpecies(n);
  const sex: 'M' | 'F' = SPECIES_SEX[species] ?? (seed % 7 < 2 ? 'F' : 'M'); // ~28 % F sinon
  const build = +(0.35 + ((Math.floor(seed / 7) % 41) / 100)).toFixed(2); // 0.35..0.75
  const autoMon = SPECIES_AUTO_MONSTER[species];
  const baseApp: Appearance = c.appearance ?? { species, sex, build, seed, parts: SPECIES_PARTS[species], colors: SPECIES_COLORS[species] };
  const appearance: Appearance = autoMon && !baseApp.monster ? { ...baseApp, monster: autoMon } : baseApp;
  // Un mutant HUMAIN (parts greffés sur un Humain, ou nom « mutant ») porte des hardes
  // (Mendiant). Une ESPÈCE monstrueuse (Skaven…) garde sa carrière/tenue (guerrier→Soldat).
  const isMutant = /mutant|chaos|corrompu|difforme|abomination/.test(n);
  const hasMonster = !!(appearance.monster && Object.keys(appearance.monster).length);
  const isHumanMutant = isMutant || (hasMonster && species === 'Humain');
  const career = c.career ?? (isHumanMutant ? 'Mendiant' : (SPECIES_CAREER[species] ?? detectCareer(n)));

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
  const monster = opts?.monster ?? SPECIES_AUTO_MONSTER[species]; // auto skaven/… si non précisé
  const appearance: Appearance = riggedAppearance(name, seed, {
    monster, colors: opts?.colors ?? SPECIES_COLORS[species],
    parts: opts?.parts ?? SPECIES_PARTS[species],
    sex: opts?.sex ?? SPECIES_SEX[species], build: opts?.build,
  });
  // Calques de mutation aléatoires SEULEMENT si aucun part monstrueux explicite
  // n'est choisi (sinon on respecte le « mutant construit » à la main).
  const hasMonster = !!(monster && Object.keys(monster).length);
  const isMutant = /mutant|chaos|corrompu|difforme|abomination/.test(n);
  return {
    appearance,
    career: opts?.career ?? SPECIES_CAREER[species] ?? detectCareer(n),
    equip: { weapons: opts?.weapon ? [weaponFromLabel(opts.weapon)] : [], armour: [] },
    overlays: isMutant && !hasMonster ? mutationOverlays(seed) : undefined,
  };
}
