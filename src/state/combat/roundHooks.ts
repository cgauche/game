/**
 * Hooks de FRANCHISSEMENT DE ROUND (`roundBoundary`) enregistrés sur la couture `combatHooks`. Module
 * FEUILLE chargé par effet de bord depuis combatFlow (comme restFlow/travelFlow peuplent cascadeAppliers) :
 * une règle de fin de Round se branche ICI au lieu d'éditer la séquence inline d'`advanceTurn`.
 */
import { registerCombatHook } from '../combatHooks';
import { battleRng } from '../battleRng';
import { rollTest } from '../../engine/tests';
import { testValue } from '../../engine/skills';
import { bonus, effectiveChar } from '../../engine/characteristics';
import { addCondition, isOutOfAction, COND } from '../../engine/conditions';

/**
 * Règle optionnelle « Se fatiguer » (LDB 16 l.99) : un effort physique soutenu finit par épuiser.
 * Approximation assumée (granularité Round) : chaque Round en action = 1 Round d'effort ; à Bonus
 * d'Endurance Rounds cumulés, Test de Résistance — échec → +1 Exténué (compteur remis à zéro) ;
 * réussite → le délai avant le prochain Test est repoussé de 1 + DR Rounds. Inerte tant que la règle
 * `combat-se-fatiguer` est inactive (aucun tirage RNG consommé → franchissement de Round iso-comportement).
 */
registerCombatHook({
  id: 'se-fatiguer',
  phase: 'roundBoundary',
  order: 80, // après les effets de Round RAW (Mâchoires 60, décomptes de Détermination 70), avant la révélation héros
  enabledIf: 'combat-se-fatiguer',
  run: ({ battle, sink }) => {
    for (const c of battle.combatants) {
      if (isOutOfAction(c)) continue;
      const seuil = Math.max(1, bonus(effectiveChar(c, 'E')));
      c.effortRounds = (c.effortRounds ?? 0) + 1;
      if (c.effortRounds < seuil) continue;
      const t = rollTest(testValue(c, 'Résistance'), 'intermediaire', battleRng());
      if (t.success) {
        c.effortRounds = Math.max(0, c.effortRounds - (1 + Math.max(0, t.sl)));
      } else {
        addCondition(c, COND.extenue);
        c.effortRounds = 0;
        sink(`${c.name} s'épuise (effort soutenu) : Exténué.`, c);
      }
    }
  },
});
