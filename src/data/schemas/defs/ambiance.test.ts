/**
 * `fogTint` est une DONNÉE éditable qui pilote les trois rendus (couleur de sommet three, `brightness`
 * du voile iso, lumière d'ambiance POV) : le schéma doit refuser AU CHARGEMENT toute valeur qui casse
 * la politique — hors de [0,1], ordre inversé, ou `explored` nul (dénominateur du cran POV).
 */
import { describe, expect, it } from 'vitest';
import { schema } from './ambiance';
import ambianceJson from '../../ambiance.json';

const BON = { visible: 1, explored: 0.42, unknown: 0.15 };
const avec = (fogTint: Record<string, number>) => ({ ...(ambianceJson as object), fogTint });

describe('ambiance.json — `fogTint` est borné et ORDONNÉ', () => {
  it('la donnée réelle passe (et le témoin de ce fichier EST la donnée réelle)', () => {
    expect(schema.safeParse(ambianceJson).success).toBe(true);
    expect(schema.safeParse(avec(BON)).success).toBe(true);
    expect(ambianceJson.fogTint).toEqual(BON);
  });

  const refuses: [string, Record<string, number>][] = [
    ['`explored` nul — le cran POV `unknown` y divise (→ Infinity)', { visible: 1, explored: 0, unknown: 0.15 }],
    ['ordre inversé — jamais-vu plus lumineux que le souvenir', { visible: 1, explored: 0.42, unknown: 0.9 }],
    ['facteur négatif', { visible: 1, explored: 0.42, unknown: -0.1 }],
    ['facteur > 1 — une teinte sur-expose au lieu d’éclaircir', { visible: 1, explored: 1.4, unknown: 0.15 }],
    ['`visible` hors de [0,1]', { visible: 1.2, explored: 0.42, unknown: 0.15 }],
  ];
  for (const [cas, fogTint] of refuses)
    it(`REFUSÉ : ${cas}`, () => {
      expect(schema.safeParse(avec(fogTint)).success).toBe(false);
    });

  it('un souvenir plus lumineux que le vu est refusé par le MÊME ordre', () => {
    expect(schema.safeParse(avec({ visible: 0.3, explored: 0.42, unknown: 0.15 })).success).toBe(false);
  });

  it('le message d’erreur DIT la règle (un auteur doit savoir quoi corriger)', () => {
    const inverse = schema.safeParse(avec({ visible: 1, explored: 0.42, unknown: 0.9 }));
    expect(inverse.success).toBe(false);
    if (!inverse.success) expect(inverse.error.issues.map((i) => i.message).join('\n')).toContain('visible ≥ explored ≥ unknown');
    const nul = schema.safeParse(avec({ visible: 1, explored: 0, unknown: 0.15 }));
    expect(nul.success).toBe(false);
    if (!nul.success) expect(nul.error.issues.map((i) => i.message).join('\n')).toContain('doit être > 0');
  });
});
