/**
 * Entretien de fin de Round HORS COMBAT (couture A de l'audit « combat-only »).
 *
 * LDB 13 l.45-47 : « En dehors d'un Combat, la mesure du temps […] est bien plus flexible. Mais
 * il est quelquefois utile d'utiliser les Rounds même en dehors d'un Combat. » Les États qui « tickent »
 * (Hémorragique l.105 / Empoisonné l.66 / En flammes l.77) et l'agonie (0 PB → Inconscient après BE
 * Rounds, LDB 18 l.15) ne doivent pas geler dès qu'on sort du combat : on les fait progresser au fil de
 * l'horloge (1 Round ≈ TIME_COST.combatRound minute). En combat, c'est la frontière de Round qui s'en charge.
 *
 * Échapper à l'agonie par Hémorragie hors combat : Test de Guérison réussi retire l'État (LDB 09
 * l.261, LDB 16 l.107-109) — infirmerie hors combat (`openMedic`/`medicAct('bleed')`, `state/medicFlow.ts`,
 * bouton « Soins » de `CharacterSheet.tsx`), n'avance pas le temps. Sans soigneur au Talent ni Destin,
 * l'agonie ci-dessus va à son terme.
 */
import { Combatant } from '../engine/types';
import { RNG } from '../engine/dice';
import { endOfRound, bleedDeathRoll, tickDeath, hasCondition } from '../engine/conditions';
import { fateSaveOrDie } from '../engine/fortune';
import { fireConditionEffects } from './triggeredEffects';
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
      endOfRound(c, rng).forEach((l) => log.push(l)); // récupération du Sonné (Test) + décrément des durées
      // Dégâts périodiques d'État (Empoisonné/En Flammes/Hémorragique) MIGRÉS en données (effects: onRoundEnd
      // → wounds) : MÊME chemin qu'en combat, ils tickent AUSSI hors-combat. La cible 'self' ne touche pas
      // `battle` (targetsFor) → `get` stub suffit ; pas de `set` (flow sans test interactif hors combat).
      fireConditionEffects((() => ({ battle: undefined })) as never, c, 'onRoundEnd', { rng }).forEach((l) => log.push(l));
      const bd = bleedDeathRoll(c, rng); // mort par Hémorragique (10 %/pion, double = coagule)
      bd.log.forEach((l) => log.push(l));
      if (bd.died) {
        log.push(fateSaveOrDie(c) ? t('upkeep.fateSaved', { name: c.label }) : t('upkeep.succumb', { name: c.label }));
        continue;
      }
      tickDeath(c).forEach((l) => log.push(l)); // 0 PB → Inconscient après BE Rounds (LDB 18 l.15)
    }
    if (!active) break;
  }
  return log;
}
