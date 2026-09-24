import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { findSpeciesById, talentConcrete, talents, specPoolOf } from '../data';
import {
  speciesSkillDefaults,
  rollRandomTalent,
  resolveSpeciesTalents,
  createHero,
} from './character';
import { refKey } from './careerSlots';
import { baseWithTalents } from './talentEffects';
import { traitConsumptionFactor } from './provisions';
import { traitEncumbranceFactor } from './combatFeatures/dispatch';

const REIK = 'humains-reiklander';
const sp = () => findSpeciesById(REIK)!;

describe('speciesSkillDefaults — 3×+5 / 3×+3 (LDB 05 l.484)', () => {
  it('par défaut : 3 premières compétences +5, 3 suivantes +3', () => {
    const m = speciesSkillDefaults(sp());
    // Reiklander : Calme, Charme, Commandement, Corps à corps (Base), Évaluation, Langue (Bretonnien)…
    expect(m.plus5).toEqual([{ id: 'calme' }, { id: 'charme' }, { id: 'commandement' }]);
    expect(m.plus3).toEqual([{ id: 'corps-a-corps', spec: 'base' }, { id: 'evaluation' }, { id: 'langue', spec: 'bretonnien' }]);
  });
});

describe('rollRandomTalent — Tableau des Talents aléatoires (table d100)', () => {
  it('renvoie un talent de la table', () => {
    const t = rollRandomTalent(makeRNG(1), new Set());
    expect(talents.find((x) => x.id === t?.id)?.rand).toBeDefined();
  });

  it('relance si le talent est déjà possédé (LDB : « vous pouvez relancer »)', () => {
    // On possède déjà le talent du seed 1 → un nouveau tirage doit donner autre chose.
    const first = rollRandomTalent(makeRNG(1), new Set())!;
    const second = rollRandomTalent(makeRNG(1), new Set([refKey(first.id, first.spec)]))!;
    expect(refKey(second.id, second.spec)).not.toBe(refKey(first.id, first.spec));
  });

  it('déterministe à seed égal', () => {
    expect(rollRandomTalent(makeRNG(42), new Set())).toEqual(rollRandomTalent(makeRNG(42), new Set()));
  });

  // `owned` est keyé par `refKey(talentId, specId)` : deux specs distinctes d'un talent groupé restent
  // deux entités (LDB 10 l.13-20).
  it('une spec possédée ne bloque pas les AUTRES specs du même talent groupé', () => {
    const grouped = talents.find((t) => t.rand != null && specPoolOf(t).length > 1)!;
    const [specA] = specPoolOf(grouped);
    const owned = new Set([refKey(grouped.id, specA)]);
    for (let seed = 0; seed < 200; seed++) {
      const t = rollRandomTalent(makeRNG(seed), owned)!;
      if (t.id === grouped.id) expect(t.spec).not.toBe(specA);
    }
  });
});

describe('resolveSpeciesTalents — fixes / choix / aléatoires', () => {
  it('Reiklander : Destinée (fixe), un choix résolu, et 3 talents aléatoires distincts', () => {
    const out = resolveSpeciesTalents(sp(), { rng: makeRNG(7) });
    // « Perspicace ou Affable » → 1er par défaut ; « Destinée » fixe ; « 3 Talent aléatoire »
    expect(out).toContainEqual({ id: 'destinee' });
    expect(out).toContainEqual({ id: 'perspicace' });
    // total = 1 (choix) + 1 (fixe) + 3 (aléatoires) = 5, tous distincts
    expect(out).toHaveLength(5);
    expect(new Set(out.map((t) => refKey(t.id, t.spec))).size).toBe(5);
  });

  it('le choix « A ou B » est surchargeable, par adresse d\'emplacement', () => {
    const out = resolveSpeciesTalents(sp(), { rng: makeRNG(7), choices: { 'espece:talents:0': 1 } });
    expect(out).toContainEqual({ id: 'affable' });
    expect(out).not.toContainEqual({ id: 'perspicace' });
  });
});

describe('createHero — applique compétences et talents raciaux', () => {
  it('le héros reçoit ses compétences d’espèce (advances ≥ valeur raciale) et ses talents', () => {
    const hero = createHero({ speciesId: REIK, careerId: 'soldat', label: 'Test', rng: makeRNG(3) });
    const calme = hero.skills.find((s) => s.id === 'calme');
    expect(calme).toBeTruthy();
    expect(calme!.advances).toBeGreaterThanOrEqual(5); // +5 d'espèce (additif si aussi en carrière)
    expect(hero.talents.map((t) => talentConcrete(t))).toContain('Destinée');
    // 5 talents raciaux + l'éventuel talent de carrière
    expect(hero.talents.length).toBeGreaterThanOrEqual(5);
  });

  it('aucun libellé « (Au choix) » résiduel sur le héros (specs résolues)', () => {
    for (const seed of [1, 5, 9]) {
      const hero = createHero({ speciesId: 'nains', careerId: 'artisan', label: 'T', rng: makeRNG(seed) });
      for (const s of hero.skills) expect(s.spec ?? '').not.toMatch(/au choix|\sou\s/i);
      for (const t of hero.talents) expect(talentConcrete(t)).not.toMatch(/\(.*au choix.*\)/i);
    }
  });

  it('5 Augmentations gratuites sur les 3 Caractéristiques de carrière (LDB 05 l.459)', () => {
    const hero = createHero({ speciesId: REIK, careerId: 'soldat', label: 'T', rng: makeRNG(3) });
    const total = Object.values(hero.charAdvances ?? {}).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBe(5);
    // La répartition explicite s'ajoute aux valeurs initiales.
    const manual = createHero({
      speciesId: REIK,
      careerId: 'soldat', // Caractéristiques de carrière : CC, F, E (Recrue)
      label: 'T',
      rng: makeRNG(3),
      manualChars: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      charAdvancesAlloc: { 'capacite-de-combat': 5 },
      careerTalent: { id: 'infatigable' }, // PAS Guerrier né (+5 CC), pour isoler les Augmentations
      speciesTalentsResolved: [{ id: 'affable' }, { id: 'destinee' }], // pas de tirages → déterministe
    });
    expect(manual.charAdvances!['capacite-de-combat']).toBe(5);
    expect(manual.characteristics['capacite-de-combat']).toBe(35);
  });

  it('« +5 Caractéristique de départ » passif (Affable → Soc +5 via charMod), sans Augmentation comptée', () => {
    const hero = createHero({
      speciesId: REIK,
      careerId: 'soldat',
      label: 'T',
      manualChars: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      charAdvancesAlloc: { 'capacite-de-combat': 5 },
      speciesTalentsResolved: [{ id: 'affable' }, { id: 'destinee' }],
      rng: makeRNG(3),
    });
    // La valeur brute reste 30 (passif non cuit) ; baseWithTalents lit le charMod du talent.
    expect(hero.characteristics.sociabilite).toBe(30); // base INCHANGÉE
    expect(baseWithTalents(hero, 'sociabilite')).toBe(35); // base + passif Affable = 35
    expect(hero.charAdvances?.sociabilite ?? 0).toBe(0);
  });

  it('talent de carrière = talent d\'espèce → times 2 (LDB 05 l.535, LDB 10 l.9) ; Blessures avec Dur à cuire', () => {
    const hero = createHero({
      speciesId: REIK,
      careerId: 'milicien', // Niveau 1 propose « Dur à cuire »
      label: 'T',
      manualChars: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      charAdvancesAlloc: { 'capacite-de-combat': 5 },
      careerTalent: { id: 'dur-a-cuire' },
      speciesTalentsResolved: [{ id: 'affable' }, { id: 'destinee' }, { id: 'dur-a-cuire' }],
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
      label: 'T',
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
      label: 'T',
      careerTalent: { id: 'sens-aiguise', spec: 'gout' },
      speciesTalentsResolved: [{ id: 'petit' }, { id: 'resistance', spec: 'corruption' }, { id: 'sens-aiguise', spec: 'gout' }, { id: 'vision-nocturne' }],
      rng: makeRNG(3),
    });
    expect(hero.talents.find((t) => talentConcrete(t) === 'Sens aiguisé (Goût)')!.times).toBe(2);
  });

  it('Talent de carrière : pris au Niveau 1 (LDB 05 l.535), un emplacement « (Au choix) » exige sa spécialisation (LDB 10 l.17)', () => {
    const cree = (careerTalent: { id: string; spec?: string }) =>
      () => createHero({ speciesId: 'humains-reiklander', careerId: 'pretre', label: 'T', careerTalent, rng: makeRNG(5) });
    expect(cree({ id: 'beni' })).toThrow(/Talent de carrière « beni ».*pretre.*exige une spécialisation \(LDB 10 l\.17\)/);
    expect(cree({ id: 'acrobate' })).toThrow(/Talent de carrière « acrobate ».*absent du Niveau 1 de « pretre » \(LDB 05 l\.535\)/);
    const hero = cree({ id: 'beni', spec: 'sigmar' })();
    expect(Object.values(hero.careerSlotChoices?.pretre ?? {})).toContain('beni|sigmar');
  });

  it('entrée d\'espèce mixte « Destinée ou Talent aléatoire » : la branche aléatoire tire un talent', () => {
    const middenland = findSpeciesById('humains-middenland');
    if (!middenland) return; // espèce ADE absente → rien à tester
    const out = resolveSpeciesTalents(middenland, {
      rng: makeRNG(11),
      choices: { 'espece:talents:1': 1 }, // « Destinée ou Talent aléatoire » → la branche aléatoire
    });
    expect(out).not.toContainEqual({ id: 'destinee' });
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
});

describe('createHero — Trait racial + Taille par talent (#572)', () => {
  it('un héros Ogre porte le trait racial `ogre` (encombrance/consommation ×2) et sa Taille est Grande', () => {
    const hero = createHero({ speciesId: 'ogres', careerId: 'ratier', label: 'Grosminet', rng: makeRNG(3) });
    expect(hero.traits).toEqual([{ id: 'ogre' }]);
    expect(hero.talents.some((t) => t.talentId === 'massif')).toBe(true);
    expect(hero.size).toBe('grande');
    expect(traitConsumptionFactor(hero)).toBe(2);
    expect(traitEncumbranceFactor(hero)).toBe(2);
  });

  it('un héros Halfling (talent Petit) a une Taille Petite, sans trait racial ni facteur ×2', () => {
    const hero = createHero({ speciesId: 'halflings', careerId: 'marchand', label: 'Bilbon', rng: makeRNG(3) });
    expect(hero.talents.some((t) => t.talentId === 'petit')).toBe(true);
    expect(hero.size).toBe('petite');
    expect(hero.traits ?? []).toEqual([]);
    expect(traitConsumptionFactor(hero)).toBe(1);
    expect(traitEncumbranceFactor(hero)).toBe(1);
  });

  it('un héros humain (ni Massif ni Petit) a une Taille Moyenne', () => {
    const hero = createHero({ speciesId: REIK, careerId: 'soldat', label: 'T', rng: makeRNG(3) });
    expect(hero.size).toBe('moyenne');
  });
});
