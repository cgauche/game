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
import { testStatePenalty } from './conditions';
import { agilityTestPenalty } from './encumbrance';
import { traumaSkillPenalty, passiveSkillSum, passiveTestMod } from './trauma';
import { rule } from './policy';
import { rollTest } from './tests';
import { RNG, defaultRNG } from './dice';
import { effectivePsychTraits } from './psychology';

/** Règles optionnelles « caractéristique alternative » via policy (POINT UNIQUE de la famille) : Métier
 *  comme Savoir → Int (LDB 09 l.352) ; Intimidation → carac réglable F/FM/Int (LDB 09 l.266). Renvoie la
 *  CharKey à utiliser (inchangée si aucune règle ne s'applique). N'opère que sur une COMPÉTENCE nommée.
 *  (Les carac alternatives PAR ENTITÉ — ex. lanceur ogre : Langue (Magick) sur Endurance, ADE II l.653 —
 *  sont portées par la DONNÉE — `SkillInstance.characteristic` — lue par effectiveSkillCharKey en amont,
 *  pas ici : aucun sniff d'espèce dans le moteur.) */
function altCharKey(c: Combatant, skillId: string, ck: CharKey): CharKey {
  if (ck === 'Dex' && skillId === 'metier' && rule('test-metier-int')) return 'Int';
  if (skillId === 'intimidation') {
    const mode = rule('test-intimidation-char') as string;
    if (mode === 'FM' || mode === 'Int') return mode;
    if (mode === 'max') {
      const f = effectiveChar(c, 'F'), fm = effectiveChar(c, 'FM'), i = effectiveChar(c, 'Int');
      return f >= fm && f >= i ? 'F' : fm >= i ? 'FM' : 'Int';
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
  const { explicit, spec, fallback = 'Dex' } = opts;
  if (explicit) return explicit;
  const sk = skillId ? c.skills.find((s) => s.skillId === skillId && (spec == null || s.spec === spec)) : undefined;
  let ck: CharKey = sk?.characteristic ?? (skillId ? skillCharKeyById(skillId) : undefined) ?? fallback;
  if (skillId) ck = altCharKey(c, skillId, ck);
  return ck;
}

/** Valeur de test d'un personnage pour une compétence ou une caractéristique. Mêmes modulations qu'en
 *  combat (le canon ne distingue pas) : Caractéristique EFFECTIVE (buffs magiques + pénalités de
 *  Traumatisme, LDB 18, via `effectiveChar`), pénalités d'États (LDB 16, `testStatePenalty`), pénalité
 *  d'Encombrement sur l'Agilité (LDB 61), port d'armure (LDB 63) et objet Laid sur la Sociabilité (LDB 60). */
export function testValue(c: Combatant, skill?: string, characteristic?: CharKey, spec?: string): number {
  if (!skill && !characteristic) return 0;
  // `skill` = skillId STABLE (multilingue : jamais un libellé). La compétence possédée est trouvée par id ;
  // `spec` cible une spécialisation précise (Savoir (Magie), Métier (Forgeron)…) quand le héros en possède
  // plusieurs avec des avances différentes — sinon (spec absent) la première instance de l'id suffit.
  const sk = skill ? c.skills.find((s) => s.skillId === skill && (spec == null || s.spec === spec)) : undefined;
  // Caractéristique : POINT UNIQUE partagé avec castingValue (carac d'instance data-driven + carac alternative).
  const ck = effectiveSkillCharKey(c, skill, { explicit: characteristic, spec });
  const base = effectiveChar(c, ck);
  const states = testStatePenalty(c, skill);
  const enc = ck === 'Ag' ? agilityTestPenalty(c) : 0; // charge : couche d'ÉTAT orthogonale (≠ passif d'élément)
  const traumaSkill = traumaSkillPenalty(c, skill); // séquelle permanente de fracture (Langue, LDB 18 l.300)
  // Passifs INTRINSÈQUES d'élément (Σ), tous via le collecteur unifié : compétence nommée + port d'armure
  // (`passiveSkillSum` : Groin poilu +10 Pistage, −N% en X du port d'armure) + mods de Test char-qualifiés
  // (`passiveTestMod` : mutation Visage inversé −20 Soc, objet Laid −Soc).
  const passive = passiveSkillSum(c, skill) + passiveTestMod(c, ck);
  // Mods de Test char-QUALIFIÉS d'effets ACTIFS (op `testMod{char}` exécutée — Mystracine « +10 aux
  // Tests d'E et de FM, −10 Ag/I/Int », LDB 71 l.33) : sommés pour la seule carac testée ; les mods
  // GLOBAUX (sans char) sont déjà comptés via `testStatePenalty` (→ effectTestMod).
  const fxChar = (c.activeEffects ?? []).reduce((s, e) => s + (e.testModChar === ck ? (e.testMod ?? 0) : 0), 0);
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

/** Valeur de Test « NUE » d'une compétence : Caractéristique EFFECTIVE (buffs magiques + Traumatisme via
 *  `effectiveChar`) + avances de la compétence, SANS les pénalités d'État/Encombrement/passifs qu'applique
 *  `testValue`. Base des Tests de Psychologie (Calme), généralisant `calmeValue` à TOUTE compétence déclarée
 *  en donnée (`PsychologyData.test.skill`) — fini la valeur de Calme codée en dur dans la couche flux. */
export function skillBaseValue(c: Combatant, skill: string, spec?: string): number {
  const ck = effectiveSkillCharKey(c, skill, { spec });
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

/** Le malus social « contenu » de `type` s'applique-t-il envers `targetGroups` ? (LDB 21) Vrai si le
 *  tester POSSÈDE le trait visant ce groupe ET n'est PAS en état ACTIF pour lui. Le −20/−10 est en effet
 *  l'issue du Test de Psychologie RÉUSSI (Animosité l.22 / Préjugé l.50) — ou, hors combat (pas de Test
 *  modélisé), la manifestation par défaut du trait possédé. En état ACTIF (Test ÉCHOUÉ) ce malus
 *  DISPARAÎT : le personnage est sous compulsion (attaquer l.24 / insulter l.52), pas socialement « contenu ». */
function containedSocialPenalty(tester: Combatant, type: 'animosite' | 'prejuge', targetGroups: string[]): boolean {
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
  if (characteristic) return characteristic === 'Soc';
  if (skill) return skillCharKeyById(skill) === 'Soc';
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
 *  psy de Sociabilité, qui dépend du personnage) — la valeur effective sert au choix ET au résultat. */
export function partyBest(
  party: Combatant[],
  skill?: string,
  characteristic?: CharKey,
  extraMod?: (c: Combatant) => number,
  spec?: string, // spécialisation ciblée (Métier (Serrurier)…) — transmise à `testValue` pour la bonne instance
): { actor: Combatant; value: number } | null {
  let best: { actor: Combatant; value: number } | null = null;
  for (const c of party) {
    const v = testValue(c, skill, characteristic, spec) + (extraMod?.(c) ?? 0);
    if (!best || v > best.value) best = { actor: c, value: v };
  }
  return best;
}

/** Meilleur PJ pour une liste de compétences AU CHOIX (celle qui donne la plus haute valeur décide).
 *  `skills` vide/absent ⇒ une unique option de PURE Caractéristique (`skillId`/`spec` indéfinis). */
export function bestForSkills(
  party: Combatant[],
  skills: SkillRef[] | undefined,
  char: CharKey | undefined,
): { actor: Combatant; value: number; skillId?: string; spec?: string } | null {
  const choices: SkillRef[] = skills?.length ? skills : [{ skillId: undefined as unknown as string, spec: undefined }];
  let picked: { actor: Combatant; value: number; skillId?: string; spec?: string } | null = null;
  for (const sk of choices) {
    const b = partyBest(party, sk.skillId, char, undefined, sk.spec);
    if (b && (!picked || b.value > picked.value)) picked = { actor: b.actor, value: b.value, skillId: sk.skillId, spec: sk.spec };
  }
  return picked;
}

/** Meilleur PJ pour un Test COMBINÉ de deux compétences (LDB 12 l.229) : celui dont le PLUS FAIBLE des
 *  deux (le facteur limitant du Test combiné) est le plus élevé. Renvoie l'acteur + ses deux valeurs. */
export function bestForCombined(
  party: Combatant[],
  sk1: SkillRef,
  sk2: SkillRef,
  char: CharKey | undefined,
): { actor: Combatant; value1: number; value2: number } | null {
  let picked: { actor: Combatant; value1: number; value2: number } | null = null;
  for (const c of party) {
    const v1 = testValue(c, sk1.skillId, char, sk1.spec);
    const v2 = testValue(c, sk2.skillId, char, sk2.spec);
    if (!picked || Math.min(v1, v2) > Math.min(picked.value1, picked.value2)) picked = { actor: c, value1: v1, value2: v2 };
  }
  return picked;
}

/** Test de GROUPE avec SOUTIEN (LDB 12 l.214-225) — SOURCE UNIQUE de la coopération hors combat : le plus
 *  compétent (`partyBest`) lance, et chaque AUTRE membre CAPABLE (qui POSSÈDE la compétence ; Test de pure
 *  Caractéristique → tout le monde) le soutient à +10, plafonné au Bonus de la Caractéristique testée du
 *  meneur (`assistBonus`). À utiliser PARTOUT où le groupe œuvre de concert (Test étendu, Tests de scène,
 *  survie/perception en voyage, fouille, dissipation à plusieurs…). Renvoie le meneur, sa valeur SOUTENUE
 *  (Soutien déjà fondu) et le détail (`support`) pour l'affichage. */
export function partyAssisted(
  party: Combatant[],
  skill?: string,
  characteristic?: CharKey,
  extraMod?: (c: Combatant) => number,
  spec?: string,
): { actor: Combatant; value: number; support: { count: number; bonus: number } } | null {
  const leader = partyBest(party, skill, characteristic, extraMod, spec);
  if (!leader) return null;
  const b = soutienBonus(party, leader.actor, skill, characteristic, spec);
  return { actor: leader.actor, value: leader.value + b, support: { count: b / 10, bonus: b } };
}

/** Bonus de SOUTIEN (LDB 12 l.214-225) pour un meneur DONNÉ — brique partagée par `partyAssisted` ET les
 *  Tests à sélecteur de candidat (Tests de scène) où le meneur n'est pas le « meilleur » mais le candidat
 *  considéré : +10 par AUTRE membre VIVANT et CAPABLE (possède la compétence ; Test de pure Caractéristique
 *  → tous), plafonné au Bonus de la Caractéristique testée du meneur (l.225). */
export function soutienBonus(party: Combatant[], leader: Combatant, skill?: string, characteristic?: CharKey, spec?: string): number {
  const eligible = party.filter((c) => c.id !== leader.id && !c.dead && (skill ? actorHasSkill(c, skill, spec) : true)).length;
  const ck = effectiveSkillCharKey(leader, skill, { explicit: characteristic, spec });
  return assistBonus(eligible, bonus(effectiveChar(leader, ck)));
}
