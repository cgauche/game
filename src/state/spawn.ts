/**
 * Construction de Combattants depuis le bestiaire (réf.) ou un statblock
 * personnalisé d'une scène. Sert au combat tactique.
 */
import { Combatant, Characteristics, CHAR_KEYS, Weapon, ArmourPoints, BodyShape, SkillInstance, TalentInstance, type ShipPoste } from '../engine/types';
import { skillCharacteristicById } from '../engine/character';
import { type TraitInstance, type TraitList } from '../engine/statEntry';
import { findCreatureById, findSkillById, findTalentById, findSpellById, findVehicleById, CreatureData, type SkillRef, type TalentRef } from '../data';
import { vehicleCombatant } from '../engine/vehicle';
import { CustomStatblock, EntityAppearance } from './scene';
import { emptyArmour, buildWeapon } from '../engine/items';
import { maxWounds, bonus } from '../engine/characteristics';
import { parseSizeLabel, resizeBySteps, SIZE_ORDER, SizeCategory } from '../engine/size';
import { parsePsychTraits } from '../engine/psychology';
import { traitCharMods, traitBonusWoundsBE, isMindless, mutationsAtSpawn, isSwarm, resolveTraits } from '../engine/traits/dispatch';
import { rollMutation, mutationById } from '../data/mutations';
import { makeRNG } from '../engine/dice';
import { groupsFor } from '../engine/groups';
import { weaponsFromTraits, armourFromTraits } from '../engine/creatureEquip';
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

// Dérivation traits → armes/armure : SOURCE UNIQUE déplacée dans `engine/creatureEquip` (pure), pour
// être partagée avec le RENDU d'exploration sans cycle de couches. Re-exportée pour les importeurs.
export { weaponFromTrait } from '../engine/creatureEquip';

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
  const traits = ent.statblock?.traits ?? (ent.ref ? findCreatureById(ent.ref)?.traits : undefined); // tous TraitInstance[]
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
  // Mutation EXPLICITE (id, ex. « cornes-asymetriques » : tell figé en donnée) sinon tirage.
  const mutations = specs.map((s) => (s.mutationId ? mutationById(s.mutationId) : null) ?? rollMutation(s.kind, rng));
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
/** Une `SkillInstance` (id + spec) depuis l'`id` STABLE (pour la Caractéristique) + valeur de Test
 *  IMPRIMÉE. Carac résolue par id (`skillCharacteristicById`, ≠ re-lookup par libellé — multilangue-safe). */
function skillInstance(skillId: string, spec: string | undefined, value: number, printedChars: Characteristics): SkillInstance {
  const ch = skillCharacteristicById(skillId);
  return { skillId, spec, characteristic: ch, advances: Math.max(0, value - printedChars[ch]) };
}

/** Compétences du BESTIAIRE — refs structurées `SkillRef` (id + valeur de Test imprimée). Réf. inconnue
 *  du catalogue ignorée (rien d'inventé). */
export function skillsFromBook(list: SkillRef[] | undefined, printedChars: Characteristics): SkillInstance[] {
  const out: SkillInstance[] = [];
  for (const ref of list ?? []) {
    const sk = findSkillById(ref.id);
    if (sk) out.push(skillInstance(sk.id, ref.spec, ref.value, printedChars));
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
  /** Coque/navire : `id`s des Combattants d'ÉQUIPAGE exposés (MDG ch.14) — posés sur le `Combatant`. */
  crewIds?: string[];
  /** Coque/navire : pièces d'artillerie MONTÉES (postes, MDG ch.12-13) — posées sur le Combattant-coque. */
  postes?: ShipPoste[];
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
    creatureId: creature.id, // identité bestiaire STABLE → le rig la résout par id (plus par `name`)
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
    bodyShape: bodyShapeOf(creature.id), // Tableau de Localisation par forme du corps (LDB p.312)
    ...parsePsychTraits(traits), // Peur/Terreur/Immunité + traits ciblés depuis les traits (LDB 21+85)
    ...(swarm ? { swarm: true, psychImmune: true } : {}), // Nuée : ignore la Psychologie (l.200)
    ...(isMindless(traits) ? { psychImmune: true } : {}), // Fabriqué : Tests d'Int/FM/Soc auto-réussis (LDB 85 p.339)
    ...spawnMutations(traits, id), // Mutation / Corruption mentale : tirage au spawn (LDB 85)
    // Sorts : ceux de la DONNÉE (PNJ nommés — Eusapia en a 12), surchargés par le choix d'auteur.
    // Combatant.spells = IDS de sort (runtime) : créature = ids des refs ; choix d'auteur = ids (filtrés valides).
    ...(extras?.spells?.length
      ? { spells: extras.spells.filter((id) => !!findSpellById(id)) }
      : creature.spells.length ? { spells: creature.spells.map((s) => s.id) } : {}),
    groups: groupsFor({ folder: creature.folder, group: creature.group }), // catégorie de Groupe (folder, ou surcharge `group` éditable) (P3)
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
    weapons: traits.length ? weaponsFromTraits(traits) : [buildWeapon({ name: 'Arme', damage: { literal: sb.weaponDamage ?? '+BF' } })], // uid universel
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
  else if (ref && findCreatureById(ref)) c = creatureToCombatant(findCreatureById(ref)!, id, pos, opts);
  else if (ref && findVehicleById(ref)?.hull) {
    // Coque/navire (`vehicles.json` → facette `hull`) comme Combattant à PV (MDG ch.13). 'enemy' pour être
    // une cible ; inerte (pas d'arme/Mouvement, Psychologie ignorée) — sa destruction passe par ses Blessures.
    c = vehicleCombatant(findVehicleById(ref)!, id)!;
    c.kind = 'enemy';
    c.pos = { ...pos };
  } else c = statblockToCombatant({ name: ref ?? 'Ennemi', char: { B: 10 } }, id, pos); // repli
  if (opts?.crewIds) c.crewIds = opts.crewIds;
  if (opts?.postes) c.postes = opts.postes;

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
