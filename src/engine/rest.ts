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
 * DETTE ASSUMÉE (hors périmètre de ce lot, sourcée pour mémoire) :
 *  - Faim & Soif (18-Traumatisme l.418) : « sans nourriture ni boisson… ne peuvent pas récupérer de PB
 *    ni se débarrasser de l'Exténué ». Pas de suivi des provisions dans le jeu → on autorise toujours la
 *    récup naturelle (raccourci explicite, à verrouiller quand le sous-système Faim/Soif existera).
 *  - Repos prolongé (l.380, volet b) : « pour chaque journée de repos, +BE PB » EN PLUS du Test quotidien.
 *    Non modélisé : « Dormir » ne couvre qu'UNE nuit. Une action « Se reposer N jours » l'ajouterait.
 */
import { Combatant } from './types';
import { RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import { effectiveChar, bonus } from './characteristics';
import { removeCondition, stacks, hasCondition, nightmareCheck } from './conditions';

/** États à dégâts périodiques qui empêchent un repos réparateur (LDB 16 l.105 : on ne « reprend pas ses
 *  esprits » tant qu'un Hémorragique subsiste — on étend à En flammes/Empoisonné, qu'on ne traverse pas
 *  en dormant ; il faut d'abord stabiliser via Guérison/Sort). */
function unstable(c: Combatant): boolean {
  return hasCondition(c, 'Hémorragique') || hasCondition(c, 'En flammes') || hasCondition(c, 'Empoisonné');
}

/** Repos d'une nuit pour UN personnage : retrait de l'Exténué, soin de Blessures, réveil, puis cauchemars.
 *  L'ordre compte : on dissipe d'abord la fatigue (sommeil), PUIS les cauchemars peuvent en regagner. */
export function restRecovery(c: Combatant, rng: RNG = defaultRNG): string[] {
  if (c.dead || c.outOfRencontre) return []; // un mort / éjecté ne se repose pas
  // LDB 16 l.105 : un héros qui saigne, brûle ou est empoisonné ne trouve pas le repos — à stabiliser
  // d'abord (Test de Guérison, Sort). Pas de récupération réparatrice tant que ces États subsistent.
  if (unstable(c)) return [`${c.name} ne trouve pas le repos (blessures à stabiliser d'abord — Guérison).`];
  const log: string[] = [];

  // 1) Une nuit de sommeil dissipe TOUS les États Exténué (16-États l.91 ; cadence « nuit complète », l.102).
  const fatigue = stacks(c, 'Exténué');
  if (fatigue > 0) {
    removeCondition(c, 'Exténué', fatigue);
    log.push(`${c.name} récupère de sa fatigue (${fatigue} Exténué dissipé${fatigue > 1 ? 's' : ''}).`);
  }

  // 2) Soin de Blessures (18-Traumatisme l.380, volet a) : Test de Résistance Accessible (+20) → DR + BE PB.
  if (c.wounds.current < c.wounds.max) {
    const be = bonus(effectiveChar(c, 'E'));
    const resVal = effectiveChar(c, 'E') + (c.skills?.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
    const res = rollTest(resVal, 'accessible', rng); // Accessible = +20
    if (res.success) {
      const heal = Math.max(0, res.sl) + be;
      const before = c.wounds.current;
      c.wounds.current = Math.min(c.wounds.max, c.wounds.current + heal);
      log.push(`${c.name} se soigne en dormant : +${c.wounds.current - before} PB (DR ${Math.max(0, res.sl)} + BE ${be}).`);
    } else {
      log.push(`${c.name} dort mal : aucune Blessure soignée (Résistance ratée).`);
    }
  }

  // 3) Réveil : repasser > 0 PB lève l'Inconscient et remet l'horloge de mort à zéro (LDB 18 l.28). On NE
  //    passe PAS par applyHealWounds (qui consommerait le soin de Guérison de la rencontre) — récup naturelle.
  //    Au matin, un dormeur soigné se relève aussi (À Terre retiré : pas de « se relever » hors combat).
  if (c.wounds.current > 0) {
    c.roundsAtZero = 0;
    if (hasCondition(c, 'Inconscient')) {
      removeCondition(c, 'Inconscient', stacks(c, 'Inconscient'));
      log.push(`${c.name} reprend connaissance au matin.`);
    }
    if (hasCondition(c, 'À Terre')) {
      removeCondition(c, 'À Terre', stacks(c, 'À Terre'));
      log.push(`${c.name} se relève, reposé.`);
    }
  }

  // 4) Cauchemars (21-Psychologie l.92) : un héros marqué peut regagner un Exténué malgré le repos.
  if (c.nightmares) log.push(...nightmareCheck(c, rng));

  return log;
}
