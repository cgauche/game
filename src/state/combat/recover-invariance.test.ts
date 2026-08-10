/**
 * #1153 L6 — GARDE d'invariance du Test de RÉCUPÉRATION opposé (`EtatData.recover`, LDB 16 l.61).
 *
 * Ce Test opposé n'est pas encore migré aux valeurs nues (lot L5) : ni l'acteur (`skillValue =
 * testValue`, fondue — le porteur est par définition sous l'État qu'il quitte) ni la source
 * (`opponentValue`, figée) ne posent de nue, si bien que `resolveOpposed` retombe sur les CIBLES des
 * deux camps (`openValues`, tout-ou-rien).
 *
 * Ce repli n'est SANS EFFET sur le verdict qu'à une condition arithmétique : l'opposant roule toujours
 * à Intermédiaire (+0) — `rollFlowSpecs.FLOWS.recover` et la voie IA `combatFlow` (`opposedTest` sans
 * Difficulté) —, donc sa cible VAUT sa valeur ; celle de l'acteur vaut la sienne uniquement si sa
 * Difficulté est, elle aussi, Intermédiaire. Une donnée qui déclarerait `recover.difficulty` ailleurs
 * décalerait un seul des deux camps et changerait des départages en silence.
 *
 * Aujourd'hui aucune donnée ne le fait — RIEN ne l'empêchait. C'est cette garde, pas ce commentaire.
 * Elle tombe d'elle-même quand L5 posera les deux nues.
 */
import { describe, it, expect } from 'vitest';
import { etats } from '../../data';
import { DIFFICULTY_MODIFIERS } from '../../engine/types';

describe('#1153 — `recover.difficulty` reste Intermédiaire tant que le Test opposé n’est pas migré (L5)', () => {
  it('aucune donnée d’État n’ouvre un Test de récupération OPPOSÉ à Difficulté décalée', () => {
    const coupables = etats
      .filter((e) => e.recover?.opposedBy === 'source')
      .filter((e) => DIFFICULTY_MODIFIERS[e.recover!.difficulty ?? 'intermediaire'] !== 0)
      .map((e) => `${e.id} → ${e.recover!.difficulty}`);
    expect(
      coupables,
      'départage opposé de récupération : les deux camps retombent sur leurs CIBLES, et seule celle de '
      + 'l’acteur porterait cette Difficulté — migrer le flux aux valeurs nues (#1153 L5) avant de poser '
      + 'cette donnée',
    ).toEqual([]);
  });
});
