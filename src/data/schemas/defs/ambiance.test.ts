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

/**
 * `weather[].precip` (#1176 P2-6) — la PRÉCIPITATION MONDE est une donnée éditable qui pilote un
 * semis de milliers d'instances par frame : le schéma doit refuser AU CHARGEMENT ce qui ne tombe pas
 * (vitesse nulle ou négative), ce qui noie la frame (densité), et ce qui n'est pas une couleur.
 */
const avecPrecip = (precip: unknown) => {
  const base = ambianceJson as unknown as { iso: { weather: Record<string, unknown> } };
  return {
    ...base,
    iso: { ...base.iso, weather: { ...base.iso.weather, pluie: { ...(base.iso.weather.pluie as object), precip } } },
  };
};
const PRECIP_BON = {
  density: 0.3, fallMs: 9, windMs: { x: 1.2, z: 0.5 },
  widthM: 0.03, lengthM: 0.45, ceilingM: 9, color: '#aebfd0', opacity: 0.45,
};

describe('ambiance.json — `weather[].precip` est borné (#1176 P2-6)', () => {
  it('la donnée réelle passe, et le témoin de ce fichier EST la donnée réelle', () => {
    expect(schema.safeParse(ambianceJson).success).toBe(true);
    expect(schema.safeParse(avecPrecip(PRECIP_BON)).success).toBe(true);
    expect((ambianceJson as unknown as { iso: { weather: { pluie: { precip: unknown } } } }).iso.weather.pluie.precip)
      .toEqual(PRECIP_BON);
  });

  it('un type SANS précipitation reste valide — le brouillard ne tombe pas', () => {
    expect(schema.safeParse(avecPrecip(undefined)).success).toBe(true);
  });

  const refuses: [string, Record<string, unknown>][] = [
    ['densité NÉGATIVE — un semis à l’envers', { ...PRECIP_BON, density: -0.2 }],
    ['densité NULLE — une météo qui ne montre rien s’écrit `clair`, pas `density: 0`', { ...PRECIP_BON, density: 0 }],
    ['densité hors budget — des dizaines de milliers de quads par frame', { ...PRECIP_BON, density: 12 }],
    ['vitesse de chute nulle — la précipitation reste suspendue', { ...PRECIP_BON, fallMs: 0 }],
    ['vitesse de chute négative — il pleut vers le haut', { ...PRECIP_BON, fallMs: -9 }],
    ['plafond nul — aucun volume où semer', { ...PRECIP_BON, ceilingM: 0 }],
    ['opacité > 1', { ...PRECIP_BON, opacity: 1.4 }],
    ['couleur qui n’en est pas une', { ...PRECIP_BON, color: 'bleu-gris' }],
    ['particule plus LARGE que longue', { ...PRECIP_BON, widthM: 0.9, lengthM: 0.4 }],
    ['vent PLUS FORT que la chute — la pluie file à l’horizontale', { ...PRECIP_BON, windMs: { x: 20, z: 0 } }],
    ['champ inconnu (frappe de l’auteur)', { ...PRECIP_BON, vitesse: 9 }],
  ];
  for (const [cas, precip] of refuses)
    it(`REFUSÉ : ${cas}`, () => {
      expect(schema.safeParse(avecPrecip(precip)).success).toBe(false);
    });

  it('le message d’erreur DIT la règle', () => {
    const penche = schema.safeParse(avecPrecip({ ...PRECIP_BON, windMs: { x: 20, z: 0 } }));
    expect(penche.success).toBe(false);
    if (!penche.success) expect(penche.error.issues.map((i) => i.message).join('\n')).toContain('SOUS la vitesse de chute');
    const large = schema.safeParse(avecPrecip({ ...PRECIP_BON, widthM: 0.9, lengthM: 0.4 }));
    expect(large.success).toBe(false);
    if (!large.success) expect(large.error.issues.map((i) => i.message).join('\n')).toContain('`lengthM` ≥ `widthM`');
  });
});
