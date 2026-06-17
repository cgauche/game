/**
 * Construction de Combattants depuis le bestiaire (réf.) ou un statblock
 * personnalisé d'une scène. Sert au combat tactique.
 */
import { Combatant, Characteristics, CHAR_KEYS, Weapon, ArmourPoints, BodyShape, SkillInstance, TalentInstance } from '../engine/types';
import { skillCharacteristic } from '../engine/character';
import { type TraitInstance, type TraitList } from '../engine/statEntry';
import { findCreature, findSkillById, findTalentById, findSpellById, CreatureData, type SkillRef, type TalentRef } from '../data';
import { CustomStatblock, EntityAppearance } from './scene';
import { emptyArmour } from '../engine/items';
import { maxWounds, bonus } from '../engine/characteristics';
import { parseSizeLabel, resizeBySteps, SIZE_ORDER, SizeCategory } from '../engine/size';
import { parsePsychTraits } from '../engine/psychology';
import { traitCharMods, traitBonusWoundsBE, isMindless, mutationsAtSpawn, isSwarm, resolveTraits, traitLabelById } from '../engine/traits/dispatch';
import { rollMutation, mutationByLabel } from '../data/mutations';
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
 * SOURCE UNIQUE (clé normalisée → { ranged? }) : sert et à filtrer le type « Arme (griffes) »
 * et à reconnaître un trait d'attaque naturelle (« Morsure +9 ») — plus de regex dupliquée.
 */
const NATURAL_WEAPON = new Map<string, { ranged?: boolean }>([
  ['morsure', {}], ['griffes', {}], ['griffe', {}], ['poings', {}], ['mains nues', {}],
  ['tentacule', {}], ['tentacules', {}], ['bec', {}], ['dard', {}], ['corne', {}], ['cornes', {}],
  ['queue', {}], ['pietinement', {}], ['crachat', { ranged: true }],
]);

/**
 * Parse UN trait d'arme WFRP4 (français) en arme jouable, ou null. Gère le TYPE
 * entre parenthèses (l'armement des monstres est dans les Traits) :
 *   « Arme +7 », « Arme (Épée) +7 », « Arme (Dague) +4 », « Arme (griffes) »,
 *   « À distance (Arbalète) +9 (60) », « À distance +8 (50) », « Morsure +9 ».
 * Le `name` = le TYPE quand il est manufacturé (→ le rig tient cette arme) ; sinon
 * une étiquette naturelle (→ weaponFamily renvoie '' = aucune arme dessinée).
 */
export function weaponFromTrait(t: TraitInstance): Weapon | null {
  const dmg = t.value != null ? (t.value < 0 ? `${t.value}` : `+${t.value}`) : null;
  if (t.id === 'a-distance') {
    if (dmg == null) return null; // « À distance » sans Indice de Dégâts : pas une arme jouable (RAW)
    const type = t.arg;
    const w: Weapon = { name: type && !NATURAL_WEAPON.has(normTrait(type)) ? type : 'Attaque à distance', type: 'ranged', damage: dmg, qualities: [] };
    if (t.range != null) w.range = t.range;
    return w;
  }
  if (t.id === 'arme') {
    const type = t.arg;
    const damage = dmg ?? '+BF';
    if (type && NATURAL_WEAPON.has(normTrait(type))) return { name: type, type: 'melee', damage, qualities: [] };
    return { name: type ?? 'Arme', type: 'melee', damage, qualities: [] };
  }
  // Attaque naturelle (« Morsure +9 », « 8 Tentacules +9 ») : la clé est une arme naturelle CONNUE
  // (source UNIQUE NATURAL_WEAPON). L'arme reste UNE (l'Action d'attaque) ; le compte joue sur les
  // Attaques GRATUITES (aiCreatureFreeAttacks), LDB 85 l.354.
  const word = traitLabelById(t.id).split(/\s+/)[0];
  const meta = NATURAL_WEAPON.get(normTrait(word));
  if (meta) return { name: word, type: meta.ranged ? 'ranged' : 'melee', damage: dmg ?? '+BF', qualities: [] };
  return null;
}

/** Parse les traits d'arme d'une créature en armes jouables (mêlée + distance). */
function weaponsFromTraits(traits: TraitList): Weapon[] {
  const weapons: Weapon[] = [];
  for (const t of traits) {
    const w = weaponFromTrait(t);
    if (w) weapons.push(w);
  }
  if (weapons.length === 0) weapons.push({ name: 'Arme', type: 'melee', damage: '+BF', qualities: [] });
  return weapons;
}

/** PA plats du trait « Armure (Indice) » (LDB 85, profils d'éditeur) — lus par le REGISTRE des
 *  Traits (Indice ou argument), plus de regex propre. 0 si absent. */
function armourFromTraits(traits: TraitList): ArmourPoints {
  const r = resolveTraits(traits).find((x) => x.def.key === 'Armure');
  const n = r ? Number(r.indice ?? r.arg ?? 0) : 0;
  return emptyArmour(Number.isFinite(n) ? n : 0);
}

/** Catégorie de Taille depuis le trait « Taille (X) » (LDB 85) — lue par le REGISTRE des Traits
 *  (`resolveTraits` → arg), plus de regex propre. Une plage (« Taille (de Petite à Énorme) ») est
 *  résolue à sa borne haute par `parseSizeLabel`. null si absent ou argument non reconnu. */
export function sizeFromTraits(traits: TraitList): SizeCategory | null {
  const arg = resolveTraits(traits).find((r) => r.def.key === 'Taille')?.arg;
  return arg ? parseSizeLabel(arg) : null;
}

/** Catégorie de Taille d'une entité de scène (créature posée) : champ explicite du statbloc, sinon
 *  dérivée des Traits (statbloc ou créature du bestiaire via `ref`). `undefined` ⇒ Moyenne au rendu. */
export function entitySize(ent: { ref?: string; statblock?: CustomStatblock }): SizeCategory | undefined {
  if (ent.statblock?.size) return ent.statblock.size;
  const traits = ent.statblock?.traits ?? (ent.ref ? findCreature(ent.ref)?.traits : undefined); // tous TraitInstance[]
  return (traits && sizeFromTraits(traits)) || undefined;
}

/** Nuée au spawn (LDB 85 l.200) : ×5 PB (« cinq fois plus de PB qu'une créature type ») + 10 CC sur
 *  les PB/carac. déjà calculés. Le B mono-créature du bestiaire reste, c'est lui qu'on multiplie. */
function applySwarmBuild(chars: Characteristics, wounds: number): { chars: Characteristics; wounds: number } {
  chars.CC += 10;
  return { chars, wounds: wounds * 5 };
}

/** Mutation / Corruption mentale (LDB 85 p.339-340) : tirage sur les Tableaux des Corruptions au
 *  spawn — graine STABLE dérivée de l'id (déterministe, rejouable). */
function spawnMutations(traits: TraitList | undefined, id: string) {
  const specs = mutationsAtSpawn(traits);
  if (!specs.length) return {};
  const rng = makeRNG(hashSeed(`mut:${id}`));
  // Mutation EXPLICITE (label, ex. « Cornes asymétriques » : tell figé en donnée) sinon tirage.
  const mutations = specs.map((s) => (s.label ? mutationByLabel(s.label) : null) ?? rollMutation(s.kind, rng));
  return { mutations };
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
 *  Entrée sans valeur chiffrée : ignorée (rien d'inventé). Réf STRUCTURÉE `SkillRef` (id stable +
 *  valeur imprimée) — plus de parsing de chaînes. */
/** Une `SkillInstance` (id + spec) depuis le LIBELLÉ (pour la Caractéristique) + valeur de Test IMPRIMÉE. */
function skillInstance(skillId: string, label: string, spec: string | undefined, value: number, printedChars: Characteristics): SkillInstance {
  const ch = skillCharacteristic(label);
  return { skillId, spec, characteristic: ch, advances: Math.max(0, value - printedChars[ch]) };
}

/** Compétences du BESTIAIRE — refs structurées `SkillRef` (id + valeur de Test imprimée). Réf. inconnue
 *  du catalogue ignorée (rien d'inventé). */
export function skillsFromBook(list: SkillRef[] | undefined, printedChars: Characteristics): SkillInstance[] {
  const out: SkillInstance[] = [];
  for (const ref of list ?? []) {
    const sk = findSkillById(ref.id);
    if (sk) out.push(skillInstance(sk.id, sk.label, ref.spec, ref.value, printedChars));
  }
  return out;
}

/** Talents d'une créature/statbloc → `TalentInstance[]` (libellés concrets : « Magie des Arcanes (Ghur) »,
 *  « Menaçant »). Refs STRUCTURÉES `TalentRef` (id stable + niveau/spec). Le nom RECONSTRUIT garde sa spec
 *  entre parenthèses : c'est la clé du registre combatFeatures (`featureKey`) et du grimoire. */
export function talentsFromBook(list: TalentRef[] | undefined): TalentInstance[] {
  const out: TalentInstance[] = [];
  for (const ref of list ?? []) {
    const t = findTalentById(ref.id);
    if (t) out.push({ talentId: t.id, spec: ref.spec, times: ref.times ?? 1 });
  }
  return out;
}

/** Personnalisations d'AUTEUR au spawn d'une créature (portées par SceneEntity.combat). */
export interface SpawnExtras {
  /** Traits FACULTATIFS choisis (LDB 76 l.49), STRUCTURÉS (`TraitInstance`) — fusionnés avant dérivation. */
  optionals?: TraitInstance[];
  /** Sorts connus (la donnée bestiaire n'en liste pas — choix d'auteur). */
  spells?: string[];
  /** Caractéristiques aléatoires (LDB 78). */
  randomChars?: boolean;
}

/** Profil + modificateurs de PROFIL des traits `live` (Élite/Coriace/Brutal…) — pour les valeurs DÉRIVÉES
 *  au spawn (Blessures) qui doivent refléter les traits, alors que `characteristics` ne stocke que la base. */
function withTraitChars(chars: Characteristics, live: TraitList | undefined): Characteristics {
  const out = { ...chars };
  for (const [k, v] of Object.entries(traitCharMods(live))) out[k as keyof Characteristics] += v ?? 0;
  return out;
}

export function creatureToCombatant(creature: CreatureData, id: string, pos: { x: number; y: number }, extras?: SpawnExtras): Combatant {
  const optTraits = extras?.optionals ?? [];
  // Traits FACULTATIFS (LDB 76 l.49 : « Traits de créature courants que vous pouvez ajouter si vous
  // créez votre propre version ») : fusionnés AVANT toutes les dérivations (armes, armure, psy, nuée…).
  // `creature.traits` (donnée) ET `optTraits` (choix d'auteur) sont déjà des `TraitInstance` structurés.
  const traits = [...creature.traits, ...optTraits];
  // « – » du Schéma des Profils (LDB 76) = caractéristique INEXISTANTE → 0 (Int/FM nulles = Fabriqué,
  // auto-réussite via isMindless ; CT nulle = pas d'arme à distance dans la donnée). Pas de 30 inventé.
  let chars = charsFrom(creature.char, 0);
  // Compétences/talents de la donnée (PNJ nommés : Eusapia, Horreurs…) — avances dérivées du profil IMPRIMÉ.
  const skills = skillsFromBook(creature.skills, chars);
  const talents = talentsFromBook(creature.talents);
  if (extras?.randomChars) chars = randomizeChars(chars, id); // LDB 78 : −10 + 2d10 sur le profil rond
  // Traits facultatifs à modificateurs de PROFIL (Élite, Coriace, Brutal, Rapide… — LDB 85) : le profil
  // imprimé est FINAL pour ses traits fixes (déjà cuits) ; un facultatif AJOUTÉ s'applique en DIRECT via
  // `liveTraits` (collecteur passif) → `characteristics` reste la base bestiaire, sans double-compte.
  const baseSize = sizeFromTraits(creature.traits) ?? 'moyenne';
  // Taille FACULTATIVE : PRIME sur celle du bestiaire et applique « Utiliser les Tailles »
  // (LDB 85 l.276-277 : ±10 F/E, ∓5 Ag par catégorie d'écart).
  const optSize = sizeFromTraits(optTraits);
  const size = optSize ?? baseSize;
  if (optSize && optSize !== baseSize) chars = resizeBySteps(chars, SIZE_ORDER[optSize] - SIZE_ORDER[baseSize]);
  // char.B (bestiaire) = la valeur livre d'UNE créature (≈ formule × Taille) → base/surcharge ; la
  // FORMULE (LDB 85) reprend la main si le profil a bougé (carac. aléatoires, Taille facultative).
  const profileChanged = !!extras?.randomChars || (optSize != null && optSize !== baseSize);
  // Blessures dérivées de F/E/FM : computées sur le profil INCLUANT les facultatifs (Coriace +E, Élite +FM…),
  // même si `characteristics` ne stocke que la base — sinon une créature renforcée perdrait ses PB de trait.
  const charsEff = withTraitChars(chars, optTraits);
  let wounds = typeof creature.char.B === 'number' && !profileChanged ? creature.char.B : maxWounds(charsEff, size);
  if (traitBonusWoundsBE(optTraits)) wounds += bonus(charsEff.E); // Endurant facultatif : +BE Blessures (LDB 85)
  const swarm = isSwarm(traits);
  if (swarm) ({ chars, wounds } = applySwarmBuild(chars, wounds)); // ×5 PB + 10 CC (la nuée = 5 créatures)
  const movement = typeof creature.char.M === 'number' ? creature.char.M : 4; // facultatifs → liveTraits (effectiveMovement)
  return {
    id,
    name: creature.label,
    kind: 'enemy',
    ...(optTraits.length ? { liveTraits: optTraits } : {}), // charMods/Mouvement des facultatifs appliqués en direct
    ...(creature.appearance?.species ? { species: creature.appearance.species } : {}), // espèce du record (P2) → le rig la lit ; le reste de l'apparence par défaut est lu par enemyRigProfile via findCreature
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
    // Combatant.spells = IDS de sort (runtime) : créature = ids des refs ; choix d'auteur = ids (filtrés valides).
    ...(extras?.spells?.length
      ? { spells: extras.spells.filter((id) => !!findSpellById(id)) }
      : creature.spells.length ? { spells: creature.spells.map((s) => s.id) } : {}),
    groups: groupsFor({ folder: creature.folder }), // catégorie de Groupe dérivée du folder bestiaire (P3)
    traits, // conservés (facultatifs inclus) → attaques gratuites de créature en combat
    skills,
    talents,
    movement,
    pos,
  };
}

export function statblockToCombatant(sb: CustomStatblock, id: string, pos: { x: number; y: number }): Combatant {
  // Traits du statbloc d'éditeur : déjà des `TraitInstance` structurés (édités par picker) — toutes
  // les dérivations en aval les lisent sans aucun parsing.
  const traits = sb.traits ?? [];
  let chars = charsFrom(sb.char as any);
  // Compétences (refs `SkillRef` structurées, avances dérivées du profil SAISI) + talents du statbloc.
  const skills = skillsFromBook(sb.skills, chars);
  const talents = talentsFromBook(sb.talents);
  // Caractéristiques aléatoires (LDB 78) : le statbloc saisi est le profil ROND → −10 + 2d10 au spawn.
  if (sb.randomChars) chars = randomizeChars(chars, id);
  // Traits à modificateurs de PROFIL (Élite, Coriace, Brutal, Rapide… — LDB 85) : un statbloc d'ÉDITEUR
  // part d'un profil standard et AJOUTE les Traits (LDB 77) → tous appliqués en DIRECT via `liveTraits`
  // (collecteur passif). `characteristics` reste le profil de BASE saisi ; `effectiveChar` ajoute les traits.
  const size = sb.size ?? sizeFromTraits(traits) ?? 'moyenne';
  // Blessures : surcharge explicite `char.B` si fournie, sinon formule par Taille (vide ⇒ formule, LDB 85).
  // La formule reprend la main si les caractéristiques ont été tirées (le B saisi valait pour le profil rond).
  // Blessures sur le profil INCLUANT les traits (Coriace +E…) ; `characteristics` ne garde que la base saisie.
  const charsEff = withTraitChars(chars, traits);
  let wounds = typeof sb.char.B === 'number' && !sb.randomChars ? (sb.char.B as number) : maxWounds(charsEff, size);
  // Endurant (LDB 85 p.339) : +Bonus d'Endurance Blessures (sur la formule — un B explicite du
  // statbloc est réputé final, comme au bestiaire).
  if ((typeof sb.char.B !== 'number' || sb.randomChars) && traitBonusWoundsBE(traits)) wounds += Math.floor(charsEff.E / 10);
  const swarm = isSwarm(traits);
  if (swarm) ({ chars, wounds } = applySwarmBuild(chars, wounds)); // Nuée : ×5 PB + 10 CC (l.200)
  const movement = typeof sb.char.M === 'number' ? (sb.char.M as number) : 4; // traits → liveTraits (effectiveMovement)
  return {
    id,
    name: sb.name,
    kind: 'enemy',
    ...(traits.length ? { liveTraits: [...traits] } : {}), // statbloc d'éditeur : tous les traits en direct
    characteristics: chars,
    wounds: { current: wounds, max: wounds, base: wounds },
    advantage: 0,
    conditions: [],
    // Armes : depuis les Traits si fournis (« Arme (Épée) +7 », « À distance (Arbalète) +9 (60) »),
    // sinon une arme générique au dégât indiqué.
    weapons: traits.length ? weaponsFromTraits(traits) : [{ name: 'Arme', type: 'melee', damage: sb.weaponDamage ?? '+BF', qualities: [] }],
    armour: emptyArmour(sb.armour ?? 0),
    size,
    bodyShape: bodyShapeOf(sb.name), // Tableau de Localisation par forme du corps (LDB p.312)
    ...parsePsychTraits(traits), // Peur/Terreur/Immunité + traits ciblés depuis les traits (LDB 21+85)
    ...(swarm ? { swarm: true, psychImmune: true } : {}), // Nuée : ignore la Psychologie (l.200)
    ...(isMindless(traits) ? { psychImmune: true } : {}), // Fabriqué : Tests d'Int/FM/Soc auto-réussis (LDB 85 p.339)
    ...spawnMutations(traits, id), // Mutation / Corruption mentale : tirage au spawn (LDB 85)
    ...(sb.spells?.length ? { spells: sb.spells.filter((id) => !!findSpellById(id)) } : {}), // ids d'auteur (filtrés valides)
    groups: groupsFor({ extras: sb.groups }), // extras manuels (Sigmarite…) — espèce/carrière non portées par le statbloc (P3)
    traits, // structurés → attaques gratuites + lecture sans re-parsing
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
  if (a?.species) c.species = a.species; // espèce/race d'auteur → rig en combat comme en exploration
  if (a && (a.species || a.monster || a.features || a.colors || a.parts || a.eyes || a.sex || a.build !== undefined || a.seed !== undefined)) {
    c.appearance = riggedAppearance(c.name, a.seed ?? hashSeed(id), {
      species: a.species,
      monster: a.monster,
      features: a.features,
      colors: a.colors,
      parts: a.parts,
      sex: a.sex,
      build: a.build,
      eyes: a.eyes,
    });
  }
  // Tenue éditée (libellé) → portée par le rig (via Combatant.career, qui sert de tenue) en
  // combat comme en exploration.
  if (a?.tenue) c.career = a.tenue;
  if (opts?.weapon) {
    c.weapons = [weaponFromLabel(opts.weapon), ...c.weapons];
  }
  return c;
}
