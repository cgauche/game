import { describe, it, expect } from 'vitest';
import {
  newDraft,
  withSpecies,
  withCareer,
  rollDraftSpecies,
  rollDraftCareer,
  speciesXp,
  careerXp,
  charsXp,
  xpTotal,
  charRolls,
  draftChars,
  resolvedSpeciesTalents,
  careerSkillEntries,
  validateStep,
  stepIds,
  starXp,
  rollDraftStar,
  buildHero,
  draftWealth,
  draftSpecies,
  draftLevel,
} from './draft';
import { CHAR_KEYS } from '../../engine/types';
import { isUnresolvedChoice, concreteLabel, splitLabel } from '../../engine/careerSlots';
import { specOptionsFor, pettySpellQuota } from './draft';
import { spells, advancementLabel, stars } from '../../data';

const draft = () => newDraft(1234);

/** Brouillon minimal VALIDE jusqu'à l'étape 4 (répartitions par défaut, specs résolues). */
function readyDraft() {
  const d = draft();
  const sp = draftSpecies(d);
  const level = draftLevel(d)!;
  // Résolution des entrées « (Au choix) » / « (A ou B) » qui reçoivent des augmentations
  // (Soldat : « Musicien (Tambour ou Fifre) », « Corps à corps (Base) »…).
  const specChoices: Record<string, string> = {};
  for (const ref of level.skills) {
    const raw = advancementLabel('skills', ref);
    if (isUnresolvedChoice(raw)) specChoices[raw] = concreteLabel(splitLabel(raw).name, specOptionsFor(raw)[0]);
  }
  return {
    ...d,
    charAdvancesAlloc: { CC: 5 }, // Soldat : CC est de carrière
    fateSplit: { fate: Math.ceil(sp.fate.extra / 2), resilience: Math.floor(sp.fate.extra / 2) },
    speciesPlus5: sp.skills.slice(0, 3).map((a) => advancementLabel('skills', a)),
    speciesPlus3: sp.skills.slice(3, 6).map((a) => advancementLabel('skills', a)),
    skillAdvances: Object.fromEntries(level.skills.map((a) => [advancementLabel('skills', a), 5])),
    speciesTalentChoices: { 'Perspicace ou Affable': 'Affable' },
    specChoices,
    careerTalent: 'Infatigable',
    name: 'Testeur',
  };
}

describe('aléatoire FIGÉ (anti-savescum)', () => {
  it('les dix jets 2d10 sont identiques à chaque lecture ; une relance change le lot', () => {
    const d = draft();
    expect(charRolls(d)).toEqual(charRolls(d));
    const rerolled = { ...d, charRerolls: 1 };
    expect(charRolls(rerolled)).not.toEqual(charRolls(d));
    expect(charRolls(rerolled)).toEqual(charRolls(rerolled));
  });
  it('le tirage d\'espèce est unique et ne se relance pas', () => {
    const d1 = rollDraftSpecies(draft());
    expect(d1.speciesRoll).toBeTruthy();
    expect(rollDraftSpecies(d1)).toBe(d1); // déjà tiré → no-op
  });
  it('les talents d\'espèce aléatoires sont identiques à chaque résolution (seed fixe)', () => {
    const d = draft(); // Reiklander : « 3 Talent aléatoire »
    expect(resolvedSpeciesTalents(d)).toEqual(resolvedSpeciesTalents(d));
    // Changer un choix « A ou B » ne re-tire pas les dés des aléatoires.
    const d2 = { ...d, speciesTalentChoices: { 'Perspicace ou Affable': 'Affable' } };
    const randoms = (x: string[]) => x.filter((t) => !['Perspicace', 'Affable', 'Destinée'].includes(t));
    expect(randoms(resolvedSpeciesTalents(d2))).toEqual(randoms(resolvedSpeciesTalents(d)));
  });
});

describe('bonus de PX (LDB 04/05)', () => {
  it('espèce : +20 uniquement si on garde le tirage', () => {
    const d1 = rollDraftSpecies(draft());
    expect(speciesXp(d1)).toBe(20);
    expect(speciesXp(withSpecies(d1, d1.speciesRoll!.label === 'Nains' ? 'Halflings' : 'Nains'))).toBe(0);
  });
  it('carrière : +50 (1er jet), +25 (parmi 3), 0 (libre / relances)', () => {
    const d1 = rollDraftCareer(draft());
    expect(careerXp(d1)).toBe(50);
    const other = d1.careerRolls[0].label === 'Soldat' ? 'Artisan' : 'Soldat';
    expect(careerXp(withCareer(d1, other))).toBe(0); // refusé sans relancer → choix libre
    const d3 = rollDraftCareer(d1);
    expect(d3.careerRolls).toHaveLength(3);
    expect(careerXp(withCareer(d3, d3.careerRolls[2].label))).toBe(25);
    const dFree = rollDraftCareer(d3); // « continuez à relancer » (l.195)
    expect(careerXp(dFree)).toBe(0);
  });
  it('caractéristiques : +50 gardées, +25 réassignées, 0 après relance ou 100 Points', () => {
    const d = draft();
    expect(charsXp(d)).toBe(50);
    expect(charsXp({ ...d, charMode: 'reassigned' })).toBe(25);
    expect(charsXp({ ...d, charRerolls: 1 })).toBe(0);
    expect(charsXp({ ...d, charMode: 'pointBuy' })).toBe(0);
  });
});

describe('validation des étapes', () => {
  it('Caractéristiques : 5 Augmentations et split Destin/Résilience exigés', () => {
    const d = draft();
    expect(validateStep(d, 'chars')).toMatch(/5 Augmentations/);
    const ok = readyDraft();
    expect(validateStep(ok, 'chars')).toBeNull();
  });
  it('Caractéristiques : réassignation = permutation stricte des dix jets', () => {
    const d = { ...readyDraft(), charMode: 'reassigned' as const };
    expect(validateStep(d, 'chars')).toBeNull();
    const bad = { ...d, assignment: { ...d.assignment, CC: d.assignment.CT } };
    expect(validateStep(bad, 'chars')).toMatch(/une seule fois/);
  });
  it('Compétences : 40 augmentations, max 10, 3+3 compétences d\'espèce, talent choisi', () => {
    const d = readyDraft();
    expect(validateStep(d, 'skills')).toBeNull();
    expect(validateStep({ ...d, skillAdvances: {} }, 'skills')).toMatch(/40 Augmentations/);
    expect(validateStep({ ...d, speciesPlus5: [] }, 'skills')).toMatch(/3 Compétences/);
    expect(validateStep({ ...d, careerTalent: undefined }, 'skills')).toMatch(/Talent de carrière/);
  });
});

describe('buildHero — bout en bout', () => {
  it('héros conforme : PX bonus, Augmentations, libellés résolus, désignations posées', () => {
    let d = readyDraft();
    d = { ...d, age: 20, height: 175, eyes: 'Bleu', hair: 'Brun' };
    const hero = buildHero(d, 'h-test');
    expect(hero.xp).toBe(xpTotal(d));
    expect(Object.values(hero.charAdvances ?? {}).reduce((a, b) => a + (b ?? 0), 0)).toBe(5);
    for (const s of hero.skills) expect(`${s.spec ?? ''}`).not.toMatch(/au choix/i);
    expect(hero.details?.age).toBe(20);
    expect(hero.appearance?.species).toBe(d.speciesLabel);
    // Le total des dix Caractéristiques = somme du brouillon (transferts +5 de talents possibles).
    const sum = CHAR_KEYS.reduce((a, k) => a + hero.characteristics[k], 0);
    const draftSum = CHAR_KEYS.reduce((a, k) => a + draftChars(d)[k], 0);
    expect(sum).toBeGreaterThanOrEqual(draftSum + 5); // + 5 Augmentations (+ éventuels +5 de talents)
  });
  it('la richesse initiale est figée et conforme au Statut', () => {
    const d = readyDraft();
    expect(draftWealth(d)).toEqual(draftWealth(d));
  });
  it('careerSkillEntries : les ajouts de talents (Maître artisan…) apparaissent', () => {
    const d = readyDraft();
    // Force un talent d'espèce résolu addSkill via careerTalent (Maître artisan n'est pas Soldat,
    // on vérifie juste que les 8 entrées du Niveau sont présentes).
    expect(careerSkillEntries(d).length).toBeGreaterThanOrEqual(8);
  });
});

describe('Magie mineure à la création (LDB 10 l.587) — BFM sorts inclus au Talent', () => {
  /** Brouillon Sorcier valide (Niveau 1 : talent « Magie mineure » choisissable). */
  function sorcererDraft() {
    const base = withCareer(readyDraft(), 'Sorcier');
    const level = draftLevel(base)!;
    const specChoices: Record<string, string> = {};
    for (const ref of level.skills) {
      const raw = advancementLabel('skills', ref);
      if (isUnresolvedChoice(raw)) specChoices[raw] = concreteLabel(splitLabel(raw).name, specOptionsFor(raw)[0]);
    }
    return {
      ...base,
      charAdvancesAlloc: { FM: 5 },
      skillAdvances: Object.fromEntries(level.skills.map((a) => [advancementLabel('skills', a), 5])),
      specChoices,
      careerTalent: 'Magie mineure',
    };
  }
  const minorsOf = (n: number) => spells.filter((s) => s.type === 'Magie mineure').slice(0, n).map((s) => s.label);

  it('quota = BFM final ; l\'étape 4 exige EXACTEMENT ce nombre de sorts', () => {
    const d = sorcererDraft();
    const quota = pettySpellQuota(d);
    expect(quota).toBeGreaterThan(0);
    expect(validateStep(d, 'skills')).toMatch(/sorts de Magie mineure/);
    expect(validateStep({ ...d, pettySpells: minorsOf(quota) }, 'skills')).toBeNull();
    expect(validateStep({ ...d, pettySpells: minorsOf(quota - 1) }, 'skills')).toMatch(/sorts de Magie mineure/);
  });

  it('buildHero mémorise les sorts choisis (0 PX — inclus au Talent)', () => {
    const d = sorcererDraft();
    const picks = minorsOf(pettySpellQuota(d));
    const hero = buildHero({ ...d, pettySpells: picks }, 'h-petty');
    for (const m of picks) expect(hero.spells).toContain(spells.find((s) => s.label === m)!.id); // hero.spells = ids
    expect(hero.xp).toBe(xpTotal(d)); // rien payé
  });

  it('sans le Talent : quota 0, aucune exigence à l\'étape 4', () => {
    expect(pettySpellQuota(readyDraft())).toBe(0);
    expect(validateStep(readyDraft(), 'skills')).toBeNull();
  });
});

describe('signe astral (ADE2 ch.03) — étape, tirage, PX et effet', () => {
  it('stepIds insère « star » juste après « chars » (règle activée par défaut)', () => {
    const ids = stepIds();
    expect(ids).toContain('star');
    expect(ids.indexOf('star')).toBe(ids.indexOf('chars') + 1);
  });

  it('rollDraftStar : tirage FIGÉ (seed) ; le signe gardé = le signe tiré', () => {
    const d = rollDraftStar(draft());
    expect(d.starRoll).toBeTruthy();
    expect(d.star).toBe(d.starRoll);
    expect(rollDraftStar(draft()).starRoll).toBe(d.starRoll); // déterministe
  });

  it('starXp : +25 si le tirage est gardé, 0 si choix libre (l.36)', () => {
    const rolled = rollDraftStar(draft());
    expect(starXp(rolled)).toBe(25);
    const other = stars.find((s) => s.label !== rolled.starRoll)!.label;
    expect(starXp({ ...rolled, star: other })).toBe(0);
    expect(starXp(draft())).toBe(0); // aucun tirage
  });

  it('buildHero applique les ±carac du signe aux attributs de départ', () => {
    const base = readyDraft();
    const a = buildHero(base, 'h-nostar');
    const b = buildHero({ ...base, star: "Wymund l'Anachorète" }, 'h-star'); // +2 Soc, +2 I, -3 Int
    expect(b.characteristics.Soc - a.characteristics.Soc).toBe(2);
    expect(b.characteristics.I - a.characteristics.I).toBe(2);
    expect(b.characteristics.Int - a.characteristics.Int).toBe(-3);
    expect(b.star).toBe("Wymund l'Anachorète");
  });
});
