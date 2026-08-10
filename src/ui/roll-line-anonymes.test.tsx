/**
 * SONDE « zéro chip anonyme » CÂBLÉE (#1153 L1a) — `ANONYMES.count` (`ui/RollLine.tsx`) était une
 * affordance MORTE : le compteur s'incrémentait au rendu, personne ne le lisait. Ici il est LU, et
 * c'est le rendu réel de `RollLine`/`PendingRollLine` qui l'alimente — pas un calcul de test.
 *
 * Le compteur ne bouge qu'en DEV (`import.meta.env.DEV`), comme la journalisation à l'écran ; le test
 * s'assure d'abord que la sonde MORD (ligne volontairement bancale) avant de juger une ligne saine —
 * sans quoi un `count === 0` ne prouverait rien.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RollLine, PendingRollLine, ANONYMES } from './RollLine';
import { rollLine } from '../state/rollSeam';
import type { RollBreakdown } from '../engine/combat';

beforeEach(() => { ANONYMES.count = 0; });

describe('RollLine — le compteur de chips « autres » est CÂBLÉ et lu (#1153)', () => {
  it('la sonde MORD : une ligne dont les chips n’expliquent pas l’écart avoue « autres » ET l’incrémente', () => {
    const d: RollBreakdown = {
      label: 'Résistance', base: 40, modifier: -30, target: 10, roll: 55, sl: -5, success: false,
      difficulty: 'intermediaire', mods: [{ label: 'Empoisonné', value: -10 }],
    } as RollBreakdown;
    const html = renderToStaticMarkup(<RollLine d={d} />);
    expect(html).toContain('autres');
    expect(ANONYMES.count, 'la chip anonyme rendue se compte').toBe(1);
  });

  it('une ligne MONTÉE par `rollLine` ne produit aucune chip anonyme — compteur à 0', () => {
    // Ligne saine : la valeur est la base + les mods DÉCLARÉS, exactement ce que le monteur rend.
    const monte = rollLine({ difficulty: 'accessible', valeur: 45, surLaCible: [{ label: 'Soutien', value: 10, famille: 'jet' }] });
    const d: RollBreakdown = {
      label: 'Résistance', base: monte.base, modifier: monte.target - monte.base, target: monte.target,
      roll: 30, sl: 2, success: true, difficulty: 'accessible', mods: monte.mods,
      ...(monte.clamped ? { clamped: monte.clamped } : {}),
    } as RollBreakdown;
    const html = renderToStaticMarkup(<RollLine d={d} />);
    expect(html).not.toContain('autres');
    expect(ANONYMES.count).toBe(0);

    // Le PRÉ-jet passe par la MÊME réconciliation : la ligne à lancer ne cache rien non plus.
    const pending = renderToStaticMarkup(
      <PendingRollLine p={{ label: 'Résistance', base: monte.base, target: monte.target, mods: monte.mods, difficulty: 'accessible', clamped: monte.clamped }} />,
    );
    expect(pending).not.toContain('autres');
    expect(ANONYMES.count).toBe(0);
  });

  it('le PLAFOND, SANS circonstance à composer, se rend en chip NOMMÉE — jamais en « autres »', () => {
    // Trois États du JETEUR (famille `jet`) somment −50 et se combinent à −30. Aucune circonstance
    // n'est en jeu : il n'y a AUCUN palier à composer (`LDB 14 l.91-96` borne la combinaison des
    // entrées de la table), et l'amputation reste donc une chip nommée — la nommer « Accessible
    // (+20) » ferait dire à la ligne l'exact contraire de la situation.
    const monte = rollLine({
      difficulty: 'intermediaire', valeur: 60, plafond: 'difficultes',
      surLaCible: [{ label: 'Sonné', value: -10, famille: 'jet' }, { label: 'Aveuglé', value: -20, famille: 'jet' }, { label: 'Empêtré', value: -20, famille: 'jet' }],
    });
    expect(monte.target, 'la fixture doit vraiment faire mordre le plafond').toBe(30);
    expect(monte.difficulty, 'aucune circonstance ⇒ la Difficulté déclarée tient').toBe('intermediaire');
    expect(monte.difficultyParts).toBeUndefined();
    const html = renderToStaticMarkup(
      <PendingRollLine p={{ label: 'Corps à corps', base: monte.base, target: monte.target, mods: monte.mods, difficulty: monte.difficulty, difficultyParts: monte.difficultyParts }} />,
    );
    expect(html).toContain('plafond Difficultés');
    expect(html).not.toContain('autres');
    expect(ANONYMES.count).toBe(0);
  });

  it('le PLAFOND des CIRCONSTANCES, lui, se lit dans le PALIER — et disparaît des chips', () => {
    // MÊME plafond, mais sur des entrées de la table (`LDB 14`, exemple l.95 : brouillard +
    // Localisation). Le RAW nomme le résultat : « le Test devient simplement Très Difficile (-30) ».
    const monte = rollLine({
      difficulty: 'intermediaire', valeur: 60, plafond: 'difficultes',
      surLaCible: [{ label: 'Brouillard', value: -20, famille: 'circonstance' }, { label: 'Localisation visée', value: -20, famille: 'circonstance' }],
    });
    expect(monte.target).toBe(30);
    expect(monte.difficulty).toBe('tresDifficile');
    expect(monte.mods, 'plus une seule chip : le palier porte tout').toEqual([]);
    const html = renderToStaticMarkup(
      <PendingRollLine p={{ label: 'Projectiles', base: monte.base, target: monte.target, mods: monte.mods, difficulty: monte.difficulty, difficultyParts: monte.difficultyParts }} />,
    );
    expect(html).toContain('Très difficile (−30)');
    expect(html).not.toContain('plafond Difficultés');
    expect(html).not.toContain('autres');
    expect(ANONYMES.count).toBe(0);
  });

  it('l’ÉCRÊTAGE mesuré se nomme « plafond », il n’est jamais avoué « autres »', () => {
    const monte = rollLine({ difficulty: 'tresFacile', valeur: 90 }); // 90 + 60 → écrêté à 99
    expect(monte.clamped, 'la fixture doit vraiment franchir le plafond').toBeLessThan(0);
    const html = renderToStaticMarkup(
      <PendingRollLine p={{ label: 'Natation', base: monte.base, target: monte.target, mods: monte.mods, difficulty: 'tresFacile', clamped: monte.clamped }} />,
    );
    expect(html).toContain('plafond');
    expect(html).not.toContain('autres');
    expect(ANONYMES.count).toBe(0);
  });
});
