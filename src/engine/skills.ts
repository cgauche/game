/**
 * Valeur d'une Compétence/Caractéristique pour les Tests « dans le monde »
 * (hors combat) : Caractéristique + Augmentations de la compétence.
 */
import { Combatant, CharKey, Difficulty } from './types';
import { findSkillById } from '../data';
import { itemCapability } from './capabilities';
import { groupMatch } from './groups';
import { effectiveChar, bonus } from './characteristics';
import { assistBonus } from './tests';
import { testStatePenalty, activeCharTestMod, isMovementSkill } from './conditions';
import { agilityTestPenalty } from './encumbrance';
import { traumaSkillPenalty, passiveSkillSum, passiveTestMod } from './trauma';
import type { PairedSense } from './ops';
import type { ModLine } from './combat';
import { RULE_REF } from './ruleRefs';
import { rule } from './policy';
import { rollTest } from './tests';
import { RNG, defaultRNG } from './dice';
import { effectivePsychTraits, isPsychImmune } from './psychology';
import { maxBy } from './pick';

/** Règles optionnelles « caractéristique alternative » via policy (POINT UNIQUE de la famille) : Métier
 *  comme Savoir → Int (LDB 09 l.352) ; Intimidation → carac réglable F/FM/Int (LDB 09 l.266). Renvoie la
 *  CharKey à utiliser (inchangée si aucune règle ne s'applique). N'opère que sur une COMPÉTENCE nommée.
 *  (Les carac alternatives PAR ENTITÉ — ex. lanceur ogre : Langue (Magick) sur Endurance, ADE II 2 l.728 —
 *  sont portées par la DONNÉE — `SkillInstance.characteristic` — lue par effectiveSkillCharKey en amont,
 *  pas ici : aucun sniff d'espèce dans le moteur.) */
function altCharKey(c: Combatant, skillId: string, ck: CharKey): CharKey {
  if (ck === 'dexterite' && skillId === 'metier' && rule('test-metier-int')) return 'intelligence';
  if (skillId === 'intimidation') {
    const mode = rule('test-intimidation-char') as string;
    if (mode === 'force-mentale' || mode === 'intelligence') return mode;
    if (mode === 'max') {
      const f = effectiveChar(c, 'force'), fm = effectiveChar(c, 'force-mentale'), i = effectiveChar(c, 'intelligence');
      return f >= fm && f >= i ? 'force' : fm >= i ? 'force-mentale' : 'intelligence';
    }
  }
  return ck;
}

/** Caractéristique (CharKey STABLE) d'une compétence par son `id`. `SkillData.characteristic` EST
 *  une CharKey ('Dex'…), multilangue-safe — plus de conversion par libellé. */
export function skillCharKeyById(skillId: string): CharKey | undefined {
  return findSkillById(skillId)?.characteristic;
}

/** Caractéristique EFFECTIVE d'un Test de compétence — POINT UNIQUE (consommé par `testValue` ET
 *  `castingValue`) : explicite > carac de l'INSTANCE possédée (défaut DATA-DRIVEN : un statbloc peut
 *  porter une carac alternative) > carac de la Compétence (JSON, par id) > repli ; PUIS surcharge par
 *  règle optionnelle « caractéristique alternative » (`altCharKey` : Métier/Intimidation/Magie ogre). */
export function effectiveSkillCharKey(
  c: Combatant,
  skillId: string | undefined,
  opts: { explicit?: CharKey; spec?: string; fallback?: CharKey } = {},
): CharKey {
  const { explicit, spec, fallback = 'dexterite' } = opts;
  if (explicit) return explicit;
  const sk = skillId ? c.skills.find((s) => s.skillId === skillId && (spec == null || s.spec === spec)) : undefined;
  let ck: CharKey = sk?.characteristic ?? (skillId ? skillCharKeyById(skillId) : undefined) ?? fallback;
  if (skillId) ck = altCharKey(c, skillId, ck);
  return ck;
}

/** Valeur de test d'un personnage pour une compétence ou une caractéristique. Mêmes modulations qu'en
 *  combat (le canon ne distingue pas) : Caractéristique EFFECTIVE (buffs magiques + pénalités de
 *  Traumatisme, LDB 18, via `effectiveChar`), pénalités d'États (LDB 16, `testStatePenalty`), pénalité
 *  d'Encombrement sur l'Agilité (LDB 61), port d'armure (LDB 63) et objet Laid sur la Sociabilité (LDB 60).
 *  `sense` (optionnel) : sens NARRATIVEMENT sollicité par CE Test de Perception (vue/ouïe — déterminé par
 *  l'appelant/la scène, cf. Talent Sens aiguisé `manual:true`) ; restreint les `skillMod` sense-scopés
 *  (Surdité, LDB 18 — `traumaSkillPenalty`). Absent = comportement historique (le RAW n'est pas levé
 *  faute d'info sur le Test précis). */
export function testValue(c: Combatant, skill?: string, characteristic?: CharKey, spec?: string, sense?: PairedSense): number {
  if (!skill && !characteristic) return 0;
  // `skill` = skillId STABLE (multilingue : jamais un libellé). La compétence possédée est trouvée par id ;
  // `spec` cible une spécialisation précise (Savoir (Magie), Métier (Forgeron)…) quand le héros en possède
  // plusieurs avec des avances différentes — sinon (spec absent) la première instance de l'id suffit.
  const sk = skill ? c.skills.find((s) => s.skillId === skill && (spec == null || s.spec === spec)) : undefined;
  // Caractéristique : POINT UNIQUE partagé avec castingValue (carac d'instance data-driven + carac alternative).
  const ck = effectiveSkillCharKey(c, skill, { explicit: characteristic, spec });
  const base = effectiveChar(c, ck);
  const states = testStatePenalty(c, skill);
  const enc = ck === 'agilite' ? agilityTestPenalty(c) : 0; // charge : couche d'ÉTAT orthogonale (≠ passif d'élément)
  const traumaSkill = traumaSkillPenalty(c, skill, sense); // séquelle permanente (fracture Langue l.300 ; Surdité l.363)
  // Passifs INTRINSÈQUES d'élément (Σ), tous via le collecteur unifié : compétence nommée + port d'armure
  // (`passiveSkillSum` : Groin poilu +10 Pistage, −N% en X du port d'armure) + mods de Test char-qualifiés
  // (`passiveTestMod` : mutation Visage inversé −20 Soc, objet Laid −Soc).
  const passive = passiveSkillSum(c, skill) + passiveTestMod(c, ck);
  // Mods de Test char-QUALIFIÉS d'effets ACTIFS (op `testMod{char}` exécutée — Mystracine « +10 aux
  // Tests d'E et de FM, −10 Ag/I/Int », LDB 71 l.33) : sommés pour la seule carac testée ; les mods
  // GLOBAUX (sans char) sont déjà comptés via `testStatePenalty` (→ effectTestMod). `movementOnly`
  // (#193, Genou démis « Tests impliquant cette jambe ») restreint aux Tests classés « déplacement ».
  const fxChar = activeCharTestMod(c, ck, { movement: isMovementSkill(skill) });
  return base + (sk?.advances ?? 0) + states + enc + traumaSkill + passive + fxChar + skillToolMod(c, skill);
}

/** Malus « sans l'outil de la compétence » (LDB 09 l.168 : les Difficultés de Crochetage « supposent
 *  l'utilisation d'outils de crochetage ; des crochets improvisés… peuvent être utilisés avec une
 *  pénalité de -10 ») : si la donnée de la compétence déclare `tool` et que l'acteur ne POSSÈDE aucun
 *  objet non détruit portant la capability requise, `withoutMod` s'applique. Possession NON gatée sur
 *  le port (`itemCapability`) : avoir les outils dans le sac suffit — on les sort pour s'en servir. */
export function skillToolMod(c: Combatant, skill?: string): number {
  const tool = skill ? findSkillById(skill)?.tool : undefined;
  if (!tool) return 0;
  const has = (c.items ?? []).some((it) => !it.destroyed && itemCapability(it, tool.capability));
  return has ? 0 : tool.withoutMod;
}

/** NIVEAU DE COMPÉTENCE, au sens de `LDB 09 l.17` (« la Caractéristique associée [+] le nombre
 *  d'Augmentations prises ») : Caractéristique EFFECTIVE (buffs magiques + Traumatisme via
 *  `effectiveChar`) + avances, SANS les pénalités d'État/Encombrement/passifs qu'applique `testValue`.
 *  FORMULE UNIQUE de la valeur NUE d'un Test — base des Tests de Psychologie (Calme, généralisant
 *  `calmeValue` à toute compétence déclarée en donnée) ET grandeur du départage à DR égal
 *  (`LDB 12 l.160`, `resolveOpposed`). `explicitChar` : Caractéristique IMPOSÉE par l'appelant quand
 *  elle ne se déduit pas de la Compétence (surcharge de Domaine pour Langue (Magick) —
 *  `magic.castingBaseValue`), jamais un recalcul parallèle de la formule. */
export function skillBaseValue(c: Combatant, skill: string, spec?: string, explicitChar?: CharKey): number {
  const ck = effectiveSkillCharKey(c, skill, { spec, explicit: explicitChar });
  const adv = c.skills.find((s) => s.skillId === skill && (spec == null || s.spec === spec))?.advances ?? 0;
  return effectiveChar(c, ck) + adv;
}

/** Valeur de Test « brute » pour un Test de COMBAT : `testValue` PRIVÉE de la pénalité d'États HORS combat
 *  (`testStatePenalty`, qu'elle inclut déjà) — pour que l'appelant ajoute la pénalité de COMBAT
 *  (`combatTestPenalty`) UNE SEULE fois, sans double-compte. = Caractéristique effective + avances + passifs
 *  intrinsèques + Encombrement/Traumatisme, SANS la pénalité d'État (réappliquée en version combat par
 *  l'appelant). Utilisée par les Tests de RÉCUPÉRATION d'États (Empoisonné… : −10 d'État compté une fois). */
export function rawCombatTestBase(c: Combatant, skill?: string, characteristic?: CharKey, spec?: string): number {
  return testValue(c, skill, characteristic, spec) - testStatePenalty(c, skill);
}

/** Le personnage possède-t-il la compétence `skillId` (et, si `spec` fourni, cette spécialisation —
 *  ex. Projectiles (Poudre noire)) ? Par id STABLE. Sert aux modulateurs (ex. `easierIf`). */
export function actorHasSkill(c: Combatant, skillId: string, spec?: string): boolean {
  return c.skills.some((s) => s.skillId === skillId && (spec == null || s.spec === spec));
}

/** Le personnage a-t-il AU MOINS UNE Augmentation dans `skillId` (spécialisation ciblée si `spec`) ?
 *  Prédicat d'éligibilité au SOUTIEN — LDB 12 l.195. Plus strict que `actorHasSkill` (simple présence). */
function hasSkillAdvance(c: Combatant, skillId: string, spec?: string): boolean {
  return c.skills.some((s) => s.skillId === skillId && (spec == null || s.spec === spec) && (s.advances ?? 0) >= 1);
}

/** Le malus social « contenu » de `type` s'applique-t-il envers `targetGroups` ? (LDB 21) Vrai si le
 *  tester POSSÈDE le trait visant ce groupe ET n'est PAS en état ACTIF pour lui. Le −20/−10 est en effet
 *  l'issue du Test de Psychologie RÉUSSI (Animosité l.22 / Préjugé l.50) — ou, hors combat (pas de Test
 *  modélisé), la manifestation par défaut du trait possédé. En état ACTIF (Test ÉCHOUÉ) ce malus
 *  DISPARAÎT : le personnage est sous compulsion (attaquer l.24 / insulter l.52), pas socialement « contenu ».
 *  SIÈGE UNIQUE de la lecture des Traits psy CIBLÉS pour un Test social : `socialPsychMod` (valeur) et
 *  `socialPsychLabel` (affichage) en dépendent tous deux, donc l'immunité à la Psychologie (LDB 17 l.59,
 *  Détermination) s'y lit UNE fois, par le MÊME prédicat que la Peur/Terreur (`isPsychImmune`) : tant
 *  qu'elle dure, aucun de ces malus ne se manifeste, et l'étiquette disparaît avec lui. */
function containedSocialPenalty(tester: Combatant, type: 'animosite' | 'prejuge', targetGroups: string[]): boolean {
  if (isPsychImmune(tester)) return false;
  const possede = effectivePsychTraits(tester).some((t) => t.type === type && t.cible && groupMatch(t.cible, targetGroups));
  if (!possede) return false;
  const actif = (tester.psychState ?? []).some((p) => p.type === type && p.active && p.cible && groupMatch(p.cible, targetGroups));
  return !actif;
}

/** Pénalité de Sociabilité des Traits psy ciblés de `tester` envers les groupes `targetGroups` (LDB 21) :
 *  Animosité −20, Préjugé −10, cumulables. À consommer sur un Test de Sociabilité ciblé (dialogue/interaction). */
export function socialPsychMod(tester: Combatant, targetGroups: string[]): number {
  return (containedSocialPenalty(tester, 'animosite', targetGroups) ? -20 : 0) + (containedSocialPenalty(tester, 'prejuge', targetGroups) ? -10 : 0);
}

/** Libellé lisible du malus psy social (pour la modale de Test), ou undefined si aucun. Ex. « Animosité −20 ». */
export function socialPsychLabel(tester: Combatant, targetGroups: string[]): string | undefined {
  const parts: string[] = [];
  if (containedSocialPenalty(tester, 'animosite', targetGroups)) parts.push('Animosité −20');
  if (containedSocialPenalty(tester, 'prejuge', targetGroups)) parts.push('Préjugé −10');
  return parts.length ? parts.join(' · ') : undefined;
}

/** Un Test (compétence ou caractéristique) relève-t-il de la **Sociabilité** (LDB 21 : malus psy −20/−10) ?
 *  Vrai si la caractéristique sous-jacente est `Soc` (Charme, Marchandage, Intimidation, Commérage…). */
export function isSocialTest(skill?: string, characteristic?: CharKey): boolean {
  if (characteristic) return characteristic === 'sociabilite';
  if (skill) return skillCharKeyById(skill) === 'sociabilite';
  return false;
}

/** Référence de compétence (id stable + spécialisation éventuelle). Type NEUTRE partagé par tout
 *  « poste » où une tâche accepte plusieurs compétences : catalogue d'Activités de voyage, Tests
 *  d'équipage naval (Voile/Ramer, Navigation/Orientation…). */
export interface SkillRef { skillId: string; spec?: string }

/** Descripteur NEUTRE d'un Test « posté » (Activité de voyage/interlude, Scène ou Activité de bataille) :
 *  compétence(s) AU CHOIX, caractéristique de repli, Difficulté, et Test COMBINÉ éventuel. Champs plats,
 *  partagés tels quels par les données JSON — vocabulaire commun, sans logique de résolution attachée. */
export interface TestSpec { skills?: SkillRef[]; char?: CharKey; difficulty?: Difficulty; combined?: boolean }

/** Résultat d'un « Test du meilleur parmi N compétences » pour UN acteur (la compétence retenue + le jet). */
export interface SkillBestResult {
  value: number;
  roll: number;
  target: number;
  sl: number;
  success: boolean;
  /** Compétence effectivement utilisée (la meilleure de l'acteur parmi les options). */
  used?: SkillRef;
}

/** Pour l'acteur donné, prend SA meilleure compétence (spec-aware) parmi `options`, puis lance le Test
 *  (Difficulté + `mod`). Primitive NEUTRE et seedée — « cette personne tente une tâche qui accepte
 *  plusieurs compétences → on utilise celle où elle est la meilleure ». Partagée voyage (Cartographe/
 *  Dessin, Survie/Guérison…) et, à venir, équipage naval (Voile/Ramer…). `options` vide ⇒ Test sur 0. */
export function resolveSkillBest(
  actor: Combatant,
  options: readonly SkillRef[],
  difficulty: Difficulty = 'intermediaire',
  rng: RNG = defaultRNG,
  mod = 0,
): SkillBestResult {
  let bestVal = -Infinity;
  let used: SkillRef | undefined;
  for (const ref of options) {
    const v = testValue(actor, ref.skillId, undefined, ref.spec);
    if (v > bestVal) { bestVal = v; used = ref; }
  }
  const value = Number.isFinite(bestVal) ? bestVal : 0;
  const res = rollTest(value, difficulty, rng, mod);
  return { value, roll: res.roll, target: res.target, sl: res.sl, success: res.success, used };
}

/** Meilleur membre du groupe pour un test donné. `extraMod` ajoute un modificateur PAR acteur (ex. malus
 *  psy de Sociabilité, qui dépend du personnage) — la valeur effective sert au choix ET au résultat.
 *  `sense` (optionnel) : transmis tel quel à `testValue` (sens NARRATIVEMENT sollicité par CE Test précis). */
export function partyBest(
  party: Combatant[],
  skill?: string,
  characteristic?: CharKey,
  extraMod?: (c: Combatant) => number,
  spec?: string, // spécialisation ciblée (Métier (Serrurier)…) — transmise à `testValue` pour la bonne instance
  sense?: PairedSense,
): { actor: Combatant; value: number } | null {
  const r = maxBy(party, (c) => testValue(c, skill, characteristic, spec, sense) + (extraMod?.(c) ?? 0));
  return r ? { actor: r.item, value: r.value } : null;
}

/** Meilleur PJ pour une liste de compétences AU CHOIX (celle qui donne la plus haute valeur décide).
 *  `skills` vide/absent ⇒ une unique option de PURE Caractéristique (`skillId`/`spec` indéfinis).
 *  `sense` (optionnel) : transmis tel quel à `partyBest`/`testValue`. */
export function bestForSkills(
  party: Combatant[],
  skills: SkillRef[] | undefined,
  char: CharKey | undefined,
  sense?: PairedSense,
): { actor: Combatant; value: number; skillId?: string; spec?: string } | null {
  const choices: SkillRef[] = skills?.length ? skills : [{ skillId: undefined as unknown as string, spec: undefined }];
  // Le meilleur ACTEUR par option, puis argmax sur les options (first-max via `maxBy`). Une option
  // ne concourt que si le groupe fournit un porteur (`partyBest` null ⇒ groupe vide ⇒ résultat null).
  const perChoice = choices
    .map((sk) => ({ sk, best: partyBest(party, sk.skillId, char, undefined, sk.spec, sense) }))
    .filter((x): x is { sk: SkillRef; best: { actor: Combatant; value: number } } => x.best !== null);
  const r = maxBy(perChoice, (x) => x.best.value);
  return r ? { actor: r.item.best.actor, value: r.item.best.value, skillId: r.item.sk.skillId, spec: r.item.sk.spec } : null;
}

/** Meilleur PJ pour un Test COMBINÉ de deux compétences (LDB 12 l.202-206) : celui dont le PLUS FAIBLE des
 *  deux (le facteur limitant du Test combiné) est le plus élevé. Renvoie l'acteur + ses deux valeurs. */
export function bestForCombined(
  party: Combatant[],
  sk1: SkillRef,
  sk2: SkillRef,
  char: CharKey | undefined,
): { actor: Combatant; value1: number; value2: number } | null {
  const r = maxBy(party, (c) => Math.min(testValue(c, sk1.skillId, char, sk1.spec), testValue(c, sk2.skillId, char, sk2.spec)));
  if (!r) return null;
  return { actor: r.item, value1: testValue(r.item, sk1.skillId, char, sk1.spec), value2: testValue(r.item, sk2.skillId, char, sk2.spec) };
}

/** Meilleure OPTION pour un acteur parmi un catalogue d'options portant des `skills` : score d'une option =
 *  la MEILLEURE compétence de l'acteur dedans (`bestForSkills([actor], opt.skills).value`), par `testValue`
 *  (= compétence RAW). Argmax via `maxBy`. Le filtrage des options (possession, activités sans Test…) et les
 *  replis restent à la charge de l'appelant. */
export function bestSkilledOption<T extends { skills?: SkillRef[] }>(
  actor: Combatant,
  options: readonly T[],
): { option: T; value: number } | null {
  const r = maxBy(options, (opt) => bestForSkills([actor], opt.skills ?? [], undefined)?.value ?? -Infinity);
  return r ? { option: r.item, value: r.value } : null;
}

/** DÉTAIL d'un Soutien (LDB 12 l.187-200) tel qu'il s'AFFICHE : combien de membres soutiennent et le
 *  bonus total qu'ils octroient. FORME UNIQUE, partagée par le moteur (`partyAssisted`/
 *  `bestAssistedOption`), les pendings qui la portent (`state/pendings.ts`) et la primitive de
 *  breakdown qui la rend en ligne de mod (`ui/breakdown.ts` — `soutienMod`/`supportSplit`). */
export interface SupportDetail {
  count: number;
  bonus: number;
  /** Les SOUTIENS eux-mêmes, par id de Combattant — la provenance du bonus est une STRUCTURE, jamais
   *  un libellé composé. Rendue en micro-chips par `ui/RollLine.tsx` (`ModLine.by`). */
  ids: string[];
}

/** Ligne de mod « Soutien » (LDB 12) — SOURCE UNIQUE : le bonus d'un jet de GROUPE soutenu s'affiche
 *  comme TOUT autre modificateur (ligne du breakdown, verte si +), pas fondu dans la base ni relégué
 *  en sous-titre. `undefined` si personne ne soutient (aucune ligne « Soutien +0 » inventée).
 *  La provenance ne porte QUE des ids : le moteur est pur, et le NOM se résout au RENDU (couture
 *  unique `ui/RollLine.tsx`) — un résolveur à fournir par appelant s'oublie, et l'écran affiche
 *  alors l'id brut (recette B3a, « pregen-101 »). */
export function soutienMod(support?: SupportDetail): ModLine | undefined {
  if (!support || support.count <= 0) return undefined;
  return {
    label: 'Soutien',
    value: support.bonus,
    ref: RULE_REF.soutien,
    by: (support.ids ?? []).map((id) => ({ id })),
  };
}

/** DÉFAIT le Soutien FONDU dans une valeur de jet (`partyAssisted().value` = meneur + bonus) : la base
 *  AFFICHÉE redevient celle du meneur seul et le Soutien reprend sa place de ligne de mod. SOURCE
 *  UNIQUE du geste « base = value − Soutien » que chaque surface soutenue réécrivait (Activité,
 *  Dissipation, Rechargement d'Arme d'équipe, Test de scène, étape de cascade, récap de voyage). */
export function supportSplit(value: number, support?: SupportDetail): { base: number; mods: ModLine[] } {
  const m = soutienMod(support);
  return { base: value - (m?.value ?? 0), mods: m ? [m] : [] };
}

/** Test de GROUPE avec SOUTIEN (LDB 12 l.187-200) — SOURCE UNIQUE de la coopération hors combat : le plus
 *  compétent (`partyBest`) lance, et chaque AUTRE membre ÉLIGIBLE (l.195 ; Test de pure
 *  Caractéristique → tout le monde) le soutient à +10, plafonné au Bonus de la Caractéristique testée du
 *  meneur (`assistBonus`). À utiliser PARTOUT où le groupe œuvre de concert (Test étendu, Tests de scène,
 *  survie/perception en voyage, fouille, dissipation à plusieurs…). Renvoie le meneur, sa valeur SOUTENUE
 *  (Soutien déjà fondu) et le détail (`support`) pour l'affichage. `eligible` : filtre GÉOMÉTRIQUE additionnel
 *  (adjacence, l.196) — voir `soutienBonus`. */
export function partyAssisted(
  party: Combatant[],
  skill?: string,
  characteristic?: CharKey,
  extraMod?: (c: Combatant) => number,
  spec?: string,
  eligible?: (c: Combatant) => boolean,
): { actor: Combatant; value: number; support: SupportDetail } | null {
  const leader = partyBest(party, skill, characteristic, extraMod, spec);
  if (!leader) return null;
  const support = soutienDetail(party, leader.actor, skill, characteristic, spec, eligible);
  return { actor: leader.actor, value: leader.value + support.bonus, support };
}

/** DÉTAIL de SOUTIEN (LDB 12 l.187-200) pour un meneur DONNÉ — SOURCE UNIQUE : combien de membres
 *  soutiennent, le bonus total, et QUI (`ids`). Brique partagée par `partyAssisted` ET les Tests à
 *  sélecteur de candidat (Tests de scène) où le meneur n'est pas le « meilleur » mais le candidat
 *  considéré : +10 par AUTRE membre VIVANT et ÉLIGIBLE (`hasSkillAdvance`, l.195 ; Test de pure
 *  Caractéristique → tous), plafonné au Bonus de la Caractéristique testée du meneur (l.198). `eligible` (l.196, « doit
 *  normalement être adjacent ») : prédicat GÉOMÉTRIQUE optionnel fourni par l'appelant (moteur PUR — la
 *  position/adjacence vit côté état) ; absent = comportement inchangé (aucune géométrie, ex. hors combat).
 *  Le plafond RETIENT les premiers éligibles dans l'ordre du groupe : `ids.length === count`. */
export function soutienDetail(
  party: Combatant[],
  leader: Combatant,
  skill?: string,
  characteristic?: CharKey,
  spec?: string,
  eligible?: (c: Combatant) => boolean,
): SupportDetail {
  const elig = party.filter((c) => c.id !== leader.id && !c.dead
    && (skill ? hasSkillAdvance(c, skill, spec) : true) // LDB 12 l.195
    && (eligible ? eligible(c) : true));
  const ck = effectiveSkillCharKey(leader, skill, { explicit: characteristic, spec });
  const b = assistBonus(elig.length, bonus(effectiveChar(leader, ck)));
  return { count: b / 10, bonus: b, ids: elig.slice(0, b / 10).map((c) => c.id) };
}

/** Bonus de SOUTIEN seul (`soutienDetail().bonus`) — pour les sites qui n'ont qu'un nombre à porter. */
export function soutienBonus(
  party: Combatant[],
  leader: Combatant,
  skill?: string,
  characteristic?: CharKey,
  spec?: string,
  eligible?: (c: Combatant) => boolean,
): number {
  return soutienDetail(party, leader, skill, characteristic, spec, eligible).bonus;
}

/** Meilleur résultat SOUTENU d'un groupe pour une Scène à compétences AU CHOIX (ADE II 8) : pour chaque
 *  option, `partyAssisted(crew, skill…)` (meneur + Soutien LDB 12) ; on garde l'option au plus haut score
 *  soutenu (argmax `maxBy`). `crew` vide ⇒ null. Réutilise `partyAssisted` + `maxBy`. Miroir SOUTENU de
 *  `bestForSkills` : là où celle-ci prend le meilleur PJ SEUL, celle-ci fait coopérer TOUT l'équipage
 *  affecté (les Personnages engagés dans la Scène, ADE II 8 l.153/157) — le meneur lance, les assistants
 *  capables ajoutent +10 chacun (plafonné). L'option de PURE Caractéristique (`skills` vide) reste possible. */
export function bestAssistedOption(
  crew: Combatant[],
  skills: SkillRef[] | undefined,
  char: CharKey | undefined,
): { actor: Combatant; value: number; skillId?: string; spec?: string; support: SupportDetail } | null {
  // Options = les compétences AU CHOIX de la Scène, ou une unique option de PURE Caractéristique (repli
  // char-only, calqué sur `bestForSkills`). Chaque option est résolue en Soutien sur TOUT l'équipage `crew`.
  const options: SkillRef[] = skills?.length ? skills : [{ skillId: undefined as unknown as string, spec: undefined }];
  const perOption = options
    .map((opt) => ({ opt, res: partyAssisted(crew, opt.skillId, char, undefined, opt.spec) }))
    .filter((x): x is { opt: SkillRef; res: NonNullable<ReturnType<typeof partyAssisted>> } => x.res !== null);
  const r = maxBy(perOption, (x) => x.res.value);
  return r
    ? { actor: r.item.res.actor, value: r.item.res.value, skillId: r.item.opt.skillId, spec: r.item.opt.spec, support: r.item.res.support }
    : null;
}
