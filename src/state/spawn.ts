/**
 * Construction de Combattants depuis le bestiaire (réf.) ou un statblock
 * personnalisé d'une scène. Sert au combat tactique.
 */
import { Combatant, Characteristics, CHAR_KEYS, Weapon, ArmourPoints, BodyShape, SkillInstance, TalentInstance } from '../engine/types';
import { parseSkillRef, skillCharacteristic } from '../engine/character';
import { findCreature, CreatureData } from '../data';
import { CustomStatblock, EntityAppearance } from './scene';
import { emptyArmour } from '../engine/items';
import { maxWounds, bonus } from '../engine/characteristics';
import { parseSizeLabel, resizeBySteps, SIZE_ORDER, SizeCategory } from '../engine/size';
import { parsePsychTraits } from '../engine/psychology';
import { traitCharMods, traitMovementMod, traitBonusWoundsBE, isMindless, mutationsAtSpawn } from '../engine/traits/dispatch';
import { rollMutation } from '../data/mutations';
import { makeRNG } from '../engine/dice';
import { groupsFor } from '../engine/groups';
import { norm as normTrait } from '../lib/normalize';
import { riggedAppearance, weaponFromLabel } from '../gameIso/rig/enemyProfile';
import { hashSeed } from '../gameIso/appearance';
import { bodyPlanOf } from '../gameIso/rig/bodyPlan';

/**
 * Forme du corps (→ Tableau de Localisation, LDB p.312) dérivée du gabarit rigué de la créature.
 * Serpent & araignée ont des Localisations Alternatives ; quadrupède/ailé/oiseau réétiquettent le
 * tableau humanoïde (même mécanique). Les gabarits sans table canon (céphalopode/amorphe/squig/
 * spectral/jabberslythe) retombent sur `humanoide` (table par défaut, p.312 — pas d'invention).
 */
export function bodyShapeOf(name: string): BodyShape {
  switch (bodyPlanOf(name)) {
    case 'quadruped': return 'quadrupede';
    case 'avian':
    case 'winged': return 'oiseau'; // ailes = bras (p.312) ; mécaniquement identique au quadrupède
    case 'serpentine': return 'serpent';
    case 'arachnid': return 'araignee';
    default: return 'humanoide';
  }
}

function charsFrom(src: Partial<Record<string, number | null>>, fallback = 30): Characteristics {
  const chars = {} as Characteristics;
  for (const k of CHAR_KEYS) {
    const v = src[k];
    chars[k] = typeof v === 'number' ? v : fallback;
  }
  return chars;
}

/**
 * Attaques NATURELLES (FR) : pas d'arme tenue par le rig (la « part » du corps fait
 * foi — griffes, morsure, tentacule…). Le rendu n'affiche donc pas d'objet en main.
 */
const NATURAL_WEAPON = new Set([
  'morsure', 'griffes', 'griffe', 'poings', 'mains nues', 'tentacule', 'tentacules',
  'bec', 'dard', 'corne', 'cornes', 'queue', 'pietinement', 'crachat',
]);

/**
 * Parse UN trait d'arme WFRP4 (français) en arme jouable, ou null. Gère le TYPE
 * entre parenthèses (l'armement des monstres est dans les Traits) :
 *   « Arme +7 », « Arme (Épée) +7 », « Arme (Dague) +4 », « Arme (griffes) »,
 *   « À distance (Arbalète) +9 (60) », « À distance +8 (50) », « Morsure +9 ».
 * Le `name` = le TYPE quand il est manufacturé (→ le rig tient cette arme) ; sinon
 * une étiquette naturelle (→ weaponFamily renvoie '' = aucune arme dessinée).
 */
export function weaponFromTrait(t: string): Weapon | null {
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^À distance(?:\s*\(([^)]+)\))?\s*\+(\d+)(?:\s*\((\d+)\))?/i))) {
    const type = m[1]?.trim();
    const w: Weapon = { name: type && !NATURAL_WEAPON.has(normTrait(type)) ? type : 'Attaque à distance', type: 'ranged', damage: `+${m[2]}`, qualities: [] };
    if (m[3]) w.range = Number(m[3]);
    return w;
  }
  if ((m = t.match(/^Arme(?:\s*\(([^)]+)\))?\s*(?:\+(\d+))?/i))) {
    const type = m[1]?.trim();
    const damage = m[2] ? `+${m[2]}` : '+BF';
    if (type && NATURAL_WEAPON.has(normTrait(type))) return { name: type, type: 'melee', damage, qualities: [] };
    return { name: type ?? 'Arme', type: 'melee', damage, qualities: [] };
  }
  // Compte EN TÊTE toléré (« 8 Tentacules +9 » — « # Tentacules », LDB 85 l.354) : l'arme reste UNE
  // (l'Action d'attaque) ; la multiplicité joue sur les Attaques GRATUITES (aiCreatureFreeAttacks).
  if ((m = t.match(/^(?:\d+\s+)?(Morsure|Griffes?|Tentacules?|Bec|Dard|Cornes?|Queue|Pi[ée]tinement|Crachat)\s*\+?(\d+)?/i))) {
    const ranged = /crachat/i.test(m[1]);
    return { name: m[1], type: ranged ? 'ranged' : 'melee', damage: m[2] ? `+${m[2]}` : '+BF', qualities: [] };
  }
  return null;
}

/** Parse les traits d'arme d'une créature en armes jouables (mêlée + distance). */
function weaponsFromTraits(traits: string[]): Weapon[] {
  const weapons: Weapon[] = [];
  for (const t of traits) {
    const w = weaponFromTrait(t);
    if (w) weapons.push(w);
  }
  if (weapons.length === 0) weapons.push({ name: 'Arme', type: 'melee', damage: '+BF', qualities: [] });
  return weapons;
}

function armourFromTraits(traits: string[]): ArmourPoints {
  for (const t of traits) {
    const m = t.match(/^Armure\s*\(?\+?(\d+)\)?/i);
    if (m) return emptyArmour(Number(m[1]));
  }
  return emptyArmour(0);
}

/** Catégorie de Taille depuis le trait « Taille (X) » (LDB 85), ou null si absent.
 *  Une plage (« Taille (de Petite à Énorme) ») est résolue à sa borne haute par `parseSizeLabel`. */
export function sizeFromTraits(traits: string[]): SizeCategory | null {
  for (const t of traits) {
    const m = t.match(/^Taille\s*\(([^)]+)\)/i);
    if (m) {
      const cat = parseSizeLabel(m[1]);
      if (cat) return cat;
    }
  }
  return null;
}

/** Catégorie de Taille d'une entité de scène (créature posée) : champ explicite du statbloc, sinon
 *  dérivée des Traits (statbloc ou créature du bestiaire via `ref`). `undefined` ⇒ Moyenne au rendu. */
export function entitySize(ent: { ref?: string; statblock?: CustomStatblock }): SizeCategory | undefined {
  if (ent.statblock?.size) return ent.statblock.size;
  const traits = ent.statblock?.traits ?? (ent.ref ? findCreature(ent.ref)?.traits : undefined);
  return (traits && sizeFromTraits(traits)) || undefined;
}

/** La créature est-elle une Nuée (Trait Essaim, LDB 85 l.199-200) ? */
export function swarmFromTraits(traits: string[]): boolean {
  return traits.some((t) => /^Nu[eé]e\b/i.test(t));
}

/** Nuée au spawn (LDB 85 l.200) : ×5 PB (« cinq fois plus de PB qu'une créature type ») + 10 CC sur
 *  les PB/carac. déjà calculés. Le B mono-créature du bestiaire reste, c'est lui qu'on multiplie. */
function applySwarmBuild(chars: Characteristics, wounds: number): { chars: Characteristics; wounds: number } {
  chars.CC += 10;
  return { chars, wounds: wounds * 5 };
}

/** Mutation / Corruption mentale (LDB 85 p.339-340) : tirage sur les Tableaux des Corruptions au
 *  spawn — graine STABLE dérivée de l'id (déterministe, rejouable). */
function spawnMutations(traits: string[] | undefined, id: string) {
  const kinds = mutationsAtSpawn(traits);
  if (!kinds.length) return {};
  const rng = makeRNG(hashSeed(`mut:${id}`));
  return { mutations: kinds.map((k) => rollMutation(k, rng)) };
}

/** Caractéristiques aléatoires (LDB 78 : « soustrayez -10 et ajoutez 2d10. Une Caractéristique de 30
 *  se traduit donc par 2d10+20. Si une Caractéristique vaut 5, lancez juste 1d10 ») — graine STABLE
 *  dérivée de l'id (déterministe, rejouable, même patron que spawnMutations). Les caractéristiques
 *  inexistantes (« – » → 0) ne sont pas tirées. */
function randomizeChars(chars: Characteristics, id: string): Characteristics {
  const rng = makeRNG(hashSeed(`rand:${id}`));
  const out = { ...chars };
  for (const k of CHAR_KEYS) {
    const v = out[k];
    if (v === 5) out[k] = rng.int(1, 10); // cas du livre : « Si une Caractéristique vaut 5 »
    else if (v > 0) out[k] = v - 10 + rng.int(1, 10) + rng.int(1, 10);
  }
  return out;
}

/** Compétences d'un statbloc au FORMAT LIVRE (« Langue (Magick) 63 », « Focalisation 65 ») : la
 *  valeur imprimée est la valeur de TEST FINALE (présentation des statblocs de PNJ — ex. Eusapia
 *  Balacañon, MSR Compagnon p.48) → avances = valeur − Caractéristique de la Compétence (inverse
 *  de LDB 09 : Test = Caractéristique + avances). Les avances se calculent sur le profil IMPRIMÉ —
 *  un profil retouché ensuite (carac. aléatoires LDB 78, Taille) garde les mêmes avances.
 *  Entrée sans valeur chiffrée : ignorée (rien d'inventé). */
export function skillsFromBook(list: string[] | undefined, printedChars: Characteristics): SkillInstance[] {
  const out: SkillInstance[] = [];
  for (const raw of list ?? []) {
    const m = raw.trim().match(/^(.+?)\s+(\d+)\s*$/);
    if (!m) continue;
    const { name, spec } = parseSkillRef(m[1]);
    const characteristic = skillCharacteristic(name);
    out.push({ name, spec, characteristic, advances: Math.max(0, Number(m[2]) - printedChars[characteristic]) });
  }
  return out;
}

/** Talents d'un statbloc (libellés concrets : « Magie des Arcanes (Ghur) », « Menaçant »). */
export function talentsFromBook(list: string[] | undefined): TalentInstance[] {
  return (list ?? []).map((name) => ({ name: name.trim(), times: 1 })).filter((t) => t.name);
}

/** Personnalisations d'AUTEUR d'un spawn de créature du bestiaire (EncounterDef.enemies[i]). */
export interface SpawnExtras {
  /** Traits FACULTATIFS choisis (LDB 76 l.49), chaînes éditées — fusionnés avant toute dérivation. */
  optionals?: string[];
  /** Sorts connus (la donnée bestiaire n'en liste pas — choix d'auteur). */
  spells?: string[];
  /** Caractéristiques aléatoires (LDB 78). */
  randomChars?: boolean;
}

export function creatureToCombatant(creature: CreatureData, id: string, pos: { x: number; y: number }, extras?: SpawnExtras): Combatant {
  const optionals = extras?.optionals ?? [];
  // Traits FACULTATIFS (LDB 76 l.49 : « Traits de créature courants que vous pouvez ajouter si vous
  // créez votre propre version ») : fusionnés AVANT toutes les dérivations (armes, armure, psy, nuée…).
  const traits = [...creature.traits, ...optionals];
  // « – » du Schéma des Profils (LDB 76) = caractéristique INEXISTANTE → 0 (Int/FM nulles = Fabriqué,
  // auto-réussite via isMindless ; CT nulle = pas d'arme à distance dans la donnée). Pas de 30 inventé.
  let chars = charsFrom(creature.char, 0);
  // Compétences/talents de la donnée (PNJ nommés : Eusapia, Horreurs…) — avances dérivées du profil IMPRIMÉ.
  const skills = skillsFromBook(creature.skills, chars);
  const talents = talentsFromBook(creature.talents);
  if (extras?.randomChars) chars = randomizeChars(chars, id); // LDB 78 : −10 + 2d10 sur le profil rond
  // Traits facultatifs à modificateurs de PROFIL (Élite, Coriace, Brutal, Rapide… — LDB 85) : le profil
  // imprimé est FINAL pour ses traits fixes, mais un facultatif AJOUTÉ s'applique par-dessus.
  for (const [k, v] of Object.entries(traitCharMods(optionals))) chars[k as keyof Characteristics] += v ?? 0;
  const baseSize = sizeFromTraits(creature.traits) ?? 'moyenne';
  // Taille FACULTATIVE : PRIME sur celle du bestiaire et applique « Utiliser les Tailles »
  // (LDB 85 l.276-277 : ±10 F/E, ∓5 Ag par catégorie d'écart).
  const optSize = sizeFromTraits(optionals);
  const size = optSize ?? baseSize;
  if (optSize && optSize !== baseSize) chars = resizeBySteps(chars, SIZE_ORDER[optSize] - SIZE_ORDER[baseSize]);
  // char.B (bestiaire) = la valeur livre d'UNE créature (≈ formule × Taille) → base/surcharge ; la
  // FORMULE (LDB 85) reprend la main si le profil a bougé (carac. aléatoires, Taille facultative).
  const profileChanged = !!extras?.randomChars || (optSize != null && optSize !== baseSize);
  let wounds = typeof creature.char.B === 'number' && !profileChanged ? creature.char.B : maxWounds(chars, size);
  if (traitBonusWoundsBE(optionals)) wounds += bonus(chars.E); // Endurant facultatif : +BE Blessures (LDB 85)
  const swarm = swarmFromTraits(traits);
  if (swarm) ({ chars, wounds } = applySwarmBuild(chars, wounds)); // ×5 PB + 10 CC (la nuée = 5 créatures)
  const movement = (typeof creature.char.M === 'number' ? creature.char.M : 4) + traitMovementMod(optionals);
  return {
    id,
    name: creature.label,
    kind: 'enemy',
    characteristics: chars,
    wounds: { current: wounds, max: wounds, base: wounds },
    advantage: 0,
    conditions: [],
    weapons: weaponsFromTraits(traits),
    armour: armourFromTraits(traits),
    size,
    bodyShape: bodyShapeOf(creature.label), // Tableau de Localisation par forme du corps (LDB p.312)
    ...parsePsychTraits(traits), // Peur/Terreur/Immunité + traits ciblés depuis les traits (LDB 21+85)
    ...(swarm ? { swarm: true, psychImmune: true } : {}), // Nuée : ignore la Psychologie (l.200)
    ...(isMindless(traits) ? { psychImmune: true } : {}), // Fabriqué : Tests d'Int/FM/Soc auto-réussis (LDB 85 p.339)
    ...spawnMutations(traits, id), // Mutation / Corruption mentale : tirage au spawn (LDB 85)
    // Sorts : ceux de la DONNÉE (PNJ nommés — Eusapia en a 12), surchargés par le choix d'auteur.
    ...(extras?.spells?.length ? { spells: [...extras.spells] } : creature.spells.length ? { spells: [...creature.spells] } : {}),
    groups: groupsFor({ folder: creature.folder }), // catégorie de Groupe dérivée du folder bestiaire (P3)
    traits, // conservés (facultatifs inclus) → attaques gratuites de créature en combat
    skills,
    talents,
    movement,
    pos,
  };
}

export function statblockToCombatant(sb: CustomStatblock, id: string, pos: { x: number; y: number }): Combatant {
  let chars = charsFrom(sb.char as any);
  // Compétences (format livre, avances dérivées du profil SAISI) + talents du statbloc.
  const skills = skillsFromBook(sb.skills, chars);
  const talents = talentsFromBook(sb.talents);
  // Caractéristiques aléatoires (LDB 78) : le statbloc saisi est le profil ROND → −10 + 2d10 au spawn.
  if (sb.randomChars) chars = randomizeChars(chars, id);
  // Traits à modificateurs de PROFIL (Élite, Coriace, Brutal, Rapide… — LDB 85) : appliqués aux
  // statblocks d'ÉDITEUR seulement (LDB 77 : « utilisez l'un des profils standard et AJOUTEZ les
  // Traits ») ; les profils du bestiaire (creatures.json) sont imprimés FINALS → jamais réappliqués.
  for (const [k, v] of Object.entries(traitCharMods(sb.traits))) chars[k as keyof Characteristics] += v ?? 0;
  const size = sb.size ?? sizeFromTraits(sb.traits ?? []) ?? 'moyenne';
  // Blessures : surcharge explicite `char.B` si fournie, sinon formule par Taille (vide ⇒ formule, LDB 85).
  // La formule reprend la main si les caractéristiques ont été tirées (le B saisi valait pour le profil rond).
  let wounds = typeof sb.char.B === 'number' && !sb.randomChars ? (sb.char.B as number) : maxWounds(chars, size);
  // Endurant (LDB 85 p.339) : +Bonus d'Endurance Blessures (sur la formule — un B explicite du
  // statbloc est réputé final, comme au bestiaire).
  if ((typeof sb.char.B !== 'number' || sb.randomChars) && traitBonusWoundsBE(sb.traits)) wounds += Math.floor(chars.E / 10);
  const swarm = swarmFromTraits(sb.traits ?? []);
  if (swarm) ({ chars, wounds } = applySwarmBuild(chars, wounds)); // Nuée : ×5 PB + 10 CC (l.200)
  const movement = (typeof sb.char.M === 'number' ? (sb.char.M as number) : 4) + traitMovementMod(sb.traits);
  return {
    id,
    name: sb.name,
    kind: 'enemy',
    characteristics: chars,
    wounds: { current: wounds, max: wounds, base: wounds },
    advantage: 0,
    conditions: [],
    // Armes : depuis les Traits si fournis (« Arme (Épée) +7 », « À distance (Arbalète) +9 (60) »),
    // sinon une arme générique au dégât indiqué.
    weapons: sb.traits?.length ? weaponsFromTraits(sb.traits) : [{ name: 'Arme', type: 'melee', damage: sb.weaponDamage ?? '+BF', qualities: [] }],
    armour: emptyArmour(sb.armour ?? 0),
    size,
    bodyShape: bodyShapeOf(sb.name), // Tableau de Localisation par forme du corps (LDB p.312)
    ...parsePsychTraits(sb.traits ?? []), // Peur/Terreur/Immunité + traits ciblés depuis les traits (LDB 21+85)
    ...(swarm ? { swarm: true, psychImmune: true } : {}), // Nuée : ignore la Psychologie (l.200)
    ...(isMindless(sb.traits) ? { psychImmune: true } : {}), // Fabriqué : Tests d'Int/FM/Soc auto-réussis (LDB 85 p.339)
    ...spawnMutations(sb.traits, id), // Mutation / Corruption mentale : tirage au spawn (LDB 85)
    ...(sb.spells?.length ? { spells: [...sb.spells] } : {}), // sorts d'auteur → l'IA incante (combatFlow)
    groups: groupsFor({ extras: sb.groups }), // extras manuels (Sigmarite…) — espèce/carrière non portées par le statbloc (P3)
    traits: sb.traits, // conservés → attaques gratuites de créature en combat
    skills,
    talents,
    movement,
    pos,
  };
}

export function spawnEnemy(
  ref: string | undefined,
  statblock: CustomStatblock | undefined,
  id: string,
  pos: { x: number; y: number },
  opts?: { appearance?: EntityAppearance; weapon?: string } & SpawnExtras,
): Combatant {
  let c: Combatant;
  if (statblock) c = statblockToCombatant(statblock, id, pos);
  else if (ref && findCreature(ref)) c = creatureToCombatant(findCreature(ref)!, id, pos, opts);
  else c = statblockToCombatant({ name: ref ?? 'Ennemi', char: { B: 10 } }, id, pos); // repli

  // COSMÉTIQUE — identité visuelle traversant explo↔combat à l'identique : tout override d'auteur
  // (parts monstrueux, couleurs, coiffure, yeux, sexe/carrure, seed re-tiré) est porté par
  // `Combatant.appearance` ; `enemyRigProfile` le SUPERPOSE aux défauts de race (champs absents
  // conservés). Sans aucun override, `appearance` reste indéfini → rendu dérivé du nom inchangé.
  const a = opts?.appearance;
  if (a && (a.monster || a.colors || a.parts || a.eyes || a.sex || a.build !== undefined || a.seed !== undefined)) {
    c.appearance = riggedAppearance(c.name, a.seed ?? hashSeed(id), {
      monster: a.monster,
      colors: a.colors,
      parts: a.parts,
      sex: a.sex,
      build: a.build,
      eyes: a.eyes,
    });
  }
  // Tenue/carrière éditée (libellé) → portée par le rig en combat comme en exploration.
  if (a?.career) c.career = a.career;
  if (opts?.weapon) {
    c.weapons = [weaponFromLabel(opts.weapon), ...c.weapons];
  }
  return c;
}
