/**
 * « Entre deux aventures » (LDB 22-23 — Jalon 5) : flux d'interlude.
 *
 * Séquence RAW (ch.22 l.12) : Événement d100 par héros → Activités (« un maximum d'une Activité
 * par semaine, et […] un maximum de trois Activités au total », ch.23 l.6) → « Argent à
 * gaspiller » (ch.23 l.14 : tout l'argent non sécurisé disparaît ; les Revenus sont remis
 * « seulement une fois que vous avez disposé de l'argent de votre dernière aventure », l.179).
 *
 * Arbitrages jeu-sans-MJ (spec 2026-06-11) : la bourse étant PARTY-LEVEL, les pertes d'argent
 * d'événements (`moneyPct`) s'appliquent UNE fois (le pire tirage du groupe) ; le « +1 Chance
 * max » est crédité directement ; la clôture passe par le flux de repos standard (récupération,
 * convalescence, horloge — weeks × 7 jours).
 */
import type { GameState } from './store';
import { battleRng } from './battleRng';
import { d100, roll as rollDice } from '../engine/dice';
import { extendedTestStep, isImpressiveSuccess, isImpressiveFailure, isAstoundingSuccess, isAstoundingFailure } from '../engine/tests';
import { interludeEventFor, type InterludeEventFx } from '../data/interludeEvents';
import { fromBrass, toBrass, formatMoney, priceToMoney, PA_PER_CO, PA_PER_SC } from '../engine/money';
import { itemFromTrappingById, recomputeLoadout, buildWeapon, autoStowNewItem } from '../engine/items';
import { sleepParty } from './restFlow';
import { purgeAdventureEffects } from './upkeep';
import { resetInterruptedFavorProgress } from './favorFlow';
import { confirmBattleActivity, massBattleBegin, battlePrepEntries } from './massBattleFlow';
import {
  craftTarget, craftSpecOf, metierOf, statusIncome, statusIncomeMax, bankWithdrawOutcome, bankPayout, apprenticeshipTutorCost,
  entrainementOptions, entrainementTutorCost,
  ACTIVITIES, activitiesFor, activityById, matchOutcomes, activityAvailableAt, classGatedDifficulty,
  type PriceTier, type ActivityDef,
} from '../engine/activities';
import { applyOps, type GameOp } from '../engine/ops';
import { isFumble } from '../engine/oups';
import { combatValue } from '../engine/combat';
import { spellCost } from '../engine/grimoire';
import { gainCorruption } from './corruptionFlow';
import { fireOwnTestFailed } from './triggeredEffects';
import { applyMiscast } from './combatFlow';
import { buySpell as partyBuySpell } from './partyFlow';
import { testValue } from '../engine/skills';
import { rule } from '../engine/policy';
import { effectiveChar } from '../engine/characteristics';
import type { ChaosAlign, ExposureLevel } from '../engine/corruption';
import { buyTalent as engineBuyTalent, talentCost, buySkillAdvance as engineBuySkillAdvance, buyCharAdvance as engineBuyCharAdvance } from '../engine/advancement';
import { skillCharacteristicById } from '../engine/character';
import { applyTalentAcquisition, fortuneMax, resolveMax, heroMaxWounds } from '../engine/talentEffects';
import { findCareerById, levelsForCareer, findTrappingById, findTalentById, findSpellById, refLabel, skillInstanceLabel, advancementBaseId, qualityRefLabel, qualities } from '../data';
import { findEffectTableById } from '../data/effectTables';
import { findTableEntry } from '../engine/tables';
import { CHAR_LABELS, DIFFICULTY_MODIFIERS, type CharKey, type Combatant, type Difficulty, type QualityInstance, type Availability } from '../engine/types';
import type { PendingBase } from './rollFlowFactory';
import { t } from '../i18n';

import type { Get, Set } from './flowTypes';

export interface InterludeHeroState {
  /** Jet d100 sur le Tableau des Événements (LDB 22). */
  eventRoll: number;
  /** Effets mécaniques de l'événement à consommer par les Activités (Revenus/banque). */
  fx?: InterludeEventFx;
  /** Activités restantes (min(3, semaines) − pertes d'événement/devoir elfique). */
  left: number;
  /** Devoir elfique APPLIQUÉ (règle optionnelle `interlude-elf-duty` active + elfe + ≥3 semaines) —
   *  source UNIQUE de la conséquence : l'UI rend ce drapeau, elle ne re-dérive jamais la règle. */
  elfDuty?: boolean;
  /** A entrepris Revenus — maintient les Niveaux 3-4 (« Avec le pouvoir », ch.23 l.30). */
  didRevenus?: boolean;
  /** Gains de Revenus, crédités APRÈS le gaspillage (ch.23 l.179) — en sous de cuivre. */
  revenueBrass: number;
  /** Artisanat en cours — « Tout travail inachevé peut être conservé » (ch.23 l.92). `trappingId` = id
   *  de l'objet fabriqué ; `atouts`/`defauts` = ids de qualité (runtime). */
  craft?: { trappingId: string; tier: PriceTier; avail: Availability; atouts: string[]; defauts: string[]; drDone: number; drTarget: number; difficulty: Difficulty };
  /** « +10 pour chaque tentative ratée » d'Apprentissage particulier (ch.23 l.63), par talent. */
  learnFails?: Record<string, number>;
  /** Issues d'Activité DIFFÉRÉES à la clôture (États « le premier jour de votre prochaine aventure »,
   *  ACE 12 l.15) — appliquées par `interludeEnd` APRÈS le repos de clôture (un État posé
   *  avant serait dissipé par la récupération des nuits écoulées). */
  closeOps?: GameOp[];
  /** Semer la dissension (LDB 23 l.236-248) : le Test de Ragot (1ʳᵉ des DEUX Activités requises) a
   *  identifié les personnalités influentes du coin — débloque la 2ᵉ Activité (Test de Charme) DANS
   *  CET interlude. Consommé (remis à `false`) à l'issue de la 2ᵉ Activité, succès ou échec. */
  dissensionReady?: boolean;
  /** Faveurs (LDB 23 l.139-151, #509) déjà créditées d'une Activité CET interlude — trace la
   *  « consécutivité » (`Favor.progress`) pour `resetInterruptedFavorProgress` (state/favorFlow). */
  favorProgress?: string[];
}

export interface InterludeState {
  weeks: number;
  phase: 'activities' | 'closing';
  perHero: Record<string, InterludeHeroState>;
}

/** Dépôt bancaire (Opérations bancaires, ch.23 l.154-165 ; `mecenat` = variante d'ACE 12 l.45-49,
 *  retrait résolu par un Test d'Évaluation Intermédiaire) — survit aux interludes et aventures. */
export interface BankDeposit {
  heroId: string;
  kind: 'invest' | 'stash' | 'mecenat';
  /** Montant déposé, en sous de cuivre. */
  brass: number;
  /** Indice d'intérêts (1-10) — taux % ET risque de faillite (invest seulement). */
  rate: number;
  /** Planque liée à une Carte marine (MDG 15 l.292) : sûre tant que le dépositaire GARDE la carte
   *  (sinon découverte sur un jet ≤ `rate`). Absent = planque ordinaire (LDB 23 l.170). */
  chartSecured?: boolean;
}

/** Ouvre l'interlude : événements tirés et appliqués, commandes livrées, écran dédié. */
export function startInterlude(get: Get, set: Set, weeks = 1): void {
  if (get().battle) {
    get().log("Impossible d'ouvrir un interlude en plein combat.");
    return;
  }
  if (get().interlude) return; // déjà ouvert
  const party = get().party.filter((h) => !h.dead);
  if (!party.length) return;
  const w = Math.max(1, Math.floor(weeks));
  const lines: string[] = [`— Entre deux aventures : ${w} semaine${w > 1 ? 's' : ''} —`];
  // L'aventure qui vient de s'achever purge ses effets « pour la prochaine aventure » (LDB 23 l.209/
  // 218/234 — statusMod de Réputation, jetons d'inversion) : cet interlude EST la borne de fin.
  // (Journalise ses propres lignes — pas de double comptage dans `lines`.)
  purgeAdventureEffects(get, set);
  // Passer commande (ch.23 l.170) : « L'objet sera achevé après votre prochaine aventure » —
  // les commandes du cycle précédent sont livrées à l'ouverture de CET interlude.
  for (const o of get().pendingOrders ?? []) {
    const hero = party.find((h) => h.id === o.heroId);
    const it = hero ? itemFromTrappingById(o.trappingId) : null;
    if (hero && it) {
      hero.items = [...(hero.items ?? []), it];
      autoStowNewItem(hero, it); // #204 : rangement par défaut
      recomputeLoadout(hero);
      lines.push(`${hero.name} reçoit sa commande : ${trappingLabelOf(o.trappingId)}.`);
    }
  }
  const baseLeft = Math.min(3, w); // « 1/semaine, max 3 » (ch.23 l.6)
  const perHero: Record<string, InterludeHeroState> = {};
  let worstMoneyPct = 0;
  let bank = get().bank ?? [];
  for (const h of party) {
    const roll = d100(battleRng());
    const ev = interludeEventFor(roll);
    lines.push(`${h.name} — Événement (${roll}) : ${ev.label}. ${ev.text}`);
    let left = baseLeft;
    if (ev.fx?.loseActivity) left -= 1;
    // « les elfes ne perdent une Activité que si la durée est d'au moins trois semaines » (ch.23 l.50).
    // Règle optionnelle (LDB 23 l.48) : le devoir elfique peut être ignoré (désactiver `interlude-elf-duty`).
    const elfDuty = rule('interlude-elf-duty') && /elfe/i.test(h.species ?? '') && w >= 3;
    if (elfDuty) {
      left -= 1;
      lines.push(`${h.name} consacre une Activité au contact des siens (devoir elfique).`);
    }
    if (ev.fx?.moneyPct) worstMoneyPct = Math.min(worstMoneyPct, ev.fx.moneyPct);
    if (ev.fx?.fortuneMaxDelta) {
      h.fortune = (h.fortune ?? 0) + ev.fx.fortuneMaxDelta;
      lines.push(`${h.name} : +${ev.fx.fortuneMaxDelta} Point de Chance (présage).`);
    }
    if (ev.fx?.stashRaided && bank.some((b) => b.heroId === h.id && b.kind === 'stash')) {
      bank = bank.filter((b) => !(b.heroId === h.id && b.kind === 'stash'));
      lines.push(`${h.name} : sa planque a été dévalisée — tout l'argent caché a disparu (Mise à sac).`);
    }
    perHero[h.id] = { eventRoll: roll, fx: ev.fx, left: Math.max(0, left), revenueBrass: 0, ...(elfDuty && { elfDuty }) };
  }
  if (worstMoneyPct < 0) {
    const total = toBrass(get().money);
    const lost = Math.floor((total * -worstMoneyPct) / 100);
    set({ money: fromBrass(Math.max(0, total - lost)) });
    lines.push(`La bourse du groupe perd ${-worstMoneyPct} % (${formatMoney(fromBrass(lost))}) — pire événement appliqué une fois (arbitrage bourse commune).`);
  }
  set({ interlude: { weeks: w, phase: 'activities', perHero }, bank, pendingOrders: [], screen: 'interlude' });
  for (const l of lines) get().log(l);
  set({ party: [...get().party] });
}

// ── Activités (ch.23) — flux de jet par modale (fabrique rollFlow) ────────────────────────────

/** Jet d'Activité en attente (modale) : Revenus / lancer d'Artisanat (Test étendu) / Apprentissage /
 *  Identification d'artefact (ADE II 4) / Activité du CATALOGUE data-driven (`activities.json` —
 *  Convalescence ADE II, Activités d'Altdorf ACE Annexe I). */
export interface PendingActivity extends PendingBase {
  heroId: string;
  /** TOUTES les Activités à jet passent par le CATALOGUE data-driven (`activities.json` + `resolver`). */
  kind: 'catalog';
  label: string;
  skillLabel: string;
  skillValue: number;
  difficulty: Difficulty;
  roll: number | null;
  target: number;
  sl: number;
  success: boolean;
  /** Artisanat : progression du Test étendu (avant ce jet) et cible. */
  drBefore?: number;
  drTarget?: number;
  /** Apprentissage particulier (ch.23 l.58-63) : `id` STABLE du talent visé + coûts (débités MÊME sur échec). */
  talent?: string;
  xpCost?: number;
  tutorBrass?: number;
  /** Identifier un artefact (ADE II) / Tester un objet magique / Entraînement d'arme (ACE) : objet visé
   *  dans l'inventaire du héros. */
  itemUid?: string;
  /** Activité du CATALOGUE (`kind:'catalog'`) : id de l'`ActivityDef` (`activities.json`). */
  activityId?: string;
  /** Recherche universitaire (ACE 12 l.55) : sort à mémoriser IMMÉDIATEMENT (remise = DR × 100 PX). */
  spellId?: string;
  /** Retrait de Mécénat (ACE 12 l.49) : index du dépôt `bank` soldé par le Test d'Évaluation. */
  depositIndex?: number;
  // ── Activité/Scène de BATAILLE de masse (ADE II 8 — contextes 'bataille'/'bataille-round') ──
  /** Activité de bataille : l'issue (delta de Puissance / modificateur de Test) porte sur l'ARMÉE, pas
   *  sur le héros — routée par `confirmActivity` vers le résolveur de bataille. `prep` = Activité de
   *  préparation ('bataille') ; `round` = Scène cinématique d'un Round ('bataille-round'). */
  battle?: 'prep' | 'round';
  /** Modificateur de SITUATION (fondu dans la cible, en LIGNE de mod pour la modale) : Menace −20 (l.219)
   *  ou bonus de Planification (l.75/100). */
  mod?: number;
  modLabel?: string;
  /** Détail du SOUTIEN multi-PJ fondu dans `skillValue` (l.153/157, LDB 12) — affiché en LIGNE de mod. */
  support?: { count: number; bonus: number };
  /** TOUS les PJ engagés dans une Scène/Activité MULTI-PJ (meneur `heroId` compris, l.116-118) — tous
   *  marqués « ayant agi » à la résolution. */
  heroIds?: string[];
  // ── Test COMBINÉ (Infiltration/Repérage, l.75/102 — un jet vs DEUX compétences, LDB 12 l.202-206) ──
  skill2?: string;
  skillValue2?: number;
  target2?: number;
  sl2?: number;
  success2?: boolean;
  /** Niveau du Test combiné : `full` = les deux réussies ; `partial` = une seule ; `fail` = aucune. */
  combinedLevel?: 'full' | 'partial' | 'fail';
  // ── Test OPPOSÉ de « Tenez votre position » (l.161) : l'ennemi oppose son jet FIGÉ ──
  enemyValue?: number;
  enemyRoll?: number;
  /** DR net de l'ennemi au Test opposé de tenue (positif = l'ennemi l'emporte). */
  enemySL?: number;
  forced?: boolean;
  /** Coût en sous de cuivre engagé par CETTE Activité (Réputation, LDB 23 l.228-234 : « le maximum de
   *  vos revenus standards », dépensé MÊME sur échec — calculé à l'ouverture, débité à la résolution). */
  costBrass?: number;
  /** Compétence CHOISIE par le résolveur (au-delà du libellé d'affichage) — Entraînement au Combat
   *  (LDB 23 l.205-209 : Corps à corps OU Projectiles) / Fabuleuse Vente du comte de Punchausen
   *  (AA 12 l.45-49 : Charme OU Divertissement (Narration)) : le jeton d'inversion octroyé SCOPE
   *  cette Compétence. */
  chosenSkill?: string;
  chosenSkillSpec?: string;
}

/** Statut « Échelon Standing » d'un héros (CareerLevelData.status, ex. « Argent 2 »), + modificateur
 *  TEMPORAIRE « pour la prochaine aventure » (LDB 23 l.228-234 « Réputation » : op `statusMod`,
 *  `ActiveEffect.duration.scale === 'adventure'`) — plancher 1 (jamais sous Bronze 1). */
export function heroStatus(h: Combatant): { tier: PriceTier; standing: number } {
  const levels = levelsForCareer(h.career ?? '');
  const lvl = levels[Math.max(0, (h.careerLevel ?? 1) - 1)];
  const m = (lvl?.status ?? 'Bronze 1').match(/^(Bronze|Argent|Or)\s+(\d+)/i);
  const tier = (m?.[1] ?? 'Bronze').toLowerCase() as PriceTier;
  const tempMod = (h.activeEffects ?? []).reduce((s, e) => s + (e.statusMod ?? 0), 0);
  return { tier, standing: Math.max(1, Number(m?.[2] ?? 1) + tempMod) };
}

/** Classe du héros, `id` STABLE (`ClassData.id`) — les événements visent une Classe par id
 *  (`revenueClasses`/`revenueBlockedClasses`, eux aussi en id). Carrière → id de classe. */
export function heroClass(h: Combatant): string {
  return findCareerById(h.career ?? '')?.class ?? '';
}

/** Compétence de carrière « qui permet de Gagner de l'argent » (LDB 08 l.135 : celle en italique
 *  du premier Niveau — l'italique n'est pas dans les données : on prend la première compétence du
 *  Niveau 1 que le héros POSSÈDE, sinon la première listée. Approximation documentée). */
export function incomeSkillOf(h: Combatant): string {
  const lvl1 = levelsForCareer(h.career ?? '')[0];
  const ids = (lvl1?.skills ?? []).map(advancementBaseId).filter((x): x is string => !!x); // AdvancementRef → skillId
  const owned = ids.find((id) => h.skills.some((k) => k.skillId === id));
  return owned ?? ids[0] ?? 'athletisme';
}

const heroState = (s: GameState, heroId: string) => s.interlude?.perHero[heroId];

/** Décrémente le budget d'Activités d'un héros (`interlude.perHero[id].left`) — SOURCE UNIQUE du budget
 *  de downtime (LDB 23 l.6 / ADE II 8 l.65). No-op si aucun interlude / budget épuisé. */
export function consumeActivity(get: Get, set: Set, heroId: string): void {
  const itl = get().interlude;
  const st = itl?.perHero[heroId];
  if (!itl || !st || st.left <= 0) return;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl } });
}

/** Engage un Artisanat (ch.23 l.66) : exige une Compétence Métier (≥1 avance) ; les matériaux
 *  coûtent ¼ du prix listé, payés AVANT (« devront être achetées avant le début de l'Activité »). */
/** Libellé d'affichage d'un trapping de catalogue par id (repli sur l'id). */
const trappingLabelOf = (id: string): string => findTrappingById(id)?.label ?? id;
/** Libellé d'affichage d'une qualité runtime (id → label, ex. « solide » → « Solide »). */
const craftQualLabel = (id: string): string => qualityRefLabel({ id });

export function craftStart(get: Get, set: Set, heroId: string, trappingId: string, atouts: string[], defauts: string[]): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h) return;
  if (st.craft) {
    get().log(`${h.name} a déjà un ouvrage en cours (${trappingLabelOf(st.craft.trappingId)}).`);
    return;
  }
  const metier = metierOf(h);
  if (!metier) {
    get().log(`${h.name} ne possède aucune Compétence Métier — impossible de fabriquer.`);
    return;
  }
  const t = findTrappingById(trappingId);
  if (!t) {
    get().log(`Équipement inconnu : « ${trappingId} ».`);
    return;
  }
  // Gamme/Disponibilité/matériaux : dérivation PARTAGÉE avec le catalogue UI (craftSpecOf).
  const { tier, avail, materialsBrass: materials } = craftSpecOf(t);
  if (toBrass(get().money) < materials) {
    get().log(`Matériaux trop chers (${formatMoney(fromBrass(materials))}) pour la bourse du groupe.`);
    return;
  }
  const target = craftTarget(tier, avail, atouts.length, defauts.length);
  set({ money: fromBrass(toBrass(get().money) - materials) });
  const itl = get().interlude!;
  itl.perHero[heroId] = {
    ...st,
    craft: { trappingId, tier, avail, atouts, defauts, drDone: 0, drTarget: target.dr, difficulty: target.difficulty },
  };
  set({ interlude: { ...itl } });
  get().log(`${h.name} achète les matériaux (${formatMoney(fromBrass(materials))}) et installe son ouvrage : ${t.label} (${target.dr} DR à atteindre, ${skillInstanceLabel(metier)}).`);
}

// ── Catalogue d'Activités data-driven (`activities.json`, contexte 'interlude') ────────────────

/** Lieu courant sur la carte du monde : la place dont la scène EST la scène courante (« Être dans
 *  `scene` = être à ce lieu », worldMap.ts). `null` hors carte — les Activités à gate `where`
 *  (ACE = « à Altdorf ») y sont alors indisponibles. */
export function currentPlaceId(s: Pick<GameState, 'scene' | 'worldMap'>): string | null {
  const sid = s.scene?.id;
  return (sid && s.worldMap?.places.find((p) => p.scene === sid)?.id) || null;
}

/** Activités du catalogue proposables ICI (contexte 'interlude' + gate géographique `where`). Quand une
 *  bataille de masse est en attente de préparation (`massBattle.phase === 'prep'`), les Activités de
 *  PRÉPARATION (contexte 'bataille' + Discours) sont AJOUTÉES au catalogue : « Interlude c'est interlude »,
 *  la préparation de bataille se joue DANS le menu d'Activités, pas sur un écran à part (ADE II 8 l.65 :
 *  budget d'Activités UNIQUE). Le rendu gate les prérequis (Infiltration ⇐ Planification, Sabotage ⇐
 *  Repérage) et l'anti-répétition — cf. `battlePrepEntries`. Sans bataille pendante, catalogue inchangé. */
export function interludeCatalog(s: Pick<GameState, 'scene' | 'worldMap' | 'massBattle'>): ActivityDef[] {
  const place = currentPlaceId(s);
  const base = activitiesFor('interlude').filter((d) => activityAvailableAt(d, place));
  if (s.massBattle?.phase !== 'prep') return base;
  return [...base, ...battlePrepEntries(s.massBattle).map((e) => e.def)];
}

/** Ouvre la modale d'une Activité du CATALOGUE (TOUTES les Activités à jet d'interlude passent ici).
 *  Le Test et ses paramètres viennent de la DONNÉE, dérivés PAR résolveur : compétences « au choix »
 *  → la MEILLEURE de l'acteur ; `masterWeapon` IMPOSE la compétence d'après l'arme visée (« selon la
 *  spécialisation de l'arme », ACE 12 l.21) ; `income` la compétence de carrière ; `craftExtended` le
 *  Métier (+ DR du Test étendu en cours) ; `learnTalent` la Caractéristique/Compétence du Talent
 *  (+10 par tentative ratée) ; `identify` Savoir (Magie). Cibles éventuelles : objet (`itemUid`),
 *  sort (`spellId` — achat immédiat), dépôt (`depositIndex`), Talent (`talentId`). */
export function openCatalogActivity(get: Get, set: Set, heroId: string, activityId: string, opts: { itemUid?: string; spellId?: string; depositIndex?: number; talentId?: string } = {}): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  const def = activityById(activityId);
  if (!st || !h || st.left <= 0 || !def?.contexts.includes('interlude')) return;
  if (!activityAvailableAt(def, currentPlaceId(get()))) {
    get().log(`${def.label} n'est praticable qu'en un lieu précis — pas ici.`);
    return;
  }
  if (def.resolver === 'dissensionEmeute' && !st.dissensionReady) {
    get().log(`${h.name} doit d'abord repérer les personnalités influentes du coin (Semer la dissension — Ragot) avant de soulever la foule.`);
    return;
  }
  let skillLabel: string;
  let skillValue: number;
  // Champs de pending dérivés par résolveur (Test étendu, Talent, item…) — annexés à la fin.
  const extra: Partial<PendingActivity> = {};
  if (def.resolver === 'income') {
    // Revenus (« Gagner de l'argent grâce au Statut », LDB 08 l.107-118) : Test de la Compétence de
    // Carrière « en italique du premier Niveau » (approximée par `incomeSkillOf`). Gate : événement
    // qui bloque les Revenus pour la Classe du héros (Fausse monnaie & co, LDB 22).
    const blocked = st.fx?.revenueBlockedClasses;
    if (blocked && (blocked.includes('*') || blocked.includes(heroClass(h)))) {
      get().log(`${h.name} ne peut pas entreprendre Revenus (événement : ${interludeEventFor(st.eventRoll).label}).`);
      return;
    }
    const skill = incomeSkillOf(h);
    skillValue = testValue(h, skill);
    skillLabel = refLabel('skills', { id: skill });
  } else if (def.resolver === 'craftExtended') {
    // Artisanat (ch.23 l.74-92) : Test ÉTENDU de Métier, DR cumulé par Activité — l'ouvrage doit avoir
    // été engagé (`craftStart` : matériaux ¼ prix + `st.craft`). La Difficulté et la cible de DR
    // viennent de l'ouvrage en cours.
    if (!st.craft) return;
    const metier = h.skills.find((k) => k.skillId === 'metier');
    skillValue = testValue(h, 'metier', undefined, metier?.spec);
    skillLabel = metier ? skillInstanceLabel(metier) : refLabel('skills', { id: 'metier' });
    extra.difficulty = st.craft.difficulty;
    extra.drBefore = st.craft.drDone;
    extra.drTarget = st.craft.drTarget;
    extra.label = `${def.label} — ${trappingLabelOf(st.craft.trappingId)}`;
  } else if (def.resolver === 'learnTalent') {
    // Apprentissage particulier (ch.23 l.66-72) : Talent HORS carrière. Test « Difficile (-20) en
    // utilisant la Caractéristique ou la Compétence la plus pertinente » (sans MJ : la Caractéristique
    // du Maxi du Talent, sinon Int) « +10 pour chaque tentative ratée ». Prix du tuteur : « 2D10
    // pistoles d'argent par 100PX » ; PX + argent gatés AVANT (dépensés MÊME sur échec, cf. resolver).
    const t = opts.talentId ? findTalentById(opts.talentId) : undefined;
    if (!t) { get().log(`Talent inconnu : « ${opts.talentId ?? ''} ».`); return; }
    const xpCost = talentCost(h.talents.find((k) => k.talentId === t.id)?.times ?? 0);
    if ((h.xp ?? 0) < xpCost) {
      get().log(`${h.name} : PX insuffisants (${xpCost} requis pour ${refLabel('talents', { id: t.id })}).`);
      return;
    }
    const tutorBrass = toBrass(apprenticeshipTutorCost(xpCost, battleRng()));
    if (toBrass(get().money) < tutorBrass) {
      get().log(`Le tuteur demande ${formatMoney(fromBrass(tutorBrass))} — la bourse ne suit pas.`);
      return;
    }
    const ck: CharKey = t.max && typeof t.max !== 'number' ? t.max.bonusOf : 'intelligence'; // Maxi « Bonus de X » → carac
    const fails = st.learnFails?.[t.id] ?? 0; // clé = id stable du Talent
    skillValue = effectiveChar(h, ck) + 10 * fails;
    skillLabel = `${CHAR_LABELS[ck]}${fails ? ` (+${fails * 10} d'acharnement)` : ''}`;
    extra.talent = t.id;
    extra.xpCost = xpCost;
    extra.tutorBrass = tutorBrass;
    extra.label = `${def.label} — ${refLabel('talents', { id: t.id })}`;
  } else if (def.resolver === 'masterWeapon') {
    const item = (h.items ?? []).find((i) => i.uid === opts.itemUid);
    if (!item?.requiresMastery || !item.trappingId || (h.masteredWeapons ?? []).includes(item.trappingId)) return;
    // Compétence IMPOSÉE par l'arme visée : valeur de combat RAW avec cette arme (combatValue —
    // Spé du Groupe si possédée). L'arme synthétique n'a pas d'uid retrouvable → le gate de
    // maîtrise est inerte pour le TEST d'entraînement (c'est l'arme qui est inhabituelle, pas la Spé).
    const kind = item.kind === 'ranged' ? ('ranged' as const) : ('melee' as const);
    skillValue = combatValue(h, kind, buildWeapon({ name: item.name, type: kind, damage: item.damage ?? { plusBF: true, flat: 0 }, subType: item.subType }));
    skillLabel = refLabel('skills', { id: kind === 'melee' ? 'corps-a-corps' : 'projectiles' });
  } else if (def.resolver === 'identify') {
    // Identifier un artefact (ADE II 4 l.41) : « Pour d'autres sorciers » (sans le Talent Détection
    // d'artefact) → Test de Savoir (Magie) Intermédiaire (+0). Savoir est AVANCÉE : il faut l'avoir.
    const item = (h.items ?? []).find((i) => i.uid === opts.itemUid);
    if (!item || item.identified !== false) return; // rien à identifier
    const savoir = h.skills.find((k) => k.skillId === 'savoir' && (k.spec ?? '') === 'magie' && k.advances >= 1);
    if (!savoir) {
      get().log(`${h.name} ne possède pas Savoir (Magie) — impossible d'étudier l'artefact (ADE II : la voie des sorciers).`);
      return;
    }
    skillValue = testValue(h, savoir.skillId, undefined, savoir.spec);
    skillLabel = skillInstanceLabel(savoir);
    extra.label = `${def.label} — ${item.name}`;
  } else if (def.resolver === 'combatTraining') {
    // Entraînement au Combat (LDB 23 l.205-209) : « une Compétence de Corps à corps ou Projectiles »
    // au choix du joueur — approximée par la MEILLEURE de l'acteur (convention partagée avec la
    // branche « au choix » ci-dessous) ; le jeton d'inversion octroyé SCOPE cette Compétence.
    const best = (def.skills ?? [])
      .map((ref) => ({ ref, v: testValue(h, ref.skillId, undefined, ref.spec) }))
      .sort((a, b) => b.v - a.v)[0];
    if (!best) return;
    skillValue = best.v;
    skillLabel = refLabel('skills', { id: best.ref.skillId });
    extra.chosenSkill = best.ref.skillId;
    extra.chosenSkillSpec = best.ref.spec;
  } else if (def.resolver === 'punchausen') {
    // Fabuleuse Vente du comte de Punchausen (AA 12 l.45-49) : « Test de Charme Complexe (−10) OU
    // Divertissement (Narration) Intermédiaire (+0) » — au choix du joueur, approximé par la Cible
    // effective la plus favorable (compétence + Difficulté propre à chaque chemin, PAS la même
    // Difficulté partagée que la branche « au choix » générique — chemins hétérogènes).
    const candidates: { skillId: string; spec?: string; difficulty: Difficulty }[] = [
      { skillId: 'charme', difficulty: 'complexe' },
      { skillId: 'divertissement', spec: 'narration', difficulty: 'intermediaire' },
    ];
    const best = candidates
      .map((c) => ({ c, v: testValue(h, c.skillId, undefined, c.spec), target: testValue(h, c.skillId, undefined, c.spec) + DIFFICULTY_MODIFIERS[c.difficulty] }))
      .sort((a, b) => b.target - a.target)[0];
    skillValue = best.v;
    skillLabel = refLabel('skills', { id: best.c.skillId, spec: best.c.spec });
    extra.difficulty = best.c.difficulty;
    extra.chosenSkill = best.c.skillId;
    extra.chosenSkillSpec = best.c.spec;
  } else if (def.resolver === 'knowledgeResearch') {
    // Recherche de savoir (LDB 23 l.220-226) : Savoir Accessible (+20) dans la bonne spécialisation ;
    // « sans la bonne spécialisation […] et que vous êtes instruit » (approximé : possède au moins
    // une avance de Savoir, quelle que soit la spécialisation) → Intelligence Complexe (−10).
    const savoirs = h.skills.filter((k) => k.skillId === 'savoir' && (k.advances ?? 0) > 0);
    if (savoirs.length) {
      const best = savoirs.map((k) => ({ k, v: testValue(h, 'savoir', undefined, k.spec) })).sort((a, b) => b.v - a.v)[0];
      skillValue = best.v;
      skillLabel = skillInstanceLabel(best.k);
      extra.difficulty = 'accessible';
    } else {
      skillValue = effectiveChar(h, 'intelligence');
      skillLabel = CHAR_LABELS.intelligence;
      extra.difficulty = 'complexe';
    }
  } else if (def.resolver === 'reputation') {
    // Réputation (LDB 23 l.228-234) : Test de la Compétence de Carrière (comme Revenus) ; coût =
    // « le maximum de vos revenus standards », dépensé DANS TOUS LES CAS (même sur échec).
    const skill = incomeSkillOf(h);
    skillValue = testValue(h, skill);
    skillLabel = refLabel('skills', { id: skill });
    const { tier, standing } = heroStatus(h);
    const cost = toBrass(statusIncomeMax(tier, standing));
    if (toBrass(get().money) < cost) {
      get().log(`${h.name} : la bourse ne couvre pas la dépense de Réputation requise (${formatMoney(fromBrass(cost))}).`);
      return;
    }
    extra.costBrass = cost;
    extra.label = `${def.label} — ${formatMoney(fromBrass(cost))}`;
  } else {
    // « Au choix » parmi les compétences déclarées : la MEILLEURE de l'acteur (convention partagée
    // avec resolveTravelActivity).
    const best = (def.skills ?? [])
      .map((ref) => ({ ref, v: testValue(h, ref.skillId, undefined, ref.spec) }))
      .sort((a, b) => b.v - a.v)[0];
    if (!best) return;
    skillValue = best.v;
    skillLabel = refLabel('skills', { id: best.ref.skillId });
  }
  if (def.resolver === 'memorizeDiscount') {
    // Achat IMMÉDIAT obligatoire (ACE 12 l.55) : le sort est choisi AVANT le jet — la remise
    // s'appliquera à CET achat seul, à la validation.
    const sp = opts.spellId ? findSpellById(opts.spellId) : undefined;
    if (!sp || !((spellCost(h, sp) ?? 0) > 0)) return;
  }
  if (def.resolver === 'mecenat') {
    const dep = (get().bank ?? [])[opts.depositIndex ?? -1];
    if (dep?.kind !== 'mecenat' || dep.heroId !== heroId) return;
  }
  // Gate de Classe GÉNÉRIQUE (LDB 23 l.197 / AA 12 l.5) — appliquée EN DERNIER, sur la Difficulté
  // effectivement retenue (celle du résolveur si elle en a dérivé une, sinon celle de la donnée).
  const gatedDifficulty = classGatedDifficulty({ difficulty: extra.difficulty ?? def.difficulty, classGate: def.classGate }, h);
  set({
    pendingActivity: {
      heroId, kind: 'catalog', activityId, label: def.label,
      skillLabel, skillValue,
      roll: null, target: 0, sl: 0, success: false,
      ...(opts.itemUid ? { itemUid: opts.itemUid } : {}),
      ...(opts.spellId ? { spellId: opts.spellId } : {}),
      ...(opts.depositIndex != null ? { depositIndex: opts.depositIndex } : {}),
      ...extra,
      difficulty: gatedDifficulty,
    },
  });
}

/** Retrait d'un dépôt de Mécénat (ACE 12 l.57-65) : le dépôt est SOLDÉ, le rendu suit la bande du Test
 *  d'Évaluation (« profit de 20 % » / investissement / moitié / perte). */
function mecenatPayout(get: Get, set: Set, h: Combatant, depositIndex: number, payoutPct: number): string[] {
  const dep = (get().bank ?? [])[depositIndex];
  if (dep?.kind !== 'mecenat') return [];
  set({ bank: (get().bank ?? []).filter((_, i) => i !== depositIndex) });
  const payout = Math.floor((dep.brass * payoutPct) / 100);
  if (payout > 0) set({ money: fromBrass(toBrass(get().money) + payout) });
  return [payout > 0
    ? `${h.name} récupère ${formatMoney(fromBrass(payout))} de son mécénat (${payoutPct} % de ${formatMoney(fromBrass(dep.brass))}).`
    : `${h.name} perd son investissement de mécène (${formatMoney(fromBrass(dep.brass))}).`];
}

/** Issue d'un résolveur d'Activité : les lignes de journal + un `patch` de l'état d'interlude du
 *  héros (deltas NON exprimables en `GameOp` : DR du Test étendu, crédit différé des Revenus,
 *  compteur d'acharnement — fusionnés dans l'écriture finale de `confirmActivity`). */
interface ResolverResult { lines: string[]; patch?: Partial<InterludeHeroState> }

/** Dispatch des résolveurs BESPOKE d'issue d'Activité (`ActivityDef.resolver` + bandes `resolver`) —
 *  chacun RÉUTILISE une logique PURE existante et implémente la règle RAW vérifiée. Le `patch` porte
 *  les deltas d'état d'interlude (le `set` final est fait par `confirmActivity`). */
function runActivityResolver(get: Get, set: Set, resolver: string, pa: PendingActivity, h: Combatant, st: InterludeHeroState): ResolverResult {
  switch (resolver) {
    case 'income': {
      // Revenus = « Gagner de l'argent grâce au Statut » (LDB 08 l.110-118) : « Sur un succès, vous
      // gagnez l'argent indiqué […]. Sur un Échec, vous ne gagnez que la moitié de la somme. Sur un
      // Échec Stupéfiant (-6), […] vous n'avez rien gagné. » Le crédit est DIFFÉRÉ (l.191 : « remis une
      // fois que vous avez disposé de l'argent de votre dernière aventure ») → `revenueBrass`, jamais
      // `money`. Revenus maintient aussi le Statut des Niveaux 3-4 (l.193 → `didRevenus`).
      const outcome = pa.success ? 'success' : isAstoundingFailure(pa.success, pa.sl) ? 'astoundingFail' : 'fail';
      const { tier, standing } = heroStatus(h);
      let brass = toBrass(statusIncome(tier, standing, battleRng(), outcome));
      const lines: string[] = [];
      // Événements : ±% sur les Revenus (Fausse monnaie −20, Profits +50 pour une Classe…, LDB 22).
      if (st.fx?.revenuePct && (!st.fx.revenueClasses || st.fx.revenueClasses.includes(heroClass(h)))) {
        brass = Math.max(0, Math.floor((brass * (100 + st.fx.revenuePct)) / 100));
        lines.push(`Événement (${interludeEventFor(st.eventRoll).label}) : Revenus ${st.fx.revenuePct > 0 ? '+' : ''}${st.fx.revenuePct} %.`);
      }
      lines.push(`${h.name} travaille une semaine : ${formatMoney(fromBrass(brass))} (disponibles à la prochaine aventure).`);
      return { lines, patch: { didRevenus: true, revenueBrass: st.revenueBrass + brass } };
    }
    case 'craftExtended': {
      // Artisanat = Test ÉTENDU de Métier (ch.23 l.78-92) : « les DR obtenus à chaque Round sont
      // additionnés jusqu'à atteindre une valeur cible » (LDB 12 l.174), 1 lancer par Activité —
      // qui progresse (ou régresse) MÊME sur échec. À l'achèvement, l'objet est créé avec ses
      // Atouts/Défauts choisis. Le travail inachevé est conservé (l.102) via `st.craft`.
      if (!st.craft) return { lines: [] };
      const { total: drDone, done } = extendedTestStep(pa.drBefore ?? 0, { success: !!pa.success, sl: pa.sl }, st.craft.drTarget);
      if (done) {
        const it = itemFromTrappingById(st.craft.trappingId);
        if (it) {
          it.qualities = [...(it.qualities ?? []), ...st.craft.atouts.map((id) => ({ id })), ...st.craft.defauts.map((id) => ({ id }))]; // ids → QualityInstance
          h.items = [...(h.items ?? []), it];
          autoStowNewItem(h, it); // #204 : rangement par défaut
          recomputeLoadout(h);
        }
        const atL = st.craft.atouts.map(craftQualLabel), dfL = st.craft.defauts.map(craftQualLabel);
        return {
          lines: [`${h.name} achève son ouvrage : ${trappingLabelOf(st.craft.trappingId)}${atL.length ? ` (${atL.join(', ')})` : ''}${dfL.length ? ` [${dfL.join(', ')}]` : ''} !`],
          patch: { craft: undefined },
        };
      }
      return {
        lines: [`${h.name} avance son ouvrage : ${drDone}/${st.craft.drTarget} DR (${trappingLabelOf(st.craft.trappingId)}).`],
        patch: { craft: { ...st.craft, drDone } },
      };
    }
    case 'learnTalent': {
      // Apprentissage particulier (ch.23 l.66-72) : « Sur un succès, vous avez appris le Talent. Sinon,
      // vous avez échoué […] et gagnez un modificateur de +10 pour chaque tentative ratée » ; « dépensant
      // en vain des PX et de l'argent » → argent du tuteur ET PX consommés MÊME sur échec.
      const talentId = pa.talent;
      if (!talentId) return { lines: [] };
      const talentLabel = refLabel('talents', { id: talentId });
      set({ money: fromBrass(Math.max(0, toBrass(get().money) - (pa.tutorBrass ?? 0))) }); // tuteur payé dans TOUS les cas
      if (pa.success) {
        const fortuneBefore = fortuneMax(h);
        const resolveBefore = resolveMax(h);
        const r = engineBuyTalent(h, talentId); // débite les PX + acquiert le Talent
        if (r.ok) {
          applyTalentAcquisition(h, talentId);
          h.wounds.max = heroMaxWounds(h); // Dur à cuire & co
          h.wounds.current = Math.min(h.wounds.current, h.wounds.max);
          h.fortune = (h.fortune ?? 0) + (fortuneMax(h) - fortuneBefore); // Chanceux
          h.resolve = (h.resolve ?? 0) + (resolveMax(h) - resolveBefore); // Obstiné
          return { lines: [`${h.name} apprend ${talentLabel} hors carrière (−${r.cost} PX + ${formatMoney(fromBrass(pa.tutorBrass ?? 0))} de tuteur — Apprentissage particulier).`] };
        }
        return { lines: [] };
      }
      h.xp = Math.max(0, (h.xp ?? 0) - (pa.xpCost ?? 0)); // PX perdus en vain (échec)
      const learnFails = { ...(st.learnFails ?? {}) };
      learnFails[talentId] = (learnFails[talentId] ?? 0) + 1; // clé = id stable du Talent, +10 à la reprise
      return {
        lines: [`${h.name} échoue à apprendre ${talentLabel} — PX et argent dépensés en vain ; +10 à la prochaine tentative.`],
        patch: { learnFails },
      };
    }
    case 'identify': {
      // Identifier un artefact magique (ADE II 4 l.43-52) — table de DR complète, mappée sur le modèle
      // `identified`/`magicKnown`/`suspectedQualities` :
      //   +6 ou plus (Stupéfiant) : identifie parfaitement + TOUTES ses Particularités.
      //   +4 à +5 (Impressionnant) : identifie l'objet et sait s'il a des Particularités.
      //   +2 à +3 (Succès) : identifie l'objet, voit les Particularités visibles (pas les cachées).
      //   0 à +1 (Succès Minime) : identifie l'objet ET découvre UNE Particularité cachée.
      //   0 à -1 (Échec Minime) : incapable d'identifier, conscient de l'échec.
      //   -2 à -3 (Échec) : confond l'artefact avec un type similaire.
      //   -4 à -5 (Échec Impressionnant) : soupçonne UNE Particularité qu'il n'a pas.
      //   -6 ou moins (Échec Stupéfiant) : soupçonne AU MOINS DEUX Particularités qu'il n'a pas.
      const it = (h.items ?? []).find((i) => i.uid === pa.itemUid);
      if (!it) return { lines: [] };
      if (pa.success) {
        it.identified = true; // « le Personnage est capable d'identifier l'objet » (tout succès l'identifie)
        if (isImpressiveSuccess(pa.success, pa.sl)) {
          // +4 ou plus : sait s'il a des Particularités — le Stupéfiant (+6) les révèle TOUTES.
          it.magicKnown = true;
          delete it.suspectedQualities;
          return { lines: [isAstoundingSuccess(pa.success, pa.sl)
            ? `${h.name} identifie parfaitement ${it.name} : TOUTES ses Particularités sont révélées (Succès Stupéfiant).`
            : `${h.name} identifie ${it.name} et sait s'il possède des Particularités.`] };
        }
        if (pa.sl <= 1) {
          // 0 à +1 (Succès Minime) : identifie l'objet ET découvre UNE Particularité cachée (RAW).
          it.magicKnown = true;
          delete it.suspectedQualities;
          return { lines: [`${h.name} identifie ${it.name} et découvre une Particularité cachée (Succès Minime).`] };
        }
        // +2 à +3 : identifie l'objet, connaît les Particularités visibles, pas les cachées.
        return { lines: [`${h.name} identifie ${it.name} : il en connaît les Particularités visibles, mais pas les cachées.`] };
      }
      // Échec : les rangs Impressionnant/Stupéfiant ancrent 1 / au moins 2 FAUSSES Particularités.
      if (isImpressiveFailure(pa.success, pa.sl)) {
        const fakes = falseQualities(it, isAstoundingFailure(pa.success, pa.sl) ? 2 : 1);
        if (fakes.length) {
          it.suspectedQualities = [...new Set([...(it.suspectedQualities ?? []), ...fakes])];
          return { lines: [`${h.name} confond ${it.name} avec un objet similaire et le croit doté de « ${fakes.join(' » et « ')} » — certitude(s) erronée(s).`] };
        }
        return { lines: [`${h.name} confond ${it.name} avec un objet similaire — la semaine est perdue.`] };
      }
      // -2 à -3 (Échec, l.50) : confond l'artefact avec un type d'objet SIMILAIRE (méprise sur sa nature ; pas de fausse Particularité).
      if (pa.sl <= -2) {
        return { lines: [`${h.name} confond ${it.name} avec un objet d'un type similaire — il se méprend sur sa nature (Échec).`] };
      }
      // 0 à -1 (Échec Minime, l.49) : incapable d'identifier, mais conscient de son échec, sans se tromper sur la nature.
      return { lines: [`${h.name} n'identifie pas ${it.name} cette semaine — il en est conscient (l'étude peut reprendre).`] };
    }
    case 'wrathOfTheGods':
      // « réalisez un Test sur le Tableau de la Colère des Dieux […] à la place » (ACE 12 l.15) —
      // point d'entrée hors-Prière sur la table existante (engine/miscast).
      return { lines: applyMiscast(get, set, h, 'colere') };
    case 'masterWeapon': {
      const it = (h.items ?? []).find((i) => i.uid === pa.itemUid);
      if (!it?.trappingId) return { lines: [] };
      h.masteredWeapons = [...new Set([...(h.masteredWeapons ?? []), it.trappingId])];
      return { lines: [`${h.name} a maîtrisé ${it.name} (ACE p.219).`] };
    }
    case 'identifyByResearch': {
      // ACE 12 l.33-42 : ≥ +4 DR = étude en profondeur (plein potentiel + dangers) ; succès ≤ +3 =
      // fonction principale — mappés sur le modèle EXISTANT identified/magicKnown (comme l'ADE II).
      const it = (h.items ?? []).find((i) => i.uid === pa.itemUid);
      if (!it) return { lines: [] };
      if (pa.sl >= 4) {
        it.identified = true;
        it.magicKnown = true;
        delete it.suspectedQualities;
        return { lines: [`${h.name} étudie ${it.name} en profondeur : Particularités et dangers révélés.`] };
      }
      if (pa.success) {
        it.magicKnown = true;
        return { lines: [`${h.name} cerne la fonction principale de ${it.name} et son activation.`] };
      }
      return { lines: [] };
    }
    case 'memorizeDiscount': {
      if (!pa.spellId) return { lines: [] };
      // « Chaque +DR vous permet de mémoriser un sort pour 100PX de moins […] vous devez acheter le
      // sort immédiatement » (ACE 12 l.55) : remise = DR × 100, appliquée à CET achat seul par buySpell.
      const r = partyBuySpell(get, set, h.id, pa.spellId, { discountXp: Math.max(0, pa.sl) * 100 });
      if (r.ok && r.chaos) return { lines: gainCorruption(get, set, h, 1) }; // sort du Chaos : +1 Corruption (LDB 51)
      return { lines: [] };
    }
    case 'combatTraining': {
      // Entraînement au Combat (LDB 23 l.205-209) : « sur un succès, vous pouvez inverser un Test de
      // la Compétence associée une fois pendant votre prochaine aventure » — jeton d'inversion SCOPÉ
      // (op existant, MÊME canal que « Observer une cible »).
      if (!pa.chosenSkill) return { lines: [] };
      const skillLabel = refLabel('skills', { id: pa.chosenSkill, spec: pa.chosenSkillSpec });
      if (!pa.success) return { lines: [`${h.name} peine à retrouver ses réflexes de combat (${skillLabel}) cette semaine — aucun bénéfice.`] };
      return { lines: applyOps(h, [{ op: 'grantReverseToken', skill: pa.chosenSkill, ...(pa.chosenSkillSpec ? { spec: pa.chosenSkillSpec } : {}) }], { rng: battleRng(), label: pa.label }) };
    }
    case 'punchausen': {
      // Fabuleuse Vente du comte de Punchausen (AA 12 l.45-49) : « vous recevez 2d10 pistoles et […]
      // vous pouvez inverser les dés sur un Test de Charme ou de Divertissement (Narration) » — même
      // canal de jeton que « Entraînement au Combat », SCOPÉ à la Compétence utilisée pour la vente.
      if (!pa.success || !pa.chosenSkill) return { lines: [`${h.name} ne trouve aucun imprimeur intéressé cette semaine — l'Activité échoue.`] };
      const pistoles = rollDice(2, 10, battleRng());
      const gainBrass = pistoles * PA_PER_SC;
      set({ money: fromBrass(toBrass(get().money) + gainBrass) });
      const tokenLines = applyOps(h, [{ op: 'grantReverseToken', skill: pa.chosenSkill, ...(pa.chosenSkillSpec ? { spec: pa.chosenSkillSpec } : {}) }], { rng: battleRng(), label: pa.label });
      return { lines: [`${h.name} vend son récit à un imprimeur : ${formatMoney(fromBrass(gainBrass))}.`, ...tokenLines] };
    }
    case 'reputation': {
      // Réputation (LDB 23 l.228-234) : coût dépensé DANS TOUS LES CAS ; +1 Standing sur succès (+2 sur
      // Succès Stupéfiant, DR ≥ 6), −1 sur Échec Stupéfiant (DR ≤ −6) — op `statusMod` existant,
      // durée `{scale:'adventure'}` déjà portée par l'op (purgée à l'interlude suivant).
      set({ money: fromBrass(Math.max(0, toBrass(get().money) - (pa.costBrass ?? 0))) });
      const lines = [`${h.name} dépense ${formatMoney(fromBrass(pa.costBrass ?? 0))} pour soigner sa Réputation.`];
      const delta = isAstoundingSuccess(pa.success, pa.sl) ? 2 : pa.success ? 1 : isAstoundingFailure(pa.success, pa.sl) ? -1 : 0;
      if (delta !== 0) lines.push(...applyOps(h, [{ op: 'statusMod', amount: delta }], { rng: battleRng(), label: pa.label }));
      else lines.push(`${h.name} a juste gaspillé son argent.`);
      return { lines };
    }
    case 'dissensionScout': {
      // Semer la dissension (LDB 23 l.236-248), 1ʳᵉ des DEUX Activités requises : Ragot Accessible
      // pour repérer les personnalités influentes du coin — débloque la 2ᵉ Activité (Charme) CETTE
      // interlude ; aucun effet mécanique en soi (pas de GameOp : la 2ᵉ Activité seule agit).
      if (!pa.success) return { lines: [`${h.name} ne repère aucune personnalité influente cette semaine — l'Activité échoue.`] };
      return { lines: [`${h.name} identifie les personnalités influentes du coin — prêt à tenter de soulever la foule contre une cible.`], patch: { dissensionReady: true } };
    }
    case 'dissensionEmeute': {
      // Semer la dissension, 2ᵉ Activité (Charme) : consomme `dissensionReady` dans TOUS les cas.
      // « Pendant votre prochaine aventure, vous pouvez tenter un Test de Charme pour rassembler une
      // foule contre la même cible » (l.244) — capacité NARRATIVE (aucune Difficulté chiffrée, « fixée
      // par le MJ selon la constitution de la foule ») : AUCUNE Scène de mobilisation de foule n'existe
      // dans le moteur pour porter cet appel à une future Scène — mesuré, non fabriqué (#508).
      if (!pa.success) return { lines: [`${h.name} ne parvient pas à attiser la colère de la foule contre sa cible — l'Activité échoue.`], patch: { dissensionReady: false } };
      return {
        lines: [
          `${h.name} déchaîne le courroux des habitants contre sa cible.`,
          `Pendant la prochaine aventure, ${h.name} pourra tenter de rassembler cette foule contre la même cible (Test de Charme, Difficulté selon la constitution de la foule) — non modélisé : aucune Scène de mobilisation de foule n'existe encore dans le moteur.`,
        ],
        patch: { dissensionReady: false },
      };
    }
    case 'contremaitre': {
      // Remaniement du contremaître (AA 12 l.51-61) : Test de Ragot pour localiser l'ancien associé —
      // en cas de succès, tire les TROIS tables du Générateur de mission (l.63-144, `tables.json`).
      // La mission elle-même (Test de Corps à corps/Projectiles Complexe, objet + Blessure Critique
      // HORS dégâts de combat) exigerait une couture « Blessure Critique isolée » absente du moteur
      // (les Blessures Critiques sont posées par la résolution de DÉGÂTS de combat, jamais hors
      // combat) — mesuré, non fabriqué (#510).
      if (!pa.success) return { lines: [`${h.name} ne trouve aucun ancien associé prêt à l'aiguiller cette semaine — l'Activité échoue.`] };
      const rng = battleRng();
      const lieu = findTableEntry(findEffectTableById('contremaitre-lieu').rows, d100(rng));
      const objectif = findTableEntry(findEffectTableById('contremaitre-objectif').rows, d100(rng));
      const perso = findTableEntry(findEffectTableById('contremaitre-personnalite').rows, d100(rng));
      return {
        lines: [
          `${h.name} obtient les détails d'une mission : ${lieu.label ?? ''} Objectif : ${objectif.label ?? ''} Commanditaire : ${perso.label ?? ''}`,
          `La mission elle-même (Test de Corps à corps ou Projectiles Complexe (−10) ; objet convoité + Blessure Critique) exige une résolution de Blessure Critique HORS dégâts de combat — non modélisée (mesure #510).`,
        ],
      };
    }
    default:
      return { lines: [] };
  }
}

/** Fausses Particularités (ADE II : échec Impressionnant/Stupéfiant — « soupçonne que l'objet possède
 *  une/au moins deux Particularité(s) qu'il n'a pas réellement ») : Atouts plausibles du registre,
 *  hors qualités réellement portées par l'objet. */
function falseQualities(item: { kind: string; qualities: QualityInstance[] }, count: number): string[] {
  const have = new Set(item.qualities.map((q) => q.id)); // qualités RÉELLEMENT portées (par id)
  const pool = qualities
    .filter((q) => q.type === 'atout')
    .filter((q) => (item.kind === 'armor' ? q.subType !== 'arme' : q.subType !== 'armure'))
    .filter((q) => !have.has(q.id)) // dédup par ID (corrige le bug : comparait un libellé à un tableau d'ids)
    .map((q) => q.label);
  const out: string[] = [];
  while (out.length < count && pool.length) {
    const i = (d100(battleRng()) - 1) % pool.length; // tirage registre (biais négligeable — pur cosmétique)
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** Passer commande (ch.23 l.167-172) : objet de rareté Exotique payé MAINTENANT, « achevé après
 *  votre prochaine aventure » (livré à l'ouverture du prochain interlude). 1 objet par Activité. */
export function orderItem(get: Get, set: Set, heroId: string, trappingId: string): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h || st.left <= 0) return;
  const t = findTrappingById(trappingId);
  if (!t) {
    get().log(`Équipement inconnu : « ${trappingId} ».`);
    return;
  }
  if (t.availability !== 'Exotique' && t.availability !== 'ND') {
    get().log(`${t.label} (${t.availability ?? '?'}) s'achète chez un marchand — Passer commande sert aux objets Exotiques.`);
    return;
  }
  const price = toBrass(priceToMoney(t.price));
  if (toBrass(get().money) < price) {
    get().log(`Commande trop chère (${formatMoney(fromBrass(price))}).`);
    return;
  }
  set({ money: fromBrass(toBrass(get().money) - price), pendingOrders: [...(get().pendingOrders ?? []), { heroId, trappingId: t.id }] });
  const itl = get().interlude!;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl } });
  get().log(`${h.name} passe commande : ${t.label} (${formatMoney(fromBrass(price))}) — livraison après la prochaine aventure.`);
}
/** Entraînement (ch.23 l.130-136) : « vous entraîner dans une Compétence ou une Caractéristique en
 *  dehors de votre Carrière » — PAS de Test (achat direct comme Passer commande/Banque). Coût en PX
 *  NORMAL (hors carrière, déjà doublé par `advanceCost`/`buyCharAdvance`/`buySkillAdvance`, LDB 07 l.91)
 *  + tuteur 1D10 sc (doublé pour une Compétence Avancée, l.135). `opt` recalculée ICI depuis les
 *  données du héros (`entrainementOptions`) — jamais fait confiance à un id client non revérifié.
 *  Une Compétence de Base hors carrière encore inconnue est ACQUISE à 0 Augmentation puis augmentée
 *  (même geste que `buySkillAdvance`, LDB 09 l.42). */
export function entrainementStart(get: Get, set: Set, heroId: string, kind: 'skill' | 'characteristic', id: string, spec?: string): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h || st.left <= 0) return;
  const opt = entrainementOptions(h).find((o) => o.kind === kind && o.id === id && (o.spec ?? '') === (spec ?? ''));
  if (!opt) {
    get().log(t('if.entrainementUnknown', { name: h.name }));
    return;
  }
  if ((h.xp ?? 0) < opt.xpCost) {
    get().log(t('if.entrainementXpKo', { name: h.name, cost: opt.xpCost, label: opt.label }));
    return;
  }
  const tutor = toBrass(entrainementTutorCost(opt.advanced, battleRng()));
  if (toBrass(get().money) < tutor) {
    get().log(t('if.entrainementTutorKo', { cost: formatMoney(fromBrass(tutor)) }));
    return;
  }
  const fortuneBefore = fortuneMax(h);
  const resolveBefore = resolveMax(h);
  const r = kind === 'characteristic'
    ? engineBuyCharAdvance(h, id as CharKey, false)
    : (() => {
        if (!h.skills.some((k) => k.skillId === id && (k.spec ?? '') === (spec ?? ''))) {
          h.skills.push({ skillId: id, spec, characteristic: skillCharacteristicById(id), advances: 0 });
        }
        return engineBuySkillAdvance(h, id, spec, false);
      })();
  if (!r.ok) {
    get().log(t('if.entrainementRefused', { name: h.name, label: opt.label, reason: r.reason ?? '' }));
    return;
  }
  set({ money: fromBrass(toBrass(get().money) - tutor) });
  h.wounds.max = heroMaxWounds(h); // Résistance/Endurance : le max de Blessures peut augmenter
  h.wounds.current = Math.min(h.wounds.current, h.wounds.max);
  h.fortune = (h.fortune ?? 0) + (fortuneMax(h) - fortuneBefore); // Sociabilité (Chance/Fortune)
  h.resolve = (h.resolve ?? 0) + (resolveMax(h) - resolveBefore); // Volonté (Résilience/Détermination)
  const itl = get().interlude!;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl }, party: [...get().party] });
  get().log(t('if.entrainementDone', { name: h.name, label: opt.label, cost: r.cost, tutor: formatMoney(fromBrass(tutor)) }));
}

/** Applique le jet d'Activité confirmé (consomme l'Activité). CHEMIN UNIQUE data-driven :
 *  l'issue vient de la DONNÉE de l'`ActivityDef` — bandes `outcomes`/`onSuccess` (GameOp + `resolver`
 *  de bande) OU `resolver` DIRECT (Revenus/Artisanat/Apprentissage/Identification, sans table). Les
 *  `patch` des résolveurs sont ACCUMULÉS puis fusionnés dans l'unique écriture finale. */
export function confirmActivity(get: Get, set: Set): void {
  const pa = get().pendingActivity;
  if (!pa || pa.roll == null || !pa.activityId) return;
  // Activité/Scène de BATAILLE de masse (ADE II 8) : l'issue porte sur l'ARMÉE (application distincte
  // par `confirmBattleActivity`, canal de jet identique). BUDGET UNIQUE (l.65 : « comme à l'accoutumée,
  // ils ne peuvent participer qu'à un maximum de trois Activités ») : une prépa de bataille EST une
  // Activité d'interlude → elle DÉCRÉMENTE `interlude.perHero[id].left` comme toute Activité. Les Scènes
  // de Round (`battle === 'round'`) sont HORS budget downtime (illimitées par Round) — jamais décomptées.
  if (pa.battle) {
    // Budget partagé (l.65) : une préparation (`'prep'`) EST une Activité d'interlude → refuser en AMONT
    // si le héros n'a plus de créneau (comme le chemin interlude via `st.left <= 0` plus bas), sinon l'issue
    // s'appliquerait « gratuitement » (`consumeActivity` no-op à 0). Les Scènes de Round (`'round'`) hors budget.
    if (pa.battle === 'prep' && (get().interlude?.perHero[pa.heroId]?.left ?? 0) <= 0) {
      set({ pendingActivity: null });
      return;
    }
    set({ pendingActivity: null });
    confirmBattleActivity(get, set, pa);
    if (pa.battle === 'prep') {
      consumeActivity(get, set, pa.heroId);
      // #257 (flag `interlude-assist-costs-activity`, LDB 23 l.5 / ADE II 8 l.65/l.81) : les
      // assistants d'une Entreprise SOUTENUE dépensent aussi un créneau. `consumeActivity` no-op à 0.
      if (rule('interlude-assist-costs-activity')) {
        for (const hid of pa.heroIds ?? []) if (hid !== pa.heroId) consumeActivity(get, set, hid);
      }
    }
    return;
  }
  const itl = get().interlude;
  const st = itl?.perHero[pa.heroId];
  const h = get().party.find((x) => x.id === pa.heroId);
  const def = activityById(pa.activityId);
  set({ pendingActivity: null });
  if (!itl || !st || !h || st.left <= 0 || !def) return;
  const lines: string[] = [];
  const closeOps: GameOp[] = [];
  let patch: Partial<InterludeHeroState> = {};
  // Maladresse d'Activité (LDB 12 : double raté) — porte les bandes `on:'fumble'` (Pénitence :
  // Colère des dieux « à la place », ACE 12 l.15).
  const fumble = isFumble(pa.roll, pa.success);
  // Résolveur DIRECT (pas de table d'issues) : Revenus/Artisanat/Apprentissage/Identification —
  // ils agissent/consomment MÊME sur échec (RAW). Les résolveurs de BANDE restent dans la boucle.
  if (def.resolver && !def.outcomes?.length && !def.onSuccess?.length) {
    const r = runActivityResolver(get, set, def.resolver, pa, h, st);
    lines.push(...r.lines);
    if (r.patch) patch = { ...patch, ...r.patch };
  } else {
    // Défs à TABLE d'issues (bandes de DR) ou binaires (`onSuccess`, ex. Convalescence) — même chemin.
    const bands = def.outcomes?.length
      ? matchOutcomes(def, { success: pa.success, sl: pa.sl, fumble })
      : pa.success && def.onSuccess?.length ? [{ ops: def.onSuccess }] : [];
    if (fumble && def.outcomes?.some((b) => b.on === 'fumble')) lines.push(`${h.name} — MALADRESSE (${pa.roll}) !`);
    for (const band of bands) {
      if (band.note) lines.push(band.note); // résultat VERBATIM de la table source
      // Les ÉTATS d'issue tombent à la CLÔTURE de l'interlude (règle de CLASSE du contexte : les
      // semaines ne s'écoulent qu'à la fermeture, et le repos de clôture dissiperait un État posé
      // maintenant — « vous subissez 1 État Exténué le premier jour de votre prochaine aventure »,
      // ACE 12 l.15). Le reste (Péché, Exposition, soins…) s'applique tout de suite.
      const immediate = (band.ops ?? []).filter((o) => o.op !== 'condition');
      closeOps.push(...(band.ops ?? []).filter((o) => o.op === 'condition'));
      if (immediate.length) {
        lines.push(...applyOps(h, immediate, {
          rng: battleRng(), label: def.label, now: get().gameTime,
          onCorruption: (n: number, align?: ChaosAlign) => gainCorruption(get, set, h, n, align),
          onCorruptionExposure: (level: ExposureLevel, skill?: 'resistance' | 'calme') => {
            set({ pendingCorruption: { heroId: h.id, level, skill: skill ?? 'resistance', skillLocked: skill != null, menace: 'corruption' } });
            return [`${h.name} — Test d'Exposition ${level} à la Corruption à réaliser.`];
          },
        }));
      }
      if (band.payoutPct != null && pa.depositIndex != null) lines.push(...mecenatPayout(get, set, h, pa.depositIndex, band.payoutPct));
      if (band.resolver) {
        const r = runActivityResolver(get, set, band.resolver, pa, h, st);
        lines.push(...r.lines);
        if (r.patch) patch = { ...patch, ...r.patch };
      }
    }
  }
  // SEAM `onOwnTestFailed` (chemin JOUEUR hors combat — Activité d'interlude) : un Test d'Activité RATÉ émet
  // le trigger (Crampes abdominales : rate l'Artisanat → Sonné, MSRC 16 l.152). AVANT l'écriture UNIQUE : les
  // mutations Sonné (palier 1/3) sont captées par l'écriture party ci-dessous, aucun set brut de plus.
  // CADENCE-AWARE : `set` threadé → le sous-Test de FM (palier 2) d'un héros s'ouvre en MODALE de jet scène
  // (`routeTriggeredTest` hors combat), jamais inline (« un jet = une modale » vaut hors combat) ; la modale
  // ouverte ici SURVIT à l'écriture interlude/party finale (clés disjointes). PNJ/auto → inline (early-out sinon).
  if (!pa.success) lines.push(...fireOwnTestFailed(get, pa.heroId, { sl: pa.sl, rng: battleRng(), set }));
  // Écriture UNIQUE : consomme l'Activité + fusionne closeOps différés + patch des résolveurs.
  itl.perHero[pa.heroId] = {
    ...st,
    left: st.left - 1,
    ...(closeOps.length ? { closeOps: [...(st.closeOps ?? []), ...closeOps] } : {}),
    ...patch,
  };
  set({ interlude: { ...itl }, party: [...get().party] });
  for (const l of lines) get().log(l);
}

/** Opérations bancaires (ch.23 l.154-165) — dépôt (1 Activité). Invest : Statut Or/Argent.
 *  `mecenat` (ACE 12 l.49) : variante d'Opération bancaire — « au moins 5 CO » (minInvest de
 *  la donnée), gate géographique de l'Activité ; le retrait se résout par un Test d'Évaluation. */
export function bankDeposit(get: Get, set: Set, heroId: string, kind: 'invest' | 'stash' | 'mecenat', amountBrass: number, rate?: number): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h || st.left <= 0) return;
  if (kind === 'invest' && heroStatus(h).tier === 'bronze') {
    get().log(`${h.name} : « Vous devez être des échelons Or et Argent pour épargner dans une banque ».`);
    return;
  }
  if (kind === 'mecenat') {
    const def = ACTIVITIES.find((a) => a.resolver === 'mecenat');
    if (!def || !activityAvailableAt(def, currentPlaceId(get()))) return;
    const min = (def.minInvest?.gold ?? 0) * PA_PER_CO;
    if (Math.floor(amountBrass) < min) {
      get().log(`Mécénat : mise minimale ${formatMoney(fromBrass(min))} (« au moins 5 CO », ACE p.220).`);
      return;
    }
  }
  const amount = Math.max(1, Math.floor(amountBrass));
  if (toBrass(get().money) < amount) {
    get().log('La bourse du groupe ne couvre pas ce dépôt.');
    return;
  }
  let deposited = amount;
  const lines: string[] = [];
  // Fausse monnaie (LDB 22) : « perdront 20 % de l'argent placé ».
  if (st.fx?.bankPct) {
    deposited = Math.max(0, Math.floor((deposited * (100 + st.fx.bankPct)) / 100));
    lines.push(`Événement : ${st.fx.bankPct} % sur l'argent placé (${interludeEventFor(st.eventRoll).label}).`);
  }
  const r = kind === 'invest' ? Math.max(1, Math.min(10, rate ?? d100(battleRng()) % 10 + 1)) : 0;
  set({ money: fromBrass(toBrass(get().money) - amount), bank: [...(get().bank ?? []), { heroId, kind, brass: deposited, rate: r }] });
  const itl = get().interlude!;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl } });
  lines.push(kind === 'invest'
    ? `${h.name} investit ${formatMoney(fromBrass(deposited))} (Indice d'intérêts ${r} — ${r} % de gains, faillite sur ≤ ${r}).`
    : kind === 'mecenat'
      ? `${h.name} sponsorise un dramaturge prometteur : ${formatMoney(fromBrass(deposited))} (retrait par Test d'Évaluation Intermédiaire — Mécénat, ACE p.220).`
      : `${h.name} planque ${formatMoney(fromBrass(deposited))} (retrait libre — découverte sur ≤ 10).`);
  // Émeutes (LDB 22) : « les dépôts des banques réputées doivent vérifier immédiatement la faillite ».
  if (kind === 'invest' && st.fx?.bankCrashCheck) {
    lines.push(...bankWithdrawInner(get, set, get().bank.length - 1, true));
  }
  for (const l of lines) get().log(l);
}

/** Retrait (invest : coûte 1 Activité, « Retirer des fonds nécessite une autre Activité » l.157 ;
 *  planque : libre, l.159). Le d100 est journalisé (résolution directe — pas un Test de compétence). */
export function bankWithdraw(get: Get, set: Set, index: number): void {
  const dep = (get().bank ?? [])[index];
  if (!dep) return;
  if (dep.kind === 'mecenat') {
    // Retrait de Mécénat (ACE 12 l.49) = 1 Activité résolue par un Test d'Évaluation Intermédiaire :
    // la modale d'Activité applique la bande (payoutPct) et consomme l'Activité à la validation.
    const def = ACTIVITIES.find((a) => a.resolver === 'mecenat');
    if (def) openCatalogActivity(get, set, dep.heroId, def.id, { depositIndex: index });
    return;
  }
  if (dep.kind === 'invest') {
    const st = heroState(get(), dep.heroId);
    if (!st || st.left <= 0) {
      get().log('Retirer un investissement exige une Activité.');
      return;
    }
    const itl = get().interlude!;
    itl.perHero[dep.heroId] = { ...st, left: st.left - 1 };
    set({ interlude: { ...itl } });
  }
  for (const l of bankWithdrawInner(get, set, index, false)) get().log(l);
}

function bankWithdrawInner(get: Get, set: Set, index: number, crashCheckOnly: boolean): string[] {
  const dep = (get().bank ?? [])[index];
  if (!dep || dep.kind === 'mecenat') return []; // Mécénat : soldé par le Test d'Évaluation (bande payoutPct)
  const h = get().party.find((x) => x.id === dep.heroId);
  const roll = d100(battleRng());
  // Planque de Carte marine (MDG 15 l.292) : « en sûreté tant que vous gardez la carte » → tant que le
  // dépositaire PORTE encore une carte-marine, le trésor n'est pas à découvert ; il ne l'est (jet ≤ rate)
  // que si la carte est perdue/volée.
  const chartHeld = !!h?.items?.some((it) => it.trappingId === 'carte-marine');
  const outcome = dep.chartSecured && chartHeld ? 'ok' : bankWithdrawOutcome(dep.kind, dep.rate, roll);
  const rest = (get().bank ?? []).filter((_, i) => i !== index);
  if (outcome === 'lost') {
    set({ bank: rest });
    const threshold = dep.kind === 'invest' ? dep.rate : (dep.rate > 0 ? dep.rate : 10);
    return [`${h?.name ?? '?'} — ${roll} ≤ ${threshold} : ${dep.kind === 'invest' ? 'la banque a fait faillite' : 'la planque a été découverte'} — ${formatMoney(fromBrass(dep.brass))} perdus !`];
  }
  if (crashCheckOnly) return [`Vérification de faillite (émeutes) — ${roll} > ${dep.rate} : la banque tient bon.`];
  const payout = bankPayout(dep.kind, dep.brass, dep.rate);
  set({ bank: rest, money: fromBrass(toBrass(get().money) + payout) });
  return [`${h?.name ?? '?'} récupère ${formatMoney(fromBrass(payout))} (${roll}${dep.kind === 'invest' ? ` > ${dep.rate}, intérêts ${dep.rate} %` : ''}).`];
}

/** Clôture : « Avec le pouvoir » (Niveaux 3-4 sans Revenus → −1 Niveau, ch.23 l.30), Argent à
 *  gaspiller (l.14), crédit des Revenus (l.179), puis le temps passe (repos standard). */
export function interludeEnd(get: Get, set: Set): void {
  const itl = get().interlude;
  if (!itl) return;
  // Issues d'Activité DIFFÉRÉES (« le premier jour de votre prochaine aventure », ACE 12 l.15) —
  // capturées avant de fermer, appliquées APRÈS le repos de clôture (cf. plus bas).
  const deferred = get().party
    .map((h) => ({ h, ops: itl.perHero[h.id]?.closeOps ?? [] }))
    .filter((x) => x.ops.length > 0 && !x.h.dead);
  const lines: string[] = [];
  for (const h of get().party) {
    const st = itl.perHero[h.id];
    if (!st) continue;
    if ((h.careerLevel ?? 1) >= 3 && !st.didRevenus) {
      h.careerLevel = (h.careerLevel ?? 1) - 1;
      lines.push(`${h.name} a négligé ses responsabilités (pas de Revenus) : retour au Niveau ${h.careerLevel} de sa Carrière (« Avec le pouvoir »).`);
    }
  }
  const wasted = toBrass(get().money);
  if (wasted > 0) {
    lines.push(`L'argent restant (${formatMoney(get().money)}) est dépensé, bu, parié ou donné — en totalité (Argent à gaspiller).`);
  }
  let revenue = 0;
  for (const h of get().party) revenue += itl.perHero[h.id]?.revenueBrass ?? 0;
  set({ money: fromBrass(revenue) });
  if (revenue > 0) lines.push(`Les Revenus de la période sont disponibles : ${formatMoney(fromBrass(revenue))}.`);
  // Faveurs (LDB 23 l.149, #509) : la « consécutivité » se mesure à l'interlude (arbitrage
  // maison, voir favorFlow) — reset AVANT de refermer l'interlude, pendant qu'il est encore lisible.
  resetInterruptedFavorProgress(get, set);
  set({ interlude: null, screen: 'campaign', party: [...get().party] });
  for (const l of lines) get().log(l);
  // Le temps de l'interlude s'écoule (récupération, convalescence, horloge — moteur de nuit
  // unique). `fedDaily` : la vie en ville (gîte ET couvert) est couverte par l'Argent à
  // gaspiller — la Faim RAW ne s'applique pas à la période (LDB 23, « le coût de la vie »).
  sleepParty(get, set, itl.weeks * 7, { fedDaily: true });
  // Issues DIFFÉRÉES à la clôture (États « le premier jour de votre prochaine aventure », ACE 12 l.15) :
  // posées APRÈS le repos de clôture — un État posé avant serait dissipé par la récupération.
  if (deferred.length) {
    const after: string[] = [];
    for (const { h, ops } of deferred) after.push(...applyOps(h, ops, { rng: battleRng(), now: get().gameTime }));
    set({ party: [...get().party] });
    for (const l of after) get().log(l);
  }
  // Bataille en attente de préparation à la clôture de l'interlude (ADE II 8) : la fin de l'interlude
  // ENGAGE la bataille (transition vers les Rounds avec les bonus de prépa acquis). `massBattleBegin`
  // rebascule sur l'écran de bataille. Une bataille sans prépa faite démarre au Round 1 sans bonus.
  if (get().massBattle?.phase === 'prep') {
    massBattleBegin(get, set);
    set({ screen: 'massBattle' });
  }
}
