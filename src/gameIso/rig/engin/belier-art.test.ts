import { describe, it, expect } from 'vitest';
import { ENGIN_ARTS } from './_registry.generated';
import { enginPlan, enginArtOf } from './composeEngin';
import { MISSING_ART } from '../viewArt';
import { enginArt as canonPetit } from './defs/canon-petit';

/**
 * #210 Lot 1 — le bélier ADE II a son PROPRE art (`defs/belier.ts`), plus un affût de baliste recyclé.
 */
describe('art de l’engin `belier` (ADE II 8 l.258 : tronc suspendu à un portique à roues)', () => {
  it('registre auto-chargé : `belier` présent aux côtés des autres engins (vague d’art complète)', () => {
    expect(ENGIN_ARTS.map((a) => a.id).sort()).toEqual([
      'baliste',
      'batterie-tonnerre-de-feu',
      'belier',
      'canon-a-flammes',
      'canon-a-repetition',
      'canon-lourd',
      'canon-petit',
      'catapulte',
      'mangonneau',
      'mortier',
      'onagre',
      'pierrier',
      'trebuchet',
    ]);
  });

  it("composeEngin('belier') est résolu par id (art distinct de tout repli)", () => {
    const belier = enginPlan.resolve('belier', 'front', {})[0].parts[0].svg;
    const fallback = enginPlan.resolve('espece-inconnue-xyz', 'front', {})[0].parts[0].svg;
    expect(belier).not.toBe(fallback);
  });

  it('id d’engin INCONNU → REPLI VISIBLE (#223) ; `canon-petit` est un ART RÉEL, plus un fallback', () => {
    // Couverture des `siegeRig` de trappings.json : assertée par `siege-rig-resolution.test.ts` (art +
    // `CreatureDef`). Ici on ne fige que le repli : id inconnu → silhouette d'erreur partagée, jamais
    // un affût silencieux — `canon-petit` étant un art dédié à part entière.
    expect(enginArtOf('espece-inconnue-xyz')).toBe(MISSING_ART);
    expect(enginArtOf('canon-petit')).toBe(canonPetit);
    expect(enginArtOf('espece-inconnue-xyz')).not.toBe(canonPetit);
  });

  it('les 3 vues du bélier sont non vides et distinctes entre elles', () => {
    const front = enginPlan.resolve('belier', 'front', {})[0].parts[0].svg;
    const profile = enginPlan.resolve('belier', 'profile', {})[0].parts[0].svg;
    const back = enginPlan.resolve('belier', 'back', {})[0].parts[0].svg;
    for (const svg of [front, profile, back]) expect(svg.length).toBeGreaterThan(0);
    expect(new Set([front, profile, back]).size).toBe(3);
  });
});
