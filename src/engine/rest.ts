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
import { removeCondition, stacks, hasCondition, nightmareCheck } from './conditions';
import { tickTraumaRecovery } from './trauma';

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
export function restRecovery(c: Combatant, rng: RNG = defaultRNG, days = 1): string[] {
  if (c.dead || c.outOfRencontre) return []; // un mort / éjecté ne se repose pas
  // LDB 16 l.105 : un héros qui saigne, brûle ou est empoisonné ne trouve pas le repos — à stabiliser
  // d'abord (Test de Guérison, Sort). Pas de récupération réparatrice tant que ces États subsistent.
  if (unstable(c)) return [`${c.name} ne trouve pas le repos (blessures à stabiliser d'abord — Guérison).`];

  const be = bonus(effectiveChar(c, 'E'));
  const resVal = effectiveChar(c, 'E') + (c.skills?.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
  const startPB = c.wounds.current;
  const hadFatigue = stacks(c, 'Exténué') > 0;
  let nightmareNights = 0;

  for (let d = 0; d < Math.max(1, days); d++) {
    // Sommeil : dissipe TOUS les Exténué (incl. le cauchemar de la nuit précédente).
    const fat = stacks(c, 'Exténué');
    if (fat > 0) removeCondition(c, 'Exténué', fat);
    // volet a (l.380) : Test de Résistance Accessible (+20) → DR + BE PB (une fois par jour).
    if (c.wounds.current < c.wounds.max) {
      const res = rollTest(resVal, 'accessible', rng); // Accessible = +20
      if (res.success) c.wounds.current = Math.min(c.wounds.max, c.wounds.current + Math.max(0, res.sl) + be);
    }
    // volet b (l.380) : +BE par journée de repos, INCONDITIONNEL (même Test raté).
    if (c.wounds.current < c.wounds.max) c.wounds.current = Math.min(c.wounds.max, c.wounds.current + be);
    // Cauchemars (l.92) : une nuit marquée peut regagner un Exténué.
    if (c.nightmares) {
      const before = stacks(c, 'Exténué');
      nightmareCheck(c, rng);
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
  // Convalescence des Blessures critiques (LDB 18) : le repos fait avancer la guérison de chaque trauma.
  log.push(...tickTraumaRecovery(c, Math.max(1, days)));
  const healed = c.wounds.current - startPB;
  const span = days > 1 ? `${days} jours de repos` : 'une nuit de repos';
  if (healed > 0) log.unshift(`${c.name} récupère ${healed} PB (${span}).`);
  if (hadFatigue && stacks(c, 'Exténué') === 0) log.push(`${c.name} se réveille reposé (Exténué dissipé).`);
  if (nightmareNights > 0) log.push(`${c.name} a fait des cauchemars (${nightmareNights}/${days} nuit${days > 1 ? 's' : ''}) → Exténué.`);
  return log;
}
