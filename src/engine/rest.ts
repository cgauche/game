/**
 * Repos / nuit de sommeil — récupération hors combat (Livre de base FR).
 * Sources :
 *  - Exténué retiré par le repos (LDB 16 l.92) ; cadence « une nuit = tout retiré » (choix figé, LDB 16 l.100
 *    laisse la vitesse au MJ ; on prend la nuit complète, cohérente avec « une bonne nuit de sommeil »).
 *  - Soin de Blessures (LDB 18 l.296, volet a) : Test de Résistance Accessible (+20) ⇒ DR + Bonus
 *    d'Endurance Points de Blessure regagnés.
 *  - Cauchemars (LDB 21 l.95, exemple Horst) : héros marqué `nightmares` (auteur-assigné, jamais
 *    systémique) ⇒ Test de Calme Facile (+40).
 * Pur : mute `c`, renvoie le journal. Ne dépend que d'autres modules purs du moteur.
 *
 * Soin de Blessures (LDB 18 l.296), DEUX volets cumulés par journée de repos :
 *  - volet a : « une fois par jour… Test de Résistance Accessible (+20)… DR + Bonus d'Endurance » ;
 *  - volet b : « pour chaque journée de repos, vous guérissez ÉGALEMENT le Bonus d'Endurance » (inconditionnel).
 *
 * Faim & Soif (LDB 18 l.338) : « sans nourriture ni boisson… ne peuvent pas récupérer de PB
 * ni se débarrasser de l'Exténué » — un héros AFFAMÉ (`isStarving`, suivi des rations par
 * `engine/provisions.ts`) ne regagne ni PB ni Exténué par le repos (dette levée, #T2).
 *
 * #T3 (cascade d'horloge) : la PROGRESSION des maladies (LDB 20 — incubation/durée en jours
 * CALENDAIRES) et la CONVALESCENCE des traumas (LDB 18 l.317 — « un nombre de jours égal à 30 − BE »)
 * ne dépendent PAS du sommeil : elles sont décomptées par l'entretien quotidien (`state/upkeep.ts`,
 * sur franchissement de jour, quel que soit le chemin — advanceTime, repos, voyage). `restRecovery`
 * ne garde que ce qui dépend du SOMMEIL. `dailyDiseaseUpkeep` (ci-dessous) reste dans ce module
 * (pur) car la réconciliation de l'Exténué « collant » du malaise importe `conditions` — interdit
 * dans `disease.ts` (cycle d'import via characteristics).
 */
import { Combatant, UpkeepDeferTest } from './types';
import { RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import { effectiveChar, bonus } from './characteristics';
import { addCondition, removeCondition, stacks, hasCondition, nightmareCheck } from './conditions';
import { tickDisease, activeMalaiseCount, diseaseBlesseCount, DISEASE_DEFS } from './disease';
import { MINUTES_PER_DAY } from './clock';
import { isStarving, isThirsty, isDeprived } from './provisions';
import { applyHealWounds } from './healing';

/** États à dégâts périodiques qui empêchent un repos réparateur (LDB 16 l.105 : on ne « reprend pas ses
 *  esprits » tant qu'un Hémorragique subsiste — on étend à En flammes/Empoisonné, qu'on ne traverse pas
 *  en dormant ; il faut d'abord stabiliser via Guérison/Sort). */
function unstable(c: Combatant): boolean {
  return hasCondition(c, 'hemorragique') || hasCondition(c, 'en-flammes') || hasCondition(c, 'empoisonne');
}

/** Valeur de Résistance « brute » (E effective + augmentations de Résistance) — formule partagée
 *  repos/entretien (les pénalités d'État ne s'appliquent pas à un Test de récupération passif). */
export function restResistVal(c: Combatant): number {
  return effectiveChar(c, 'endurance') + (c.skills?.find((s) => s.skillId === 'resistance')?.advances ?? 0);
}

/**
 * UNE journée de maladie (LDB 20) pour `c` — appelée par l'entretien quotidien (#T3) à CHAQUE
 * franchissement de jour (repos OU PAS) : fait avancer incubation/durée (`tickDisease`), applique les
 * soins d'un soignant (LDB 09-Compétences : « Pour chaque journée complète… la durée de la maladie est
 * réduite de 1, jusqu'à un minimum de 1 » — −1 jour SUPPLÉMENTAIRE par maladie active), puis réconcilie
 * l'Exténué « collant » du malaise (l.153 : apparition d'une maladie → +1 ; guérison → −1).
 * Mute `c`, renvoie le journal.
 */
export function dailyDiseaseUpkeep(c: Combatant, rng: RNG = defaultRNG, caredFor = false, defer?: UpkeepDeferTest): string[] {
  if (c.dead || !c.diseases?.length) return [];
  const malaiseStart = activeMalaiseCount(c);
  const log = tickDisease(c, MINUTES_PER_DAY, rng, restResistVal(c), defer, bonus(effectiveChar(c, 'endurance')));
  if (caredFor) {
    for (const dz of c.diseases ?? []) {
      // −1 JOUR supplémentaire par maladie active, minimum 1 jour restant (LDB 09-Compétences).
      if (dz.phase === 'active' && dz.minutesLeft > MINUTES_PER_DAY) dz.minutesLeft -= MINUTES_PER_DAY;
    }
  }
  const malaiseDelta = activeMalaiseCount(c) - malaiseStart;
  if (malaiseDelta > 0) addCondition(c, 'extenue', malaiseDelta);
  else if (malaiseDelta < 0) removeCondition(c, 'extenue', -malaiseDelta);
  return log;
}

/**
 * PURGE de maladies par miracle (Jalon 2.6 — Amère catharsis, LDB 42 : « aspire un poison, ou
 * une maladie, de la cible, le retirant complètement de son organisme ») : retire jusqu'à `n`
 * maladies (actives d'abord), avec immunité post-guérison (Vérole Urticante) et réconciliation
 * de l'Exténué « collant » du malaise. Mute `c`, renvoie le journal.
 */
export function cureDiseases(c: Combatant, n: number): string[] {
  if (!c.diseases?.length || n <= 0) return [];
  const log: string[] = [];
  const malaiseStart = activeMalaiseCount(c);
  const order = [...c.diseases].sort((a, b) => (a.phase === 'active' ? 0 : 1) - (b.phase === 'active' ? 0 : 1));
  const removed = new Set(order.slice(0, n));
  c.diseases = c.diseases.filter((d) => !removed.has(d));
  for (const d of removed) {
    log.push(`${c.name} est purgé de : ${d.name}.`);
    if (DISEASE_DEFS[d.name]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), d.name];
  }
  const delta = activeMalaiseCount(c) - malaiseStart;
  if (delta < 0) removeCondition(c, 'extenue', -delta);
  return log;
}

/**
 * Raccourcit la durée d'une maladie ACTIVE de `days` jour(s) (min 1 jour restant). Mute `c`.
 *  - `opts.disease` : SCOPE par id (Gesundheit → une `blessure-purulente` seulement, T2C p.13 ;
 *    Rouille mouchetée → `verole-du-tanneur`, T2C p.14) ; absent = la première maladie active.
 *  - `opts.once` : verrou « une fois par maladie » (Bénédiction de Convalescence, LDB 41 : « ne peut
 *    être tentée qu'une fois par maladie et par personne ») — les herbes (1 dose/jour) se reprennent.
 */
export function blessDiseaseDuration(c: Combatant, days = 1, opts: { disease?: string; once?: boolean } = {}): string[] {
  const dz = (c.diseases ?? []).find((d) => d.phase === 'active'
    && (!opts.disease || d.name === opts.disease)
    && (!opts.once || !d.convalescenceBlessed));
  if (!dz) return [`${c.name} : aucune maladie active à soulager${opts.disease ? ' (ciblée)' : ''}${opts.once ? ' (ou déjà bénie)' : ''}.`];
  if (opts.once) dz.convalescenceBlessed = true;
  dz.minutesLeft = Math.max(MINUTES_PER_DAY, dz.minutesLeft - days * MINUTES_PER_DAY); // −`days` jour(s), min 1 jour restant
  const resteJ = Math.round(dz.minutesLeft / MINUTES_PER_DAY);
  return [`${c.name} : la durée de « ${dz.name} » est réduite de ${days} jour${days > 1 ? 's' : ''} (reste ${resteJ} j).`];
}

/** Jet d'une nuit (bilan structuré de la modale de Repos) : récupération ou cauchemars. */
export interface RestRoll {
  kind: 'recovery' | 'nightmare';
  base: number;
  target: number;
  roll: number;
  sl: number;
  success: boolean;
}

/**
 * Repos de `days` journée(s) pour UN personnage (défaut 1 = « Dormir jusqu'à l'aube »). Par journée :
 * dissipe l'Exténué (sommeil, LDB 16 l.92/100), soigne les PB (LDB 18 l.296 volet a Résistance +20 → DR+BE,
 * ET volet b +BE inconditionnel), puis les cauchemars (LDB 21 l.95) peuvent en regagner un. Réveille un
 * Inconscient et relève un héros À Terre dès qu'il repasse > 0 PB (l.28). Mute `c`, renvoie un résumé.
 * `collect` (modale de Repos) reçoit les JETS structurés (récupération, cauchemars) pour le bilan.
 * (Maladies/convalescence : décomptées par l'entretien quotidien — cf. en-tête #T3.)
 */
/** Cible du Test de récupération d'une nuit (Résistance Accessible +20, LDB 18 l.296 volet a). */
export function recoveryTarget(c: Combatant): number {
  return restResistVal(c) + 20; // Accessible = +20
}

/** Un héros doit-il LANCER le Test de récupération cette nuit ? (Non si mort/éjecté/instable/affamé/PB
 *  plein.) Sépare la DÉCISION du jet (pour différer en cascade) de son application. */
export function needsRecoveryRoll(c: Combatant): boolean {
  return !c.dead && !c.outOfRencontre && !unstable(c) && !isDeprived(c) && c.wounds.current < c.wounds.max;
}

/**
 * Applique UNE journée de récupération à `c` étant donné le JET de Résistance (volet a) — ou `null`
 * si aucun jet n'était requis (PB plein, affamé). Sépare le jet (différable/influençable en cascade)
 * de sa CONSÉQUENCE : dissipation d'Exténué (sommeil, 16 l.91), soin volet a (DR+BE sur réussite) +
 * volet b (+BE inconditionnel, l.380), plafond « blessé » (l.110), réveil (l.28). Mute `c` ; renvoie
 * `{ wokeUp }` (l'appelant journalise — `restRecovery` agrège, la cascade journalise par étape).
 * Partagé par `restRecovery` (eager) et l'applicateur de cascade « recovery » — zéro duplication.
 */
export function applyRecoveryDay(c: Combatant, recoveryRoll: { sl: number; success: boolean } | null): { wokeUp: boolean } {
  if (c.dead || c.outOfRencontre || unstable(c)) return { wokeUp: false };
  const be = bonus(effectiveChar(c, 'endurance'));
  // Faim & Soif (18 l.418) : un héros PRIVÉ (affamé OU assoiffé) ne récupère ni PB ni Exténué naturellement.
  const starving = isDeprived(c);
  // Maladies (LDB 20) : l'Exténué « collant » du malaise (l.153) reste ; chaque « blessé » bloque 1 PB (l.110).
  const malaise = activeMalaiseCount(c);
  const blesse = diseaseBlesseCount(c);
  const fat = stacks(c, 'extenue');
  const removable = starving ? 0 : Math.max(0, fat - malaise);
  if (removable > 0) removeCondition(c, 'extenue', removable);
  const dayStartPB = c.wounds.current;
  // volet a : DR + BE sur réussite (une fois par jour). SOURCE UNIQUE `applyHealWounds` — plafonné
  // par munition Empaleuse logée (LDB 62 l.250) comme les autres chemins ; ni verrou « soin de
  // rencontre » (Guérison seulement) ni réveil ici — le réveil du repos (+ À Terre) reste géré
  // ci-dessous (`applyHealWounds` ne couvre pas À Terre).
  if (!starving && recoveryRoll?.success && c.wounds.current < c.wounds.max)
    applyHealWounds(c, Math.max(0, recoveryRoll.sl) + be, { skillCheck: false, wake: false, log: () => [] });
  // volet b : +BE INCONDITIONNEL.
  if (!starving && c.wounds.current < c.wounds.max) applyHealWounds(c, be, { skillCheck: false, wake: false, log: () => [] });
  // Symptôme « blessé » : la plaie reste ouverte.
  if (blesse > 0) c.wounds.current = Math.max(dayStartPB, c.wounds.current - blesse);
  // Réveil : > 0 PB lève l'Inconscient et relève l'À Terre (l.28). PAS applyHealWounds (soin de rencontre).
  let wokeUp = false;
  if (c.wounds.current > 0) {
    c.roundsAtZero = 0;
    if (hasCondition(c, 'inconscient')) { removeCondition(c, 'inconscient', stacks(c, 'inconscient')); wokeUp = true; }
    if (hasCondition(c, 'a-terre')) removeCondition(c, 'a-terre', stacks(c, 'a-terre'));
  }
  return { wokeUp };
}

export function restRecovery(c: Combatant, rng: RNG = defaultRNG, days = 1, collect?: RestRoll[]): string[] {
  if (c.dead || c.outOfRencontre) return []; // un mort / éjecté ne se repose pas
  // LDB 16 l.105 : un héros qui saigne, brûle ou est empoisonné ne trouve pas le repos — à stabiliser
  // d'abord (Test de Guérison, Sort). Pas de récupération réparatrice tant que ces États subsistent.
  if (unstable(c)) return [`${c.name} ne trouve pas le repos (blessures à stabiliser d'abord — Guérison).`];

  const startPB = c.wounds.current;
  const hadFatigue = stacks(c, 'extenue') > 0;
  let nightmareNights = 0;
  let wokeUp = false;

  for (let d = 0; d < Math.max(1, days); d++) {
    // volet a (l.380) : Test de Résistance Accessible (+20) — lancé seulement si utile (PB < max, non affamé).
    let roll: { sl: number; success: boolean } | null = null;
    if (needsRecoveryRoll(c)) {
      const res = rollTest(restResistVal(c), 'accessible', rng);
      collect?.push({ kind: 'recovery', base: restResistVal(c), target: res.target, roll: res.roll, sl: res.sl, success: res.success });
      roll = { sl: res.sl, success: res.success };
    }
    // Conséquence du jour (dissipation + soin volets a/b + plafond blessé + réveil) — logique PARTAGÉE.
    if (applyRecoveryDay(c, roll).wokeUp) wokeUp = true;
    // Cauchemars (l.92) : une nuit marquée peut regagner un Exténué.
    if (c.nightmares) {
      const before = stacks(c, 'extenue');
      const out: { base: number; result: import('./tests').TestResult }[] = [];
      nightmareCheck(c, rng, out);
      for (const o of out) collect?.push({ kind: 'nightmare', base: o.base, target: o.result.target, roll: o.result.roll, sl: o.result.sl, success: o.result.success });
      if (stacks(c, 'extenue') > before) nightmareNights++;
    }
  }

  const log: string[] = [];
  if (wokeUp) log.push(`${c.name} reprend connaissance.`);
  const healed = c.wounds.current - startPB;
  const span = days > 1 ? `${days} jours de repos` : 'une nuit de repos';
  if (healed > 0) log.unshift(`${c.name} récupère ${healed} PB (${span}).`);
  if (isDeprived(c)) log.push(`${c.name} est ${isStarving(c) && isThirsty(c) ? 'affamé et assoiffé' : isThirsty(c) ? 'assoiffé' : 'affamé'} — pas de récupération naturelle (Faim & Soif).`);
  if (hadFatigue && stacks(c, 'extenue') === 0) log.push(`${c.name} se réveille reposé (Exténué dissipé).`);
  if (nightmareNights > 0) log.push(`${c.name} a fait des cauchemars (${nightmareNights}/${days} nuit${days > 1 ? 's' : ''}) → Exténué.`);
  return log;
}
