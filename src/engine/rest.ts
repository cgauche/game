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
 * DETTE ASSUMÉE (hors périmètre, sourcée pour mémoire) :
 *  - Faim & Soif (18-Traumatisme l.418) : « sans nourriture ni boisson… ne peuvent pas récupérer de PB
 *    ni se débarrasser de l'Exténué ». Pas de suivi des provisions → récup toujours autorisée (raccourci).
 *  - Blessures CRITIQUES (l.386-403) : piste de guérison SÉPARÉE (jours de convalescence, accélérée par
 *    la Compétence Guérison / Chirurgie) — le repos soigne les PB mais JAMAIS les critiques. Lot distinct.
 */
import { Combatant } from './types';
import { RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import { effectiveChar, bonus } from './characteristics';
import { addCondition, removeCondition, stacks, hasCondition, nightmareCheck } from './conditions';
import { tickTraumaRecovery } from './trauma';
import { tickDisease, activeMalaiseCount, diseaseBlesseCount } from './disease';

/** États à dégâts périodiques qui empêchent un repos réparateur (LDB 16 l.105 : on ne « reprend pas ses
 *  esprits » tant qu'un Hémorragique subsiste — on étend à En flammes/Empoisonné, qu'on ne traverse pas
 *  en dormant ; il faut d'abord stabiliser via Guérison/Sort). */
function unstable(c: Combatant): boolean {
  return hasCondition(c, 'Hémorragique') || hasCondition(c, 'En flammes') || hasCondition(c, 'Empoisonné');
}

/**
 * Repos de `days` journée(s) pour UN personnage (défaut 1 = « Dormir jusqu'à l'aube »). Par journée :
 * dissipe l'Exténué (sommeil, 16-États l.91/102), soigne les PB (l.380 volet a Résistance +20 → DR+BE,
 * ET volet b +BE inconditionnel), puis les cauchemars (21 l.92) peuvent en regagner un. Réveille un
 * Inconscient et relève un héros À Terre dès qu'il repasse > 0 PB (l.28). Mute `c`, renvoie un résumé.
 */
export function restRecovery(c: Combatant, rng: RNG = defaultRNG, days = 1, caredFor = false): string[] {
  if (c.dead || c.outOfRencontre) return []; // un mort / éjecté ne se repose pas
  // LDB 16 l.105 : un héros qui saigne, brûle ou est empoisonné ne trouve pas le repos — à stabiliser
  // d'abord (Test de Guérison, Sort). Pas de récupération réparatrice tant que ces États subsistent.
  if (unstable(c)) return [`${c.name} ne trouve pas le repos (blessures à stabiliser d'abord — Guérison).`];

  const be = bonus(effectiveChar(c, 'E'));
  const resVal = effectiveChar(c, 'E') + (c.skills?.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
  const startPB = c.wounds.current;
  const hadFatigue = stacks(c, 'Exténué') > 0;
  let nightmareNights = 0;
  const diseaseLog: string[] = [];

  for (let d = 0; d < Math.max(1, days); d++) {
    // Maladies (LDB 20) : nombre de symptômes au DÉBUT de la journée (avant que la maladie n'avance).
    const malaiseStart = activeMalaiseCount(c); // Exténué « collant » du malaise (l.153) — non dissipé par le sommeil
    const blesse = diseaseBlesseCount(c); // chaque « blessé » bloque la guérison d'1 PB (l.110)
    // Sommeil : dissipe les Exténué de FATIGUE, mais garde ceux imposés par un malaise actif.
    const fat = stacks(c, 'Exténué');
    const removable = Math.max(0, fat - malaiseStart);
    if (removable > 0) removeCondition(c, 'Exténué', removable);
    const dayStartPB = c.wounds.current;
    // volet a (l.380) : Test de Résistance Accessible (+20) → DR + BE PB (une fois par jour).
    if (c.wounds.current < c.wounds.max) {
      const res = rollTest(resVal, 'accessible', rng); // Accessible = +20
      if (res.success) c.wounds.current = Math.min(c.wounds.max, c.wounds.current + Math.max(0, res.sl) + be);
    }
    // volet b (l.380) : +BE par journée de repos, INCONDITIONNEL (même Test raté).
    if (c.wounds.current < c.wounds.max) c.wounds.current = Math.min(c.wounds.max, c.wounds.current + be);
    // Symptôme « blessé » (l.110) : bloque la guérison d'1 PB par symptôme (la plaie reste ouverte).
    if (blesse > 0) c.wounds.current = Math.max(dayStartPB, c.wounds.current - blesse);
    // Cauchemars (l.92) : une nuit marquée peut regagner un Exténué.
    if (c.nightmares) {
      const before = stacks(c, 'Exténué');
      nightmareCheck(c, rng);
      if (stacks(c, 'Exténué') > before) nightmareNights++;
    }
    // Incubation/durée des maladies (LDB 20), un jour ; réconcilie l'Exténué « collant » du malaise
    // (apparition d'une maladie → +1 Exténué ; guérison → −1).
    diseaseLog.push(...tickDisease(c, 1, rng, resVal));
    // Soins d'un soignant (LDB 09-Compétences) : « Pour chaque journée complète… la durée de la maladie est
    // réduite de 1, jusqu'à un minimum de 1 ». −1 jour SUPPLÉMENTAIRE par maladie active (résolution au tick
    // naturel — on ne descend pas sous 1 par les seuls soins).
    if (caredFor) {
      for (const dz of c.diseases ?? []) {
        if (dz.phase === 'active' && dz.daysLeft > 1) dz.daysLeft -= 1;
      }
    }
    const malaiseDelta = activeMalaiseCount(c) - malaiseStart;
    if (malaiseDelta > 0) addCondition(c, 'Exténué', malaiseDelta);
    else if (malaiseDelta < 0) removeCondition(c, 'Exténué', -malaiseDelta);
  }

  // Réveil : repasser > 0 PB lève l'Inconscient et relève l'À Terre (LDB 18 l.28 ; pas de « se relever »
  // hors combat). On NE passe PAS par applyHealWounds (qui consommerait le soin de Guérison de rencontre).
  const log: string[] = [];
  if (c.wounds.current > 0) {
    c.roundsAtZero = 0;
    if (hasCondition(c, 'Inconscient')) { removeCondition(c, 'Inconscient', stacks(c, 'Inconscient')); log.push(`${c.name} reprend connaissance.`); }
    if (hasCondition(c, 'À Terre')) removeCondition(c, 'À Terre', stacks(c, 'À Terre'));
  }
  // Convalescence des Blessures critiques (LDB 18) : le repos fait avancer la guérison de chaque trauma
  // (rémission en deux temps d'une déchirure majeure ; Test de Résistance de fin d'une fracture).
  log.push(...tickTraumaRecovery(c, Math.max(1, days), rng, resVal));
  log.push(...diseaseLog); // évolution des maladies (LDB 20) accumulée jour par jour
  const healed = c.wounds.current - startPB;
  const span = days > 1 ? `${days} jours de repos` : 'une nuit de repos';
  if (healed > 0) log.unshift(`${c.name} récupère ${healed} PB (${span}).`);
  if (hadFatigue && stacks(c, 'Exténué') === 0) log.push(`${c.name} se réveille reposé (Exténué dissipé).`);
  if (nightmareNights > 0) log.push(`${c.name} a fait des cauchemars (${nightmareNights}/${days} nuit${days > 1 ? 's' : ''}) → Exténué.`);
  return log;
}
