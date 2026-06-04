import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { findSpecies } from '../data';
import {
  speciesSkillAdvanceMap,
  rollRandomTalent,
  resolveSpeciesTalents,
  createHero,
} from './character';

const REIK = 'Humains (Reiklander)';
const sp = () => findSpecies(REIK)!;

describe('speciesSkillAdvanceMap — 3×+5 / 3×+3 (LDB l.510)', () => {
  it('par défaut : 3 premières compétences +5, 3 suivantes +3', () => {
    const m = speciesSkillAdvanceMap(sp());
    // Reiklander : Calme, Charme, Commandement, Corps à corps (Base), Évaluation, Langue (Bretonnien)…
    expect(m['Calme']).toBe(5);
    expect(m['Charme']).toBe(5);
    expect(m['Commandement']).toBe(5);
    expect(m['Corps à corps (Base)']).toBe(3);
    expect(m['Évaluation']).toBe(3);
    expect(m['Langue (Bretonnien)']).toBe(3);
    // 3 à +5 et 3 à +3 → 6 entrées, total 24 augmentations.
    expect(Object.keys(m)).toHaveLength(6);
    expect(Object.values(m).reduce((a, b) => a + b, 0)).toBe(24);
  });

  it('surcharge : on peut choisir quelles compétences reçoivent +5/+3', () => {
    const m = speciesSkillAdvanceMap(sp(), { plus5: ['Ragot', 'Marchandage', 'Calme'], plus3: ['Charme', 'Évaluation', 'Commandement'] });
    expect(m['Ragot']).toBe(5);
    expect(m['Charme']).toBe(3);
  });
});

describe('rollRandomTalent — Tableau des Talents aléatoires (table d100 de all-data.json)', () => {
  it('renvoie un talent de la table', () => {
    const t = rollRandomTalent(makeRNG(1), new Set());
    expect(typeof t).toBe('string');
    expect(t).toBeTruthy();
  });

  it('relance si le talent est déjà possédé (LDB : « vous pouvez relancer »)', () => {
    // On possède déjà le talent du seed 1 → un nouveau tirage doit donner autre chose.
    const first = rollRandomTalent(makeRNG(1), new Set())!;
    const second = rollRandomTalent(makeRNG(1), new Set([first]));
    expect(second).not.toBe(first);
  });

  it('déterministe à seed égal', () => {
    expect(rollRandomTalent(makeRNG(42), new Set())).toBe(rollRandomTalent(makeRNG(42), new Set()));
  });
});

describe('resolveSpeciesTalents — fixes / choix / aléatoires', () => {
  it('Reiklander : Destinée (fixe), un choix résolu, et 3 talents aléatoires distincts', () => {
    const out = resolveSpeciesTalents(sp(), { rng: makeRNG(7) });
    // « Perspicace ou Affable » → 1er par défaut ; « Destinée » fixe ; « 3 Talent aléatoire »
    expect(out).toContain('Destinée');
    expect(out).toContain('Perspicace');
    // total = 1 (choix) + 1 (fixe) + 3 (aléatoires) = 5, tous distincts
    expect(out).toHaveLength(5);
    expect(new Set(out).size).toBe(5);
  });

  it('le choix « A ou B » est surchargeable', () => {
    const out = resolveSpeciesTalents(sp(), { rng: makeRNG(7), choices: { 'Perspicace ou Affable': 'Affable' } });
    expect(out).toContain('Affable');
    expect(out).not.toContain('Perspicace');
  });
});

describe('createHero — applique compétences et talents raciaux', () => {
  it('le héros reçoit ses compétences d’espèce (advances ≥ valeur raciale) et ses talents', () => {
    const hero = createHero({ speciesLabel: REIK, careerLabel: 'Soldat', name: 'Test', rng: makeRNG(3) });
    const calme = hero.skills.find((s) => s.name === 'Calme');
    expect(calme).toBeTruthy();
    expect(calme!.advances).toBeGreaterThanOrEqual(5); // +5 d'espèce (additif si aussi en carrière)
    expect(hero.talents.map((t) => t.name)).toContain('Destinée');
    // 5 talents raciaux + l'éventuel talent de carrière
    expect(hero.talents.length).toBeGreaterThanOrEqual(5);
  });
});
