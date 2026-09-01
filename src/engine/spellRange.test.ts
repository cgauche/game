import { describe, it, expect } from 'vitest';
import { parseSpellRange, parseSpellTarget, type SpellRange, type SpellTarget } from './spellRange';
import { formatSpellRange, formatSpellTarget } from './spellRangeFormat';

describe('spellRange — round-trip parse∘format = identité (valeurs parsables)', () => {
  const ranges: SpellRange[] = [
    { kind: 'self' },
    { kind: 'touch' },
    { kind: 'distance', value: 6, unit: 'm' },
    { kind: 'distance', value: 1, unit: 'm' },
    { kind: 'distance', value: { charOf: 'force-mentale' }, unit: 'm' },
    { kind: 'distance', value: { bonusOf: 'force-mentale' }, unit: 'm' },
    { kind: 'distance', value: { bonusOf: 'initiative' }, unit: 'km' },
    { kind: 'special', text: 'Voir texte' },
  ];
  for (const r of ranges) {
    it(`range ${JSON.stringify(r)}`, () => expect(parseSpellRange(formatSpellRange(r))).toEqual(r));
  }

  const targets: SpellTarget[] = [
    { kind: 'self' },
    { kind: 'count', n: 1 },
    { kind: 'count', n: 3 },
    { kind: 'area', span: 'diameter', meters: 8 },
    { kind: 'area', span: 'diameter', meters: { bonusOf: 'force-mentale' } },
    { kind: 'area', span: 'radius', meters: { bonusOf: 'sociabilite' } },
    { kind: 'cone', lengthMeters: 8, widthMeters: 2 },
    { kind: 'special', text: 'Spécial' },
  ];
  for (const t of targets) {
    it(`target ${JSON.stringify(t)}`, () => expect(parseSpellTarget(formatSpellTarget(t))).toEqual(t));
  }
});

describe('spellRange — parse de la prose réelle (sanity)', () => {
  it('portées', () => {
    expect(parseSpellRange('(Force Mentale) mètres')).toEqual({ kind: 'distance', value: { charOf: 'force-mentale' }, unit: 'm' });
    expect(parseSpellRange('(Bonus de Force Mentale) mètres')).toEqual({ kind: 'distance', value: { bonusOf: 'force-mentale' }, unit: 'm' });
    expect(parseSpellRange('30 Mètres')).toEqual({ kind: 'distance', value: 30, unit: 'm' });
    expect(parseSpellRange("(Bonus d'Initiative) kilomètres")).toEqual({ kind: 'distance', value: { bonusOf: 'initiative' }, unit: 'km' });
    expect(parseSpellRange('Vous')).toEqual({ kind: 'self' });
    expect(parseSpellRange('Toucher')).toEqual({ kind: 'touch' });
    // L'ÉCHAPPATOIRE tient au PARSE (une chaîne libre reste `special`) ; la DONNÉE, elle, n'écrit
    // plus aucune désignation de lanceur — `src/data/spells-portee-lanceur.test.ts` (#1463 L-ref-2).
    expect(parseSpellRange('Skaven')).toEqual({ kind: 'special', text: 'Skaven' });
  });
  it('cibles', () => {
    expect(parseSpellTarget(1)).toEqual({ kind: 'count', n: 1 });
    expect(parseSpellTarget('1')).toEqual({ kind: 'count', n: 1 }); // « 1 » string ≡ 1 (artefact normalisé)
    expect(parseSpellTarget('ZdE (Bonus de Force Mentale) mètres')).toEqual({ kind: 'area', span: 'diameter', meters: { bonusOf: 'force-mentale' } });
    expect(parseSpellTarget('Zone Diamètre 8 Mètres')).toEqual({ kind: 'area', span: 'diameter', meters: 8 });
    expect(parseSpellTarget('Cône Longueur (8 Mètres) x Largeur (2 Mètres)')).toEqual({ kind: 'cone', lengthMeters: 8, widthMeters: 2 });
    expect(parseSpellTarget('Spécial')).toEqual({ kind: 'special', text: 'Spécial' });
    expect(parseSpellTarget('1 voilier dans la Ligne de vue')).toEqual({ kind: 'special', text: '1 voilier dans la Ligne de vue' });
  });
});
