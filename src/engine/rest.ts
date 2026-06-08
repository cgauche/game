/**
 * Repos / nuit de sommeil — récupération hors combat (Livre de base FR).
 * Sources :
 *  - Exténué retiré par le repos (16-États l.91) ; cadence « une nuit = tout retiré » (choix figé, l.102
 *    laisse la vitesse au MJ ; on prend la nuit complète, cohérente avec « une bonne nuit de sommeil »).
 *  - Soin de Blessures (18-Traumatisme l.380) : Test de Résistance Accessible (+20) ⇒ DR + Bonus
 *    d'Endurance Points de Blessure regagnés.
 *  - Cauchemars (21-Psychologie l.92) : héros marqué ⇒ Test de Calme Facile (+40) ou Exténué regagné.
 * Pur : mute `c`, renvoie le journal. Ne dépend que d'autres modules purs du moteur.
 */
import { Combatant } from './types';
import { RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import { effectiveChar, bonus } from './characteristics';
import { removeCondition, stacks, hasCondition, nightmareCheck } from './conditions';

/** Repos d'une nuit pour UN personnage : retrait de l'Exténué, soin de Blessures, puis cauchemars.
 *  L'ordre compte : on dissipe d'abord la fatigue (sommeil), PUIS les cauchemars peuvent en regagner. */
export function restRecovery(c: Combatant, rng: RNG = defaultRNG): string[] {
  if (c.dead || c.outOfRencontre) return []; // un mort / éjecté ne se repose pas
  const log: string[] = [];

  // 1) Une nuit de sommeil dissipe TOUS les États Exténué (16-États l.91 ; cadence « nuit complète », l.102).
  const fatigue = stacks(c, 'Exténué');
  if (fatigue > 0) {
    removeCondition(c, 'Exténué', fatigue);
    log.push(`${c.name} récupère de sa fatigue (${fatigue} Exténué dissipé${fatigue > 1 ? 's' : ''}).`);
  }

  // 2) Soin de Blessures (18-Traumatisme l.380) : Test de Résistance Accessible (+20) → DR + BE PB.
  if (c.wounds.current < c.wounds.max) {
    const be = bonus(effectiveChar(c, 'E'));
    const resVal = effectiveChar(c, 'E') + (c.skills?.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
    const res = rollTest(resVal, 'accessible', rng); // Accessible = +20
    if (res.success) {
      const heal = Math.max(0, res.sl) + be;
      const before = c.wounds.current;
      c.wounds.current = Math.min(c.wounds.max, c.wounds.current + heal);
      log.push(`${c.name} se soigne en dormant : +${c.wounds.current - before} PB (DR ${Math.max(0, res.sl)} + BE ${be}).`);
      // Repasser > 0 PB lève l'Inconscient et remet l'horloge de mort à zéro (LDB 18 l.28). On NE passe
      // PAS par applyHealWounds (qui consommerait le soin de Guérison de la rencontre) — récup naturelle.
      if (c.wounds.current > 0 && hasCondition(c, 'Inconscient')) {
        removeCondition(c, 'Inconscient', stacks(c, 'Inconscient'));
        c.roundsAtZero = 0;
        log.push(`${c.name} reprend connaissance au matin.`);
      }
    } else {
      log.push(`${c.name} dort mal : aucune Blessure soignée (Résistance ratée).`);
    }
  }

  // 3) Cauchemars (21-Psychologie l.92) : un héros marqué peut regagner un Exténué malgré le repos.
  if (c.nightmares) log.push(...nightmareCheck(c, rng));

  return log;
}
