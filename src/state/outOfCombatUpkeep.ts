/**
 * Entretien de fin de Round HORS COMBAT (couture A de l'audit « combat-only »).
 *
 * LDB 13-Combat l.49-50 : « En dehors d'un Combat, la mesure du temps […] est bien plus flexible. Mais
 * il est quelquefois utile d'utiliser les Rounds même en dehors d'un Combat. » Les États qui « tickent »
 * (Hémorragique l.105 / Empoisonné l.66 / En flammes l.77) et l'agonie (0 PB → Inconscient après BE
 * Rounds, LDB 18 l.28) ne doivent pas geler dès qu'on sort du combat : on les fait progresser au fil de
 * l'horloge (1 Round ≈ TIME_COST.combatRound minute). En combat, c'est la frontière de Round qui s'en charge.
 *
 * Limite assumée : tant que l'action « Premiers Secours / panser » (retrait d'Hémorragique, couture C de
 * récupération) n'existe pas, un héros qui s'attarde en saignant peut mourir — un Point de Destin le sauve
 * (consommé, l'hémorragie est jugulée). Se déplacer ne coûte pas de temps : on peut fuir sans saigner.
 */
import { Combatant } from '../engine/types';
import { RNG } from '../engine/dice';
import { endOfRound, bleedDeathRoll, tickDeath, hasCondition } from '../engine/conditions';
import { t } from '../i18n';

/** A-t-il un effet périodique (perte de PB chaque Round) OU est-il à 0 PB (progression vers l'Inconscience) ? */
function needsUpkeep(c: Combatant): boolean {
  return c.wounds.current <= 0 || hasCondition(c, 'hemorragique') || hasCondition(c, 'empoisonne') || hasCondition(c, 'en-flammes');
}

/**
 * Rejoue jusqu'à `rounds` Rounds d'entretien sur les membres du groupe qui en ont besoin. Mute `party`.
 * S'arrête dès que plus personne n'a besoin d'entretien (évite les longues boucles sur de grands sauts de
 * temps). Un héros qui mourrait par hémorragie est sauvé par un Point de Destin s'il en a. Retourne le journal.
 */
export function outOfCombatUpkeep(party: Combatant[], rounds: number, rng: RNG): string[] {
  const log: string[] = [];
  for (let r = 0; r < rounds; r++) {
    let active = false;
    for (const c of party) {
      if (c.dead || !needsUpkeep(c)) continue;
      active = true;
      endOfRound(c, rng).forEach((l) => log.push(l)); // dégâts périodiques + décrément des durées (tickDurations)
      const bd = bleedDeathRoll(c, rng); // mort par Hémorragique (10 %/pion, double = coagule)
      bd.log.forEach((l) => log.push(l));
      if (bd.died) {
        if ((c.fate ?? 0) > 0) {
          c.fate = (c.fate ?? 0) - 1;
          c.wounds.current = Math.max(1, c.wounds.current);
          log.push(t('upkeep.fateSaved', { name: c.name }));
        } else {
          c.dead = true;
          log.push(t('upkeep.succumb', { name: c.name }));
        }
        continue;
      }
      tickDeath(c, rng).forEach((l) => log.push(l)); // 0 PB → Inconscient après BE Rounds (LDB 18 l.28)
    }
    if (!active) break;
  }
  return log;
}
