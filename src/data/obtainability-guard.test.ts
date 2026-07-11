import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { computeObtainability } from '../../scripts/data/lib/obtainabilityGraph';

/**
 * Garde-fou « obtenabilité réelle » (#321 lentille 1, cliquet baseline patron `scripts/guards/lib/`) :
 * fige le compte de Talents/Sorts JAMAIS-obtenables en jeu (aucune carrière/espèce/créature-statblock/
 * Table aléatoire/GameOp `grantTalent`/scène `learnSpell`/Talent de lanceur ne les confère — mécanique
 * dans `scripts/data/lib/obtainabilityGraph.ts`, RAPPORT DATÉ `docs/plans/2026-07-11-chasse-3-synthese.md`).
 * Baseline gelée au recensement (2026-07-11) : 6 Talents / 11 Sorts (dont `talent-aleatoire`, entrée
 * MÉTA de la Table — pas un Talent réellement possédable). Toute RÉGRESSION (compte qui grimpe) fait
 * échouer la garde ; une baisse (contenu câblé) doit ABAISSER ce nombre ici — jamais l'inverse.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BASELINE = { talents: 6, spells: 11 };

describe('garde-fou obtenabilité réelle (talents/sorts jamais obtenables)', () => {
  it('le compte de Talents JAMAIS-obtenables ne dépasse pas la baseline gelée', () => {
    const { talentNever } = computeObtainability(ROOT);
    expect(
      talentNever.length,
      `Talents sans chemin d'obtention : ${talentNever.map((t) => t.id).join(', ')} — soit câbler une source (carrière/espèce/créature/mutation/étoile/scène), soit documenter la référence codex-seulement et AJUSTER la baseline (${BASELINE.talents}) de ce test`,
    ).toBeLessThanOrEqual(BASELINE.talents);
  });

  it('le compte de Sorts JAMAIS-obtenables ne dépasse pas la baseline gelée', () => {
    const { spellNever } = computeObtainability(ROOT);
    expect(
      spellNever.length,
      `Sorts sans Talent de lanceur/Domaine/Culte/scène : ${spellNever.map((v) => v.id).join(', ')} — soit câbler une source, soit AJUSTER la baseline (${BASELINE.spells}) de ce test`,
    ).toBeLessThanOrEqual(BASELINE.spells);
  });
});
