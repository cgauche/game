/**
 * États (conditions) — Livre de base, chapitre « États ».
 * Gestion minimale pour le combat tactique : ajout, empilement, retrait.
 */
import { Combatant, ActiveEffect } from './types';
import { tickRound } from './duration';
import { conditionLabel } from '../data';
import { t } from '../i18n';
import { rule } from './policy';
import { bleedIgnoreLevel } from './combatFeatures/dispatch';
import { bonus, effectiveChar } from './characteristics';
import { d10, d100, RNG, defaultRNG } from './dice';
import { rollTest, isDoubleRoll, type TestResult } from './tests';
import { dropExpiredGrantedTraits } from './grantedTraits';
import { dropExpiredGrantedResources } from './grantedResources';
import { dropExpiredGrantedWeapons } from './conjuredWeapons';
import { restoreSuppressedPsych } from './psychology';
import { hasActiveFlag } from './activeFlags';
import { applyOps } from './ops'; // cycle runtime (ops→conditions) : applyOps n'est appelé qu'au tick, jamais à l'init du module

/** Les 12 États CANONIQUES (LDB 16) à comportement moteur, par `id` STABLE (slug d'etats.json). Le
 *  moteur (pénalités, fin de Round, récupération) les référence via ces constantes — JAMAIS de chaîne
 *  magique. `ConditionInstance.name` reste OUVERT (string) : le Codex peut créer d'AUTRES États (posés/
 *  affichés ; leur mécanique RAW serait à câbler). Garde-fou de synchro `COND`⇄etats.json : `conditions.test`. */
export const COND = {
  assourdi: 'assourdi', aTerre: 'a-terre', aveugle: 'aveugle', brise: 'brise',
  empetre: 'empetre', empoisonne: 'empoisonne', enFlammes: 'en-flammes', extenue: 'extenue',
  hemorragique: 'hemorragique', inconscient: 'inconscient', sonne: 'sonne', surpris: 'surpris',
} as const;

/** Nombre de pions (cumul) d'un État donné. */
export const stacks = (c: Combatant, name: string) => c.conditions.find((x) => x.name === name)?.value ?? 0;

/**
 * Hook injecté (inversion de dépendance) appelé quand `c` GAGNE un État (nouveau ou empilé) — le
 * moteur reste PUR (il ne connaît ni le store, ni les triggers). Le store le remplit (module feuille)
 * pour câbler le déclencheur `onGainCondition` (Mâchoires d'acier : « chaque fois que vous gagnez un
 * État Sonné »). Absent ⇒ aucune réaction (création de perso, effets hors combat, tests purs).
 */
let onConditionGained: ((c: Combatant, name: string) => void) | undefined;
export function setConditionGainedHook(fn: ((c: Combatant, name: string) => void) | undefined): void {
  onConditionGained = fn;
}

/** Retrait d'États « 1 + DR » borné au nombre de pions présents (LDB 16 : Empêtré l.61,
 *  En flammes l.77, Empoisonné l.70, Sonné l.125, arrêt d'Hémorragie l.107). Un Test raté n'en retire aucun. */
export function recoveredStacks(dr: number, stacks: number, success: boolean): number {
  if (!success || stacks <= 0) return 0;
  return Math.min(stacks, 1 + Math.max(0, dr));
}

export function addCondition(c: Combatant, name: string, value = 1, escapeStrength?: number): void {
  c.advantage = 0; // « Si vous subissez un État quel qu'il soit, vous perdez immédiatement tout Avantage » (LDB 16 l.15)
  const existing = c.conditions.find((x) => x.name === name);
  if (existing) {
    existing.value += value;
    // Force d'évasion (Empêtré « se libérer » — LDB 16 l.61) : sur ré-application, on garde la PLUS
    // CONTRAIGNANTE (max), pour qu'un Enchevêtrement ne soit pas affaibli par un État Empêtré « banal »
    // qui s'empile par-dessus (et inversement, un sort plus fort durcit l'évasion).
    if (escapeStrength != null) existing.escapeStrength = Math.max(existing.escapeStrength ?? 0, escapeStrength);
    // Un ajout NON temporisé sur un État à durée : la durée saute (l'État redevient régi
    // par ses règles normales — on n'écourte jamais un État au prétexte qu'un sort expirait).
    delete existing.roundsLeft;
  } else {
    c.conditions.push({ name, value, ...(escapeStrength != null ? { escapeStrength } : {}) });
  }
  // L'État vient d'être GAGNÉ (nouveau ou empilé) → déclenche `onGainCondition` (Mâchoires d'acier).
  onConditionGained?.(c, name);
}

/** Ajout d'un État À DURÉE (posé par un sort : « 1 État Sonné qui dure N Rounds », LDB).
 *  Sur un État déjà porté : temporisé → durée max conservée ; NON temporisé → inchangé
 *  (la durée du sort ne raccourcit pas un État permanent). */
export function addTimedCondition(c: Combatant, name: string, value: number, rounds: number, escapeStrength?: number): void {
  const existing = c.conditions.find((x) => x.name === name);
  if (existing) {
    c.advantage = 0;
    existing.value += value;
    if (escapeStrength != null) existing.escapeStrength = Math.max(existing.escapeStrength ?? 0, escapeStrength);
    if (existing.roundsLeft != null) existing.roundsLeft = Math.max(existing.roundsLeft, rounds);
    // sinon : instance non temporisée — elle le reste.
    onConditionGained?.(c, name); // État empilé (gagné) → déclenche `onGainCondition`
  } else {
    addCondition(c, name, value, escapeStrength); // (déclenche déjà `onGainCondition`)
    c.conditions.find((x) => x.name === name)!.roundsLeft = rounds;
  }
}

export function removeCondition(c: Combatant, name: string, value = 1): void {
  const existing = c.conditions.find((x) => x.name === name);
  if (!existing) return;
  existing.value -= value;
  if (existing.value <= 0) c.conditions = c.conditions.filter((x) => x.name !== name);
}

export function hasCondition(c: Combatant, name: string): boolean {
  return c.conditions.some((x) => x.name === name);
}

/**
 * Pénalité aux Tests de COMBAT due aux États (LDB ch.16). Non-cumul (l.20) : on
 * applique la pénalité d'UN SEUL État (la plus forte), mais un même État empile
 * (Exténué×3 = -30). Aveuglé/Brisé/Empoisonné/Sonné = -10 ; Exténué = -10/point.
 * (À Terre/Assourdi/Empêtré ne touchent que les Tests de déplacement/audition.)
 */
/** Modificateur GLOBAL de Test porté par les effets actifs (Malédiction de malchance −10, etc.) —
 *  SOMMÉ (sources distinctes qui stackent), appliqué PAR-DESSUS la pénalité d'État (≠ État : ni
 *  non-cumul l.20, ni effacé par `ignoreStatePenalties`). */
export function effectTestMod(c: Combatant): number {
  return (c.activeEffects ?? []).reduce((s, e) => s + (e.testMod ?? 0), 0);
}

export function combatTestPenalty(c: Combatant): number {
  const cand: number[] = [];
  // Endurance de l'anachorète (LDB 42) : « ne subit aucune pénalité causée par les États » —
  // n'efface QUE les pénalités d'État (l'aura Perturbante est un trait, pas un État).
  if (!hasActiveFlag(c, 'ignoreStatePenalties')) {
    if (hasCondition(c, COND.aveugle)) cand.push(-10);
    if (hasCondition(c, COND.brise)) cand.push(-10);
    if (hasCondition(c, COND.empoisonne)) cand.push(-10);
    if (hasCondition(c, COND.sonne)) cand.push(-10);
    const ext = stacks(c, COND.extenue);
    if (ext > 0) cand.push(-10 * ext);
  }
  // Aura d'une créature Perturbante (LDB 85 p.341) : −20 à tous les Tests (non cumulable — flag).
  if (c.perturbed) cand.push(-20);
  const state = cand.length ? Math.min(...cand) : 0;
  return state + effectTestMod(c); // modificateur de Sort (Malédiction de malchance) : STACKE avec l'État
}

/**
 * Pénalité d'États aux Tests HORS COMBAT (LDB ch.16). Non-cumul (l.20 : la PIRE pénalité seule).
 * Couvre les États « à tous les Tests » : Empoisonné (l.66) / Sonné (l.123) −10, Exténué (l.89) −10/pion,
 * Brisé (l.55) −10 SAUF un Test de course (Athlétisme) ou de dissimulation (Discrétion). Les États à
 * portée sensorielle/déplacement (Aveuglé=vue, Assourdi=audition, À Terre/Empêtré=déplacement) ne sont
 * PAS appliqués ici faute de classification du Test (rare hors combat ; raffinement futur).
 */
const BRISE_EXEMPT = new Set(['athletisme', 'discretion']); // course / dissimulation (LDB 16 l.55), par skillId
// Tests « impliquant un déplacement » (LDB 16 l.37/l.85), par skillId. Les Acrobaties (spécialisation de
// Représentation) ne sont pas classables au niveau de l'id de base → non couvertes (rare hors combat).
const MOVEMENT_SKILL = new Set(['athletisme', 'esquive', 'escalade', 'chevaucher', 'natation']);
export function testStatePenalty(c: Combatant, skill?: string): number {
  const effMod = effectTestMod(c); // modificateur de Sort (stacke, hors non-cumul d'État)
  if (!c.conditions?.length) return effMod;
  // Endurance de l'anachorète (LDB 42) : aucune pénalité d'État pour la durée (le modificateur de Sort reste).
  if (hasActiveFlag(c, 'ignoreStatePenalties')) return effMod;
  const cand: number[] = [];
  if (hasCondition(c, COND.empoisonne)) cand.push(-10);
  if (hasCondition(c, COND.sonne)) cand.push(-10);
  const ext = stacks(c, COND.extenue);
  if (ext > 0) cand.push(-10 * ext);
  if (hasCondition(c, COND.brise) && !BRISE_EXEMPT.has(skill ?? '')) cand.push(-10);
  // À Terre / Empêtré : pénalité aux Tests impliquant un déplacement (LDB 16 l.37 / l.85).
  if (MOVEMENT_SKILL.has(skill ?? '')) {
    if (hasCondition(c, COND.aTerre)) cand.push(-20);
    if (hasCondition(c, COND.empetre)) cand.push(-10);
  }
  return (cand.length ? Math.min(...cand) : 0) + effMod;
}

/**
 * Bonus pour TOUCHER en mêlée une cible affectée (LDB ch.16). Non-cumul : meilleur
 * bonus d'un seul État. À Terre/Surpris +20, Aveuglé +10. (Assourdi +10 par le
 * flanc/derrière : non modélisé — l'orientation des combattants n'est pas suivie.)
 */
export function meleeAttackerBonus(target: Combatant): number {
  const cand: number[] = [];
  if (hasCondition(target, COND.aTerre)) cand.push(20);
  if (hasCondition(target, COND.surpris)) cand.push(20);
  if (hasCondition(target, COND.aveugle)) cand.push(10);
  return cand.length ? Math.max(...cand) : 0;
}

/** Une cible Surprise (LDB ch.16 l.132) ou Inconscient (l.112 « rien faire de votre tour »)
 *  ne peut pas se défendre lors d'un Test opposé. */
export function cannotDefend(c: Combatant): boolean {
  return hasCondition(c, COND.surpris) || hasCondition(c, COND.inconscient);
}

/** Sonné : « vous êtes incapable d'effectuer votre Action » (LDB États l.123). Le combattant
 *  peut encore se déplacer (à demi-Mouvement, cf. effectiveMovement) mais ne peut pas agir. */
export function canTakeAction(c: Combatant): boolean {
  return !hasCondition(c, COND.sonne);
}

/** Valeur « brute » du Test de Résistance contre l'État Empoisonné (LDB 16 l.70 : Endurance +
 *  Augmentations de Résistance). SOURCE UNIQUE, partagée par `endOfRound` (jet silencieux) et le
 *  collecteur de cascade des HÉROS (étape influençable) — la difficulté Intermédiaire (+0) et la
 *  pénalité d'États (`combatTestPenalty`) sont appliquées par l'appelant. */
export function poisonResistValue(c: Combatant): number {
  return effectiveChar(c, 'E') + (c.skills?.find((s) => s.skillId === 'resistance')?.advances ?? 0);
}

/** Conséquence d'un Test de Résistance contre l'État Empoisonné (LDB 16 l.70-72) : sur un succès,
 *  retire 1 + DR pions ; une fois tous retirés, 1 État Exténué. PUR (mute `c`, renvoie la ligne de
 *  journal ou null). Partagé par `endOfRound` (ENNEMIS, jet silencieux interne) et l'applier de
 *  cascade `poisonResist` (HÉROS, jet influençable). */
export function poisonResistApply(c: Combatant, success: boolean, sl: number): string | null {
  const poison = stacks(c, COND.empoisonne);
  if (!success || poison <= 0) return null;
  const removed = Math.min(poison, 1 + Math.max(0, sl));
  removeCondition(c, COND.empoisonne, removed);
  const lines = [t('cond.poisonEliminated', { name: c.name, removed })];
  if (!hasCondition(c, COND.empoisonne)) { addCondition(c, COND.extenue); lines.push(t('cond.poisonOvercome', { name: c.name })); }
  return lines.join('\n');
}

/**
 * Fin de Round : dégâts périodiques (Hémorragique/Empoisonné/En flammes) et
 * dissipation des États temporaires (LDB ch.16). Retourne un journal.
 *
 * `opts.skipPoisonResist` : NE roule PAS le Test de Résistance d'Empoisonné (les DÉGÂTS sont
 * appliqués quand même). Posé par le hook `end-of-round` pour un HÉROS → le Test devient une étape
 * de cascade influençable (cf. `collectHeroRoundEndUpkeep`). Les DÉGÂTS restent ici pour tous ; seul
 * le Test est différé. ENNEMIS : `opts` absent → comportement (et ORDRE RNG) inchangé.
 */
export function endOfRound(c: Combatant, rng: RNG = defaultRNG): string[] {
  const log: string[] = [];
  // Hémorragique : 1 Blessure par point, en ignorant les modificateurs (l.104).
  // Endurci (LDB 10) : ignore niveau Point(s) de Blessure perdus par l'État Hémorragique.
  const bleed = Math.max(0, stacks(c, COND.hemorragique) - bleedIgnoreLevel(c));
  if (bleed) {
    loseWounds(c, bleed); // perte de PB centralisée (perte d'Avantage + À Terre à 0)
    log.push(t('cond.bleed', { name: c.name, n: bleed }));
  }
  // Empoisonné : 1 Blessure par point, en ignorant les modificateurs (l.66).
  const poison = stacks(c, COND.empoisonne);
  if (poison) {
    loseWounds(c, poison);
    log.push(t('cond.poisonDmg', { name: c.name, n: poison }));
    // Le Test de Résistance qui ÉLIMINE l'Empoisonné (LDB 16 l.70-72) n'est PLUS ici : c'est un hook
    // `roundBoundary` (`poison-resist`, state/combat/roundHooks) qui décide silence (non-interactif :
    // monstre OU héros en cadence rapide/auto) vs étape de cascade influençable (héros en manuel),
    // via `roundTestInteractive` — exactement comme Mâchoires/Brisé. `endOfRound` ne fait QUE les
    // dégâts périodiques (pur, ignorant du joueur/monstre et de la cadence). Logique partagée :
    // `poisonResistValue`/`poisonResistApply` (helpers purs ci-dessus).
  }
  // En flammes : 1d10 − BE − PA de la localisation la moins protégée (min 1), +1 par État en plus (l.77).
  const fire = stacks(c, COND.enFlammes);
  if (fire) {
    const minPA = Math.min(...Object.values(c.armour));
    // « 1d10+2 si 3 États » (l.77) : le +1/État en plus s'ajoute aux Dégâts AVANT la
    // réduction BE+PA et le plancher de 1 — pas après.
    const dmg = Math.max(1, d10(rng) + (fire - 1) - bonus(effectiveChar(c, 'E')) - minPA);
    loseWounds(c, dmg);
    log.push(t('cond.burnDmg', { name: c.name, n: dmg }));
  }
  // Sonné : Test de Résistance Intermédiaire (+0) en fin de Round ; sur un succès, retire
  // 1 État + 1 par DR ; une fois tous retirés, on gagne 1 Exténué (LDB États l.125-127).
  // Le « -10 à tous les Tests » du Sonné s'applique au jet (l.123, via combatTestPenalty).
  const sonne = stacks(c, COND.sonne);
  if (sonne) {
    const resistVal = effectiveChar(c, 'E') + (c.skills?.find((s) => s.skillId === 'resistance')?.advances ?? 0);
    const res = rollTest(resistVal, 'intermediaire', rng, combatTestPenalty(c));
    if (res.success) {
      const removed = Math.min(sonne, 1 + Math.max(0, res.sl));
      removeCondition(c, COND.sonne, removed);
      log.push(t('cond.stunDissipated', { name: c.name, removed }));
      if (!hasCondition(c, COND.sonne) && !hasCondition(c, COND.extenue)) {
        addCondition(c, COND.extenue);
        log.push(t('cond.stunToExhausted', { name: c.name }));
      }
    } else {
      log.push(t('cond.stunPersists', { name: c.name }));
    }
  }
  // Dissipation en fin de Round : Aveuglé (l.48), Assourdi (l.32), Surpris (l.136).
  for (const n of [COND.aveugle, COND.assourdi, COND.surpris]) {
    if (hasCondition(c, n)) {
      removeCondition(c, n, 1);
      log.push(t('cond.dissipate', { name: c.name, cond: conditionLabel(n) }));
    }
  }
  // Effets RÉCURRENTS portés par un effet actif de sort (op `perRound`) — re-joués tant que l'effet
  // dure (AVANT le décrément : il agit aussi son dernier Round). 1 État X/Round, 1 Ration de
  // « Récolte de Rhya »/Round… Le nombre de répétitions suit roundsLeft (Surincantation de Durée
  // comprise). Snapshot de la liste : les ops récurrentes n'ajoutent pas d'effet actif (cas littéraux).
  for (const e of [...(c.activeEffects ?? [])]) {
    if (!e.opsPerRound || (e.duration.scale === 'rounds' && e.duration.left <= 0)) continue;
    applyOps(c, e.opsPerRound, { label: e.label, rng }).forEach((l) => log.push(l));
  }
  // Décrément des durées (effets/États de sort/contrecoups) — SOURCE UNIQUE extraite, même emplacement
  // qu'avant (fin d'`endOfRound`, après les ops récurrentes). RNG-free.
  tickDurations(c).forEach((l) => log.push(l));
  return log;
}

/**
 * Décrément des DURÉES à la frontière de Round — SOURCE UNIQUE (effets magiques temporisés, États de
 * sort, contrecoups d'incantation en Rounds). Extrait d'`endOfRound` : un seul point décrémente les
 * `roundsLeft`, branché par le hook `tick-durations` (order 15.5, après les dégâts périodiques, avant
 * `refresh-wounds`). RNG-FREE (décrément + filtre + retraits) → n'altère pas le flux déterministe.
 * Rejoué hors combat par `outOfCombatUpkeep` (les durées en Rounds tickent aussi à l'horloge).
 */
export function tickDurations(c: Combatant): string[] {
  const log: string[] = [];
  // Effets magiques temporisés (Bénédictions, Sorts de bonus) : décrément des durées en Rounds.
  // `tickRound` n'agit que sur l'échelle `rounds` ; les durées d'horloge/permanentes sont inertes ici
  // (les premières sont purgées par l'horloge `purgeClockEffects`).
  if (c.activeEffects?.length) {
    for (const e of c.activeEffects) e.duration = tickRound(e.duration);
    const isDone = (e: ActiveEffect) => e.duration.scale === 'rounds' && e.duration.left <= 0;
    const expired = c.activeEffects.filter(isDone);
    for (const e of expired) log.push(t('cond.effectExpire', { name: c.name, label: e.label }));
    c.activeEffects = c.activeEffects.filter((e) => !isDone(e));
    dropExpiredGrantedTraits(c, expired); // traits accordés (op grantTrait) retirés avec leur effet
    dropExpiredGrantedResources(c, expired); // Chance/Destin accordés (gainResource) non dépensés
    dropExpiredGrantedWeapons(c, expired); // armes invoquées/naturelles accordées : loadout recomposé
    restoreSuppressedPsych(c, expired); // Traits psy suspendus (Baume, LDB 42) restitués
  }
  // États à DURÉE posés par un sort (« qui dure N Rounds ») : décrément, dissipation à 0.
  if (c.conditions.some((x) => x.roundsLeft != null)) {
    for (const x of c.conditions) if (x.roundsLeft != null) x.roundsLeft -= 1;
    const done = c.conditions.filter((x) => x.roundsLeft != null && x.roundsLeft <= 0);
    for (const x of done) log.push(t('cond.spellCondExpire', { name: c.name, cond: conditionLabel(x.name) }));
    c.conditions = c.conditions.filter((x) => !(x.roundsLeft != null && x.roundsLeft <= 0));
  }
  // Contrecoups d'incantation à durée en Rounds (tables d'Imparfaites/Colère, LDB 46/40).
  if (c.castPenalties?.some((p) => p.roundsLeft != null)) {
    for (const p of c.castPenalties) if (p.roundsLeft != null) p.roundsLeft -= 1;
    const done = c.castPenalties.filter((p) => p.roundsLeft != null && p.roundsLeft <= 0);
    for (const p of done) log.push(t('cond.effectExpire', { name: c.name, label: p.label }));
    c.castPenalties = c.castPenalties.filter((p) => !(p.roundsLeft != null && p.roundsLeft <= 0));
  }
  return log;
}

/**
 * Cauchemars (trauma psychologique, LDB 21 l.92) : chaque nuit, un Personnage marqué effectue un
 * Test de **Calme Facile (+40)** ; sur un échec, il est en proie à de terribles cauchemars et gagne
 * un État **Exténué**. Pur ; mute `c`, renvoie le journal.
 */
export function nightmareCheck(c: Combatant, rng: RNG = defaultRNG, out?: { base: number; result: TestResult }[]): string[] {
  const calme = effectiveChar(c, 'FM') + (c.skills?.find((s) => s.skillId === 'calme')?.advances ?? 0);
  const res = rollTest(calme, 'facile', rng); // Calme Facile (+40), palier canonique
  out?.push({ base: calme, result: res });
  if (res.success) return [t('cond.nightmareNone', { name: c.name })];
  addCondition(c, COND.extenue);
  return [t('cond.nightmare', { name: c.name })];
}

/**
 * Mort par Hémorragique (LDB 16-États l.105) : « À la fin du Round, vous avez 10 % de chance de mourir
 * par État Hémorragique que vous possédez » (3 pions → mort sur 1-30). « Si vous faites un double sur ce
 * jet, vos blessures coagulent un peu et vous perdez 1 État Hémorragique » — le double prime (pas de mort,
 * mais coagulation). Pur ; renvoie `died` (la finalisation — sauvetage par Destin — revient à l'appelant).
 */
export function bleedDeathRoll(c: Combatant, rng: RNG = defaultRNG): { died: boolean; log: string[] } {
  const n = stacks(c, COND.hemorragique);
  if (n <= 0) return { died: false, log: [] };
  const r = d100(rng);
  if (isDoubleRoll(r)) {
    removeCondition(c, COND.hemorragique, 1); // coagulation (le double prime sur la mort)
    const log = [t('cond.coagulate', { name: c.name, roll: r === 100 ? '00' : r })];
    if (!hasCondition(c, COND.hemorragique)) { addCondition(c, COND.extenue); log.push(t('cond.lastWoundExhausted', { name: c.name })); } // tous retirés → 1 Exténué
    return { died: false, log };
  }
  if (r <= 10 * n) return { died: true, log: [t('cond.bleedDeath', { name: c.name, roll: r, threshold: 10 * n })] };
  return { died: false, log: [] };
}

/** Mort Subite (LDB 18 l.51-54) : sortie directe à 0 PB, sans passer par les Blessures critiques.
 *  Portée réglable (`combat-sudden-death`) — JAMAIS les PJ : 'figurants' (défaut) = figurants seuls ;
 *  'tous' = aussi les PNJ importants ; 'off' = personne (tout passe par les critiques). SOURCE UNIQUE
 *  (consommée par `isOutOfAction` et la résolution de Blessure critique). */
export function usesSuddenDeath(c: Combatant): boolean {
  if (c.kind === 'hero') return false; // jamais pour les PJ (LDB 18 l.54)
  const mode = rule('combat-sudden-death');
  if (mode === 'off') return false;
  if (mode === 'tous') return true;
  return !c.important; // 'figurants' : figurants seulement
}

/** Hors de combat : mort, ou Inconscient, ou figurant tombé à 0 PB (Mort Subite). Un héros à 0 PB
 *  reste actif (À Terre) — il n'est PAS hors de combat (LDB 18-Traumatisme l.28). */
export function isOutOfAction(c: Combatant): boolean {
  return c.dead === true || c.outOfRencontre === true || hasCondition(c, COND.inconscient) || (usesSuddenDeath(c) && c.wounds.current <= 0);
}

/** Condition de mort lente (LDB 18-Traumatisme l.48-49) : Inconscient + 0 PB + (Blessures
 *  critiques > Bonus d'Endurance), et pas déjà mort/éjecté. Suffocation (LDB 18 l.425) :
 *  « au bout d'un nombre de Rounds égal à votre BE, vous mourez » — compteur à 0 = mort
 *  (même canal → un héros à Destin est suspendu, pendingFateSave). */
export function inDeathCondition(c: Combatant): boolean {
  if (c.dead || c.outOfRencontre) return false;
  if (c.suffocationCountdown != null && c.suffocationCountdown <= 0) return true;
  const be = bonus(effectiveChar(c, 'E'));
  return hasCondition(c, COND.inconscient) && c.wounds.current <= 0 && (c.criticalWounds ?? 0) > be;
}

/** À 0 PB : gagne l'État À Terre (LDB 18 l.28). À appeler quand un coup non-critique amène à 0. */
export function applyZeroWounds(c: Combatant): void {
  if (c.wounds.current <= 0 && !hasCondition(c, COND.aTerre)) addCondition(c, COND.aTerre);
}

/**
 * Perte de Blessures CENTRALISÉE avec ses conséquences RAW — à utiliser partout où l'on retire des PB
 * (hors flux d'attaque principal, qui gère déjà l'Avantage et la nuance Critique pour l'À Terre) :
 *  - perdre ≥1 PB → on perd TOUT l'Avantage (LDB 15-Déplacement l.40) ;
 *  - tomber à 0 PB → État À Terre (LDB 18 l.28), sauf déjà Inconscient/mort.
 * Retourne le nombre de PB réellement perdus.
 */
export function loseWounds(c: Combatant, amount: number): number {
  if (amount <= 0 || c.wounds.current <= 0) return 0;
  const lost = Math.min(amount, c.wounds.current);
  c.wounds.current -= lost;
  c.advantage = 0; // perdre une Blessure → perdre tout l'Avantage (LDB 15 l.40)
  if (c.wounds.current <= 0 && !c.dead && !hasCondition(c, COND.inconscient)) applyZeroWounds(c);
  return lost;
}

/**
 * Upkeep de mort en fin de Round (LDB 18 l.28, l.48-49) — héros/importants seulement :
 *  - à 0 PB non soigné : roundsAtZero++ ; après (Bonus d'Endurance) Rounds → Inconscient ;
 *  - Inconscient + 0 PB + (criticalWounds > BE) → mort.
 * Retourne le journal. (`_rng` réservé pour de futurs Tests ; non utilisé ici.)
 */
export function tickDeath(c: Combatant, _rng: RNG = defaultRNG): string[] {
  const log: string[] = [];
  if (c.dead || c.outOfRencontre || usesSuddenDeath(c)) return log;
  const be = bonus(effectiveChar(c, 'E'));
  if (c.wounds.current > 0) {
    c.roundsAtZero = 0;
    return log;
  }
  c.roundsAtZero = (c.roundsAtZero ?? 0) + 1;
  if (c.roundsAtZero > be && !hasCondition(c, COND.inconscient)) {
    addCondition(c, COND.inconscient);
    log.push(t('cond.unconscious', { name: c.name, rounds: c.roundsAtZero }));
  }
  return log; // la mort (dead) est finalisée par le store (avec sauvetage par Destin)
}
