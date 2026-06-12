/**
 * Repos / nuit de sommeil — récupération hors combat (Livre de base FR).
 * Sources :
 *  - Exténué retiré par le repos (16-États l.91) ; cadence « une nuit = tout retiré » (choix figé, l.102
 *    laisse la vitesse au MJ ; on prend la nuit complète, cohérente avec « une bonne nuit de sommeil »).
 *  - Soin de Blessures (18-Traumatisme l.380, volet a) : Test de Résistance Accessible (+20) ⇒ DR + Bonus
 *    d'Endurance Points de Blessure regagnés.
 *  - Cauchemars (21-Psychologie l.92) : héros marqué ⇒ Test de Calme Facile (+40) ou Exténué regagné.
 * Pur : mute `c`, renvoie le journal. Ne dépend que d'autres modules purs du moteur.
 *
 * Soin de Blessures (18-Traumatisme l.380), DEUX volets cumulés par journée de repos :
 *  - volet a : « une fois par jour… Test de Résistance Accessible (+20)… DR + Bonus d'Endurance » ;
 *  - volet b : « pour chaque journée de repos, vous guérissez ÉGALEMENT le Bonus d'Endurance » (inconditionnel).
 *
 * Faim & Soif (18-Traumatisme l.418) : « sans nourriture ni boisson… ne peuvent pas récupérer de PB
 * ni se débarrasser de l'Exténué » — un héros AFFAMÉ (`isStarving`, suivi des rations par
 * `engine/provisions.ts`) ne regagne ni PB ni Exténué par le repos (dette levée, #T2).
 *
 * ⚠️ #T3 (cascade d'horloge) : la PROGRESSION des maladies (LDB 20 — incubation/durée en jours
 * CALENDAIRES) et la CONVALESCENCE des traumas (LDB 18 l.317 — « un nombre de jours égal à 30 − BE »)
 * ne dépendent PAS du sommeil : elles sont décomptées par l'entretien quotidien (`state/upkeep.ts`,
 * sur franchissement de jour, quel que soit le chemin — advanceTime, repos, voyage). `restRecovery`
 * ne garde que ce qui dépend du SOMMEIL. `dailyDiseaseUpkeep` (ci-dessous) reste dans ce module
 * (pur) car la réconciliation de l'Exténué « collant » du malaise importe `conditions` — interdit
 * dans `disease.ts` (cycle d'import via characteristics).
 */
import { Combatant } from './types';
import { RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import { effectiveChar, bonus } from './characteristics';
import { addCondition, removeCondition, stacks, hasCondition, nightmareCheck } from './conditions';
import { tickDisease, activeMalaiseCount, diseaseBlesseCount, DISEASE_DEFS } from './disease';
import { isStarving } from './provisions';

/** États à dégâts périodiques qui empêchent un repos réparateur (LDB 16 l.105 : on ne « reprend pas ses
 *  esprits » tant qu'un Hémorragique subsiste — on étend à En flammes/Empoisonné, qu'on ne traverse pas
 *  en dormant ; il faut d'abord stabiliser via Guérison/Sort). */
function unstable(c: Combatant): boolean {
  return hasCondition(c, 'Hémorragique') || hasCondition(c, 'En flammes') || hasCondition(c, 'Empoisonné');
}

/** Valeur de Résistance « brute » (E effective + augmentations de Résistance) — formule partagée
 *  repos/entretien (les pénalités d'État ne s'appliquent pas à un Test de récupération passif). */
export function restResistVal(c: Combatant): number {
  return effectiveChar(c, 'E') + (c.skills?.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
}

/**
 * UNE journée de maladie (LDB 20) pour `c` — appelée par l'entretien quotidien (#T3) à CHAQUE
 * franchissement de jour (repos OU PAS) : fait avancer incubation/durée (`tickDisease`), applique les
 * soins d'un soignant (LDB 09-Compétences : « Pour chaque journée complète… la durée de la maladie est
 * réduite de 1, jusqu'à un minimum de 1 » — −1 jour SUPPLÉMENTAIRE par maladie active), puis réconcilie
 * l'Exténué « collant » du malaise (l.153 : apparition d'une maladie → +1 ; guérison → −1).
 * Mute `c`, renvoie le journal.
 */
export function dailyDiseaseUpkeep(c: Combatant, rng: RNG = defaultRNG, caredFor = false): string[] {
  if (c.dead || !c.diseases?.length) return [];
  const malaiseStart = activeMalaiseCount(c);
  const log = tickDisease(c, 1, rng, restResistVal(c));
  if (caredFor) {
    for (const dz of c.diseases ?? []) {
      if (dz.phase === 'active' && dz.daysLeft > 1) dz.daysLeft -= 1;
    }
  }
  const malaiseDelta = activeMalaiseCount(c) - malaiseStart;
  if (malaiseDelta > 0) addCondition(c, 'Exténué', malaiseDelta);
  else if (malaiseDelta < 0) removeCondition(c, 'Exténué', -malaiseDelta);
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
  if (delta < 0) removeCondition(c, 'Exténué', -delta);
  return log;
}

/**
 * Bénédiction de Convalescence (LDB 41 : « réduire la durée d'une maladie dont elle est affligée
 * d'une journée. Cette Prière ne peut être tentée qu'une fois par maladie et par personne ») :
 * −`days` jour(s) (min 1) sur la première maladie ACTIVE non encore bénie. Mute `c`.
 */
export function blessDiseaseDuration(c: Combatant, days = 1): string[] {
  const dz = (c.diseases ?? []).find((d) => d.phase === 'active' && !d.convalescenceBlessed);
  if (!dz) return [`${c.name} : aucune maladie active à soulager (ou déjà bénie).`];
  dz.convalescenceBlessed = true;
  dz.daysLeft = Math.max(1, dz.daysLeft - days);
  return [`${c.name} : la durée de « ${dz.name} » est réduite de ${days} jour${days > 1 ? 's' : ''} (reste ${dz.daysLeft} j).`];
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
 * dissipe l'Exténué (sommeil, 16-États l.91/102), soigne les PB (l.380 volet a Résistance +20 → DR+BE,
 * ET volet b +BE inconditionnel), puis les cauchemars (21 l.92) peuvent en regagner un. Réveille un
 * Inconscient et relève un héros À Terre dès qu'il repasse > 0 PB (l.28). Mute `c`, renvoie un résumé.
 * `collect` (modale de Repos) reçoit les JETS structurés (récupération, cauchemars) pour le bilan.
 * (Maladies/convalescence : décomptées par l'entretien quotidien — cf. en-tête #T3.)
 */
export function restRecovery(c: Combatant, rng: RNG = defaultRNG, days = 1, collect?: RestRoll[]): string[] {
  if (c.dead || c.outOfRencontre) return []; // un mort / éjecté ne se repose pas
  // LDB 16 l.105 : un héros qui saigne, brûle ou est empoisonné ne trouve pas le repos — à stabiliser
  // d'abord (Test de Guérison, Sort). Pas de récupération réparatrice tant que ces États subsistent.
  if (unstable(c)) return [`${c.name} ne trouve pas le repos (blessures à stabiliser d'abord — Guérison).`];

  const be = bonus(effectiveChar(c, 'E'));
  const resVal = restResistVal(c);
  const startPB = c.wounds.current;
  const hadFatigue = stacks(c, 'Exténué') > 0;
  let nightmareNights = 0;

  for (let d = 0; d < Math.max(1, days); d++) {
    // Faim & Soif (18 l.418) : un héros AFFAMÉ « ne peut pas récupérer de Points de Blessure ou se
    // débarrasser de l'État Exténué de manière naturelle » → pas de dissipation ni de soin ce jour
    // (les cauchemars suivent leur cours).
    const starving = isStarving(c);
    // Maladies (LDB 20) : l'Exténué « collant » du malaise (l.153) n'est PAS dissipé par le sommeil ;
    // chaque « blessé » bloque la guérison d'1 PB (l.110). (La progression vit dans l'entretien — #T3.)
    const malaise = activeMalaiseCount(c);
    const blesse = diseaseBlesseCount(c);
    // Sommeil : dissipe les Exténué de FATIGUE, mais garde ceux imposés par un malaise actif.
    const fat = stacks(c, 'Exténué');
    const removable = starving ? 0 : Math.max(0, fat - malaise);
    if (removable > 0) removeCondition(c, 'Exténué', removable);
    const dayStartPB = c.wounds.current;
    // volet a (l.380) : Test de Résistance Accessible (+20) → DR + BE PB (une fois par jour).
    if (!starving && c.wounds.current < c.wounds.max) {
      const res = rollTest(resVal, 'accessible', rng); // Accessible = +20
      collect?.push({ kind: 'recovery', base: resVal, target: res.target, roll: res.roll, sl: res.sl, success: res.success });
      if (res.success) c.wounds.current = Math.min(c.wounds.max, c.wounds.current + Math.max(0, res.sl) + be);
    }
    // volet b (l.380) : +BE par journée de repos, INCONDITIONNEL (même Test raté).
    if (!starving && c.wounds.current < c.wounds.max) c.wounds.current = Math.min(c.wounds.max, c.wounds.current + be);
    // Symptôme « blessé » (l.110) : bloque la guérison d'1 PB par symptôme (la plaie reste ouverte).
    if (blesse > 0) c.wounds.current = Math.max(dayStartPB, c.wounds.current - blesse);
    // Cauchemars (l.92) : une nuit marquée peut regagner un Exténué.
    if (c.nightmares) {
      const before = stacks(c, 'Exténué');
      const out: { base: number; result: import('./tests').TestResult }[] = [];
      nightmareCheck(c, rng, out);
      for (const o of out) collect?.push({ kind: 'nightmare', base: o.base, target: o.result.target, roll: o.result.roll, sl: o.result.sl, success: o.result.success });
      if (stacks(c, 'Exténué') > before) nightmareNights++;
    }
  }

  // Réveil : repasser > 0 PB lève l'Inconscient et relève l'À Terre (LDB 18 l.28 ; pas de « se relever »
  // hors combat). On NE passe PAS par applyHealWounds (qui consommerait le soin de Guérison de rencontre).
  const log: string[] = [];
  if (c.wounds.current > 0) {
    c.roundsAtZero = 0;
    if (hasCondition(c, 'Inconscient')) { removeCondition(c, 'Inconscient', stacks(c, 'Inconscient')); log.push(`${c.name} reprend connaissance.`); }
    if (hasCondition(c, 'À Terre')) removeCondition(c, 'À Terre', stacks(c, 'À Terre'));
  }
  const healed = c.wounds.current - startPB;
  const span = days > 1 ? `${days} jours de repos` : 'une nuit de repos';
  if (healed > 0) log.unshift(`${c.name} récupère ${healed} PB (${span}).`);
  if (isStarving(c)) log.push(`${c.name} est affamé — pas de récupération naturelle (Faim & Soif).`);
  if (hadFatigue && stacks(c, 'Exténué') === 0) log.push(`${c.name} se réveille reposé (Exténué dissipé).`);
  if (nightmareNights > 0) log.push(`${c.name} a fait des cauchemars (${nightmareNights}/${days} nuit${days > 1 ? 's' : ''}) → Exténué.`);
  return log;
}
