import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { findSpeciesById, talentConcrete } from '../data';
import {
  speciesSkillAdvanceMap,
  rollRandomTalent,
  resolveSpeciesTalents,
  createHero,
} from './character';
import { baseWithTalents } from './talentEffects';

const REIK = 'humains-reiklander';
const sp = () => findSpeciesById(REIK)!;

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
    const hero = createHero({ speciesId: REIK, careerId: 'soldat', name: 'Test', rng: makeRNG(3) });
    const calme = hero.skills.find((s) => s.skillId === 'calme');
    expect(calme).toBeTruthy();
    expect(calme!.advances).toBeGreaterThanOrEqual(5); // +5 d'espèce (additif si aussi en carrière)
    expect(hero.talents.map((t) => talentConcrete(t))).toContain('Destinée');
    // 5 talents raciaux + l'éventuel talent de carrière
    expect(hero.talents.length).toBeGreaterThanOrEqual(5);
  });

  it('aucun libellé « (Au choix) » résiduel sur le héros (specs résolues)', () => {
    for (const seed of [1, 5, 9]) {
      const hero = createHero({ speciesId: 'nains', careerId: 'artisan', name: 'T', rng: makeRNG(seed) });
      for (const s of hero.skills) expect(s.spec ?? '').not.toMatch(/au choix|\sou\s/i);
      for (const t of hero.talents) expect(talentConcrete(t)).not.toMatch(/\(.*au choix.*\)/i);
    }
  });

  it('5 Augmentations gratuites sur les 3 Caractéristiques de carrière (LDB 05 l.488)', () => {
    const hero = createHero({ speciesId: REIK, careerId: 'soldat', name: 'T', rng: makeRNG(3) });
    const total = Object.values(hero.charAdvances ?? {}).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBe(5);
    // La répartition explicite s'ajoute aux valeurs initiales.
    const manual = createHero({
      speciesId: REIK,
      careerId: 'soldat', // Caractéristiques de carrière : CC, F, E (Recrue)
      name: 'T',
      rng: makeRNG(3),
      manualChars: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
      charAdvancesAlloc: { CC: 5 },
      careerTalent: 'Infatigable', // PAS Guerrier né (+5 CC), pour isoler les Augmentations
      speciesTalentsResolved: ['Affable', 'Destinée'], // pas de tirages → déterministe
    });
    expect(manual.charAdvances?.CC).toBe(5);
    expect(manual.characteristics.CC).toBe(35);
  });

  it('« +5 Caractéristique de départ » passif (Affable → Soc +5 via charMod), sans Augmentation comptée', () => {
    const hero = createHero({
      speciesId: REIK,
      careerId: 'soldat',
      name: 'T',
      manualChars: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
      charAdvancesAlloc: { CC: 5 },
      speciesTalentsResolved: ['Affable', 'Destinée'],
      rng: makeRNG(3),
    });
    // La valeur brute reste 30 (passif non cuit) ; baseWithTalents lit le charMod du talent.
    expect(hero.characteristics.Soc).toBe(30); // base INCHANGÉE
    expect(baseWithTalents(hero, 'Soc')).toBe(35); // base + passif Affable = 35
    expect(hero.charAdvances?.Soc ?? 0).toBe(0);
  });

  it('talent de carrière = talent d\'espèce → times 2 (LDB 05 l.502) ; Blessures avec Dur à cuire', () => {
    const hero = createHero({
      speciesId: REIK,
      careerId: 'soldat', // Recrue propose « Dur à cuire »
      name: 'T',
      manualChars: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
      charAdvancesAlloc: { CC: 5 },
      careerTalent: 'Dur à cuire',
      speciesTalentsResolved: ['Affable', 'Destinée', 'Dur à cuire'],
      rng: makeRNG(3),
    });
    expect(hero.talents.find((t) => talentConcrete(t) === 'Dur à cuire')!.times).toBe(2);
    // Blessures = BF+2BE+BFM (3+6+3=12) + 2 × BE (Dur à cuire ×2) = 18.
    expect(hero.wounds.max).toBe(18);
  });

  it('PX bonus de la création conservés ; détails portés', () => {
    const hero = createHero({
      speciesId: REIK,
      careerId: 'soldat',
      name: 'T',
      rng: makeRNG(3),
      xpBonus: 95,
      details: { age: 22, height: 178, eyes: 'Bleu', hair: 'Brun clair', ambitionShort: 'X', ambitionLong: 'Y' },
    });
    expect(hero.xp).toBe(95);
    expect(hero.details?.age).toBe(22);
    expect(hero.details?.ambitionLong).toBe('Y');
  });

  it('Halfling Herboriste : Sens aiguisé (Goût) d\'espèce reprenable en talent de carrière (times 2)', () => {
    const hero = createHero({
      speciesId: 'halflings',
      careerId: 'herboriste',
      name: 'T',
      careerTalent: 'Sens aiguisé (Goût)',
      speciesTalentsResolved: ['Petit', 'Résistance (Corruption)', 'Sens aiguisé (Goût)', 'Vision nocturne'],
      rng: makeRNG(3),
    });
    expect(hero.talents.find((t) => talentConcrete(t) === 'Sens aiguisé (Goût)')!.times).toBe(2);
  });

  it('entrée d\'espèce mixte « Destinée ou Talent aléatoire » : la branche aléatoire tire un talent', () => {
    const middenland = findSpeciesById('humains-middenland');
    if (!middenland) return; // espèce ADE absente → rien à tester
    const out = resolveSpeciesTalents(middenland, {
      rng: makeRNG(11),
      choices: { 'Destinée ou Talent aléatoire': 'Talent aléatoire' },
    });
    expect(out).not.toContain('Destinée');
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
});
