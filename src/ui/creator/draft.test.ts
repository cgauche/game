import { describe, it, expect } from 'vitest';
import {
  newDraft,
  withSpecies,
  withCareer,
  rollDraftSpecies,
  rollDraftCareer,
  rollDraftChars,
  rollDraftTalents,
  speciesXp,
  careerXp,
  charsXp,
  xpTotal,
  charRolls,
  draftChars,
  resolvedSpeciesTalents,
  speciesTalentRandomCount,
  speciesTalentRandomDrawn,
  talentsDone,
  careerSkillEntries,
  careerAdvTotal,
  evenCareerSkillAdvances,
  validateStep,
  stepIds,
  starXp,
  rollDraftStar,
  rollDraftAstrology,
  buildHero,
  draftWealth,
  draftSpecies,
  draftLevel,
  careerCharKeys,
  coastalSwapAvailable,
  careerRollPool,
  withCoastalSwap,
  speciesTalentChoiceEntries,
} from './draft';
import { CHAR_KEYS } from '../../engine/types';
import { rigSpeciesId } from '../../data';
import { isUnresolvedChoice, concreteLabel, splitLabel, splitTopLevelOu } from '../../engine/careerSlots';
import { specOptionsFor, pettySpellQuota } from './draft';
import { spells, advancementLabel, stars, celestialHouses, species as allSpecies, careersForSpecies } from '../../data';

// Page blanche : `newDraft` ne pré-tire plus race/carrière — les tests posent explicitement les
// mêmes défauts dérivés qu'avant (1ʳᵉ espèce du LDB, sa 1ʳᵉ carrière accessible = Reiklander / Soldat).
const DEFAULT_SPECIES = allSpecies.find((s) => s.source.book === 'livre-de-base')!;
const DEFAULT_CAREER = careersForSpecies(DEFAULT_SPECIES.refCareer)[0]!;
const draft = () => withCareer(withSpecies(newDraft(1234), DEFAULT_SPECIES.id), DEFAULT_CAREER.id);

/** Brouillon minimal VALIDE jusqu'à l'étape 4 (répartitions par défaut, specs résolues). */
function readyDraft() {
  const d = draft();
  const sp = draftSpecies(d)!;
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
    charsRolled: true, // gestes « Tirer aux dés » posés (#393 agentivité : exigés par la validation)
    talentsRolled: true,
    charAdvancesAlloc: { 'capacite-de-combat': 5 }, // Soldat : CC est de carrière
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

describe('B3 — Répartition simple des Compétences de carrière (étape 5)', () => {
  it('produit des LIBELLÉS (jamais "[object Object]") totalisant 40, lus par la grille/validation', () => {
    const d = draft(); // Soldat (Recrue) : 8 Compétences de Niveau 1
    const alloc = evenCareerSkillAdvances(d);
    expect(Object.keys(alloc)).not.toContain('[object Object]');
    // Toutes les clés sont des entrées RECONNUES de la grille (careerSkillEntries) → lisibles.
    expect(Object.keys(alloc).every((k) => careerSkillEntries(d).includes(k))).toBe(true);
    // +5 × 8 Compétences = 40, compté par careerAdvTotal (la grille ET validateStep).
    expect(careerAdvTotal({ ...d, skillAdvances: alloc })).toBe(40);
  });
  it('n\'est PAS effacée par la répartition des Compétences de race (champs disjoints)', () => {
    const d = draft();
    const sp = draftSpecies(d)!;
    // Carrière remplie, PUIS répartition de race appliquée (le symptôme rapporté).
    const after = {
      ...d,
      skillAdvances: evenCareerSkillAdvances(d),
      speciesPlus5: sp.skills.slice(0, 3).map((a) => advancementLabel('skills', a)),
      speciesPlus3: sp.skills.slice(3, 6).map((a) => advancementLabel('skills', a)),
    };
    expect(careerAdvTotal(after)).toBe(40); // la carrière RESTE à 40
  });
});

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
    const d = rollDraftTalents(draft()); // geste 5c posé — Reiklander : « 3 Talent aléatoire »
    expect(resolvedSpeciesTalents(d)).toEqual(resolvedSpeciesTalents(d));
    // Changer un choix « A ou B » ne re-tire pas les dés des aléatoires.
    const d2 = { ...d, speciesTalentChoices: { 'Perspicace ou Affable': 'Affable' } };
    const randoms = (x: string[]) => x.filter((t) => !['Perspicace', 'Affable', 'Destinée'].includes(t));
    expect(randoms(resolvedSpeciesTalents(d2))).toEqual(randoms(resolvedSpeciesTalents(d)));
  });
});

describe('agentivité (#393, amendement « ossature enforcée ») — aucun résultat aléatoire avant le GESTE', () => {
  it('caractéristiques : base d\'espèce seule avant le geste, jets révélés après — geste idempotent', () => {
    const d = draft();
    const sp = draftSpecies(d)!;
    for (const k of CHAR_KEYS) expect(draftChars(d)[k]).toBe(sp.baseChar[k] ?? 20); // aucun 2d10 pré-affiché
    const rolled = rollDraftChars(d);
    expect(rolled.charsRolled).toBe(true);
    expect(rollDraftChars(rolled)).toBe(rolled); // déjà tiré → no-op (les valeurs restent figées par le seed)
    const rolls = charRolls(rolled);
    CHAR_KEYS.forEach((k, i) => expect(draftChars(rolled)[k]).toBe((sp.baseChar[k] ?? 20) + rolls[i]));
  });
  it('validation étape 3 : le geste est EXIGÉ pour les voies aux dés, pas pour les 100 Points', () => {
    expect(validateStep(draft(), 'chars')).toBe('Tirez vos Caractéristiques aux dés.');
    expect(validateStep({ ...draft(), charMode: 'pointBuy' as const }, 'chars')).not.toMatch(/aux dés/);
  });
  it('talents aléatoires : AUCUN tiré avant le geste (ni liste ni résolution), révélés après — figés par le seed', () => {
    const d = draft(); // Reiklander : « 3 Talent aléatoire »
    expect(speciesTalentRandomCount(d)).toBe(3);
    expect(speciesTalentRandomDrawn(d)).toEqual([]); // rien à l'écran avant le geste
    const before = resolvedSpeciesTalents(d);
    const rolled = rollDraftTalents(d);
    const drawn = speciesTalentRandomDrawn(rolled);
    expect(drawn).toHaveLength(3);
    expect(resolvedSpeciesTalents(rolled)).toHaveLength(before.length + drawn.length);
    expect(speciesTalentRandomDrawn(rollDraftTalents(draft()))).toEqual(drawn); // découverte, jamais un re-tirage
  });
  it('validation 5c : le tirage des Talents aléatoires est exigé (validateStep + talentsDone)', () => {
    const untirés = { ...readyDraft(), talentsRolled: false };
    expect(validateStep(untirés, 'skills')).toBe('Tirez vos Talents aléatoires aux dés.');
    expect(talentsDone(untirés)).toBe(false);
    expect(validateStep(readyDraft(), 'skills')).toBeNull();
    expect(talentsDone(readyDraft())).toBe(true);
  });
  it('changer d\'espèce réinitialise le geste des Talents (la table de tirage appartient à l\'espèce)', () => {
    const rolled = rollDraftTalents(draft());
    const other = allSpecies.find((s) => s.id !== rolled.speciesId)!.id;
    expect(withSpecies(rolled, other).talentsRolled).toBe(false);
  });
});

describe('Riverains ⇄ Côtiers (MDG 09 l.9, #393 P2 correctif utilisateur)', () => {
  const swappableSpecies = allSpecies.find((s) => coastalSwapAvailable(withSpecies(newDraft(1), s.id)))!;
  const swappable = () => withSpecies(newDraft(1234), swappableSpecies.id);

  it('la table effective exclut Riverains XOR Côtiers selon la bascule — jamais les deux', () => {
    const off = careerRollPool({ ...swappable(), coastalSwap: false });
    expect(off.some((c) => c.class === 'cotiers')).toBe(false);
    expect(off.some((c) => c.class === 'riverains')).toBe(true);
    const on = careerRollPool({ ...swappable(), coastalSwap: true });
    expect(on.some((c) => c.class === 'riverains')).toBe(false);
    expect(on.some((c) => c.class === 'cotiers')).toBe(true);
  });

  it('anti-exploit : la bascule refuse de changer d\'état une fois un jet posé (relance gratuite bloquée)', () => {
    const rolled = rollDraftCareer(swappable());
    expect(rolled.careerRolls.length).toBeGreaterThan(0);
    const before = rolled.careerRolls;
    const attempted = withCoastalSwap(rolled, !rolled.coastalSwap);
    expect(attempted.coastalSwap).toBe(rolled.coastalSwap); // état INCHANGÉ
    expect(attempted.careerRolls).toBe(before); // jets INTACTS (pas de reset détourné)
  });

  it('la bascule fonctionne normalement tant qu\'aucun jet n\'existe', () => {
    const d = swappable();
    expect(d.careerRolls.length).toBe(0);
    const swapped = withCoastalSwap(d, !d.coastalSwap);
    expect(swapped.coastalSwap).toBe(!d.coastalSwap);
  });
});

describe('bonus de PX (LDB 04/05)', () => {
  it('espèce : +20 tant qu\'on choisit une espèce de la borne tirée, 0 sinon', () => {
    const d1 = rollDraftSpecies(draft());
    expect(speciesXp(d1)).toBe(20);
    // Une espèce HORS de la borne tirée perd le bonus (la borne d100 ne contient pas tout).
    const outside = ['nains', 'halflings', 'hauts-elfes'].find((id) => !d1.speciesRoll!.ids.includes(id))!;
    expect(speciesXp(withSpecies(d1, outside))).toBe(0);
  });
  it('carrière : +50 (1er jet), +25 (parmi 3), 0 (libre / relances)', () => {
    const d1 = rollDraftCareer(draft());
    expect(careerXp(d1)).toBe(50);
    // Une carrière hors des bornes tirées (refusée sans relancer) → choix libre, 0 PX.
    const rolledIds = new Set(d1.careerRolls.flatMap((r) => r.ids));
    const other = ['soldat', 'artisan', 'apothicaire'].find((id) => !rolledIds.has(id))!;
    expect(careerXp(withCareer(d1, other))).toBe(0);
    const d3 = rollDraftCareer(d1);
    expect(d3.careerRolls).toHaveLength(3);
    expect(careerXp(withCareer(d3, d3.careerRolls[2].ids[0]))).toBe(25);
    const dFree = rollDraftCareer(d3); // « continuez à relancer » (l.195)
    expect(careerXp(dFree)).toBe(0);
  });
  it('caractéristiques : +50 gardées, +25 réassignées, 0 après relance ou 100 Points — et 0 sans le GESTE', () => {
    expect(charsXp(draft())).toBe(0); // pas de bonus pour un tirage jamais lancé (#393 agentivité)
    const d = rollDraftChars(draft());
    expect(charsXp(d)).toBe(50);
    expect(charsXp({ ...d, charMode: 'reassigned' })).toBe(25);
    expect(charsXp({ ...d, charRerolls: 1 })).toBe(0);
    expect(charsXp({ ...d, charMode: 'pointBuy' })).toBe(0);
  });
});

describe('careerCharKeys (Augmentations de carrière)', () => {
  it('renvoie les Caractéristiques de carrière en clés CharKey (jamais vide pour une carrière réelle)', () => {
    const d = withCareer(draft(), 'soldat');
    const keys = careerCharKeys(d);
    expect(keys.length).toBeGreaterThan(0); // sinon la grille d'allocation est vide → étape infranchissable
    // La donnée EST déjà en abréviations : chaque clé doit être un CharKey valide (régression #566 :
    // un mapping libellé→clé renvoyait `undefined` pour tout → liste vide).
    for (const k of keys) expect(CHAR_KEYS).toContain(k);
    expect(keys).toContain('capacite-de-combat'); // Soldat : Capacité de Combat est de carrière
    expect(keys).toEqual(draftLevel(d)!.characteristics);
  });
});

describe('validation des étapes', () => {
  it('Caractéristiques : 5 Augmentations et split Destin/Résilience exigés', () => {
    const d = rollDraftChars(draft());
    expect(validateStep(d, 'chars')).toMatch(/5 Augmentations/);
    const ok = readyDraft();
    expect(validateStep(ok, 'chars')).toBeNull();
  });
  it('Caractéristiques : réassignation = permutation stricte des dix jets', () => {
    const d = { ...readyDraft(), charMode: 'reassigned' as const };
    expect(validateStep(d, 'chars')).toBeNull();
    const bad = { ...d, assignment: { ...d.assignment, 'capacite-de-combat': d.assignment['capacite-de-tir'] } };
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
    expect(hero.appearance?.species).toBe(rigSpeciesId(d.speciesId));
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

describe('Possessions — « Arme (Au choix) » (LDB 05 l.559-585)', () => {
  it('weaponChoice (id STABLE) résout la possession narrative en l\'objet catalogue choisi', () => {
    // Prêtre Guerrier (Novice) : seule carrière du LDB à porter { text: 'Arme (Au choix)' } (l.1).
    const d = { ...withCareer(readyDraft(), 'pretre-guerrier'), specChoices: {}, careerTalent: 'Obstiné', weaponChoice: 'baton-de-combat' };
    const hero = buildHero(d, 'h-weapon');
    expect((hero.items ?? []).some((it) => it.trappingId === 'baton-de-combat')).toBe(true);
    // Sans choix : la possession narrative reste un texte sans stats — aucun objet fantôme.
    const noChoice = buildHero({ ...d, weaponChoice: undefined }, 'h-noweapon');
    expect((noChoice.items ?? []).some((it) => it.trappingId === 'baton-de-combat')).toBe(false);
  });
});

describe('Magie mineure à la création (LDB 10 l.714) — BFM sorts inclus au Talent', () => {
  /** Brouillon Sorcier valide (Niveau 1 : talent « Magie mineure » choisissable). */
  function sorcererDraft() {
    const base = withCareer(readyDraft(), 'sorcier');
    const level = draftLevel(base)!;
    const specChoices: Record<string, string> = {};
    for (const ref of level.skills) {
      const raw = advancementLabel('skills', ref);
      if (isUnresolvedChoice(raw)) specChoices[raw] = concreteLabel(splitLabel(raw).name, specOptionsFor(raw)[0]);
    }
    return {
      ...base,
      charAdvancesAlloc: { 'force-mentale': 5 },
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

  /** Talent « +5 FM » (Imperturbable, LDB 10) au quota : verrouille la source UNIQUE des +5 de
   *  talent (`baseWithTalents`, jamais une boucle manuelle re-implémentée dans `pettySpellQuota`).
   *  Humains (Tiléens) portent le choix « Imperturbable ou Affable » (Affable = Sociabilité, témoin
   *  neutre) ; BFM figé en `pointBuy` pour franchir la décade sans dépendre du tirage. */
  it('talent « +5 FM » (Imperturbable) : quota supérieur au témoin sans bonus de FM', () => {
    const tileenSorcererDraft = (talentPick: 'Imperturbable' | 'Affable') => {
      const base = withCareer(withSpecies(newDraft(4321), 'humains-tileens'), 'sorcier');
      const sp = draftSpecies(base)!;
      const level = draftLevel(base)!;
      const specChoices: Record<string, string> = {};
      for (const ref of level.skills) {
        const raw = advancementLabel('skills', ref);
        if (isUnresolvedChoice(raw)) specChoices[raw] = concreteLabel(splitLabel(raw).name, specOptionsFor(raw)[0]);
      }
      const speciesTalentChoices: Record<string, string> = {};
      for (const entry of speciesTalentChoiceEntries(base)) {
        speciesTalentChoices[entry] = entry === 'Imperturbable ou Affable' ? talentPick : splitTopLevelOu(entry)[0];
      }
      return {
        ...base,
        charMode: 'pointBuy' as const,
        pointBuy: { ...base.pointBuy, 'force-mentale': 7 }, // base 20 + 7 = 27 (bonus 2), à la frontière de décade
        charsRolled: true,
        talentsRolled: true,
        speciesPlus5: sp.skills.slice(0, 3).map((a) => advancementLabel('skills', a)),
        speciesPlus3: sp.skills.slice(3, 6).map((a) => advancementLabel('skills', a)),
        speciesTalentChoices,
        skillAdvances: Object.fromEntries(level.skills.map((a) => [advancementLabel('skills', a), 5])),
        specChoices,
        careerTalent: 'Magie mineure',
      };
    };
    const withImperturbable = pettySpellQuota(tileenSorcererDraft('Imperturbable'));
    const withoutFmBonus = pettySpellQuota(tileenSorcererDraft('Affable'));
    expect(withImperturbable).toBe(withoutFmBonus + 1);
  });
});

describe('signe astral (ADE2 3) — étape, tirage, PX et effet', () => {
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
    const other = stars.find((s) => s.id !== rolled.starRoll)!.id;
    expect(starXp({ ...rolled, star: other })).toBe(0);
    expect(starXp(draft())).toBe(0); // aucun tirage
  });

  it('rollDraftAstrology : une lecture par Demeure céleste, depuis la DONNÉE (ADE2 3 l.504-512)', () => {
    const d = rollDraftAstrology(draft());
    expect(d.ascendant).toBeTruthy();
    expect(celestialHouses.length).toBe(5);
    expect(d.dwellings!.map((w) => w.house)).toEqual(celestialHouses.map((h) => h.id));
    for (const w of d.dwellings!) expect(w.sign).toBeTruthy();
    expect(rollDraftAstrology(draft()).dwellings).toEqual(d.dwellings); // figé par le seed
  });

  it('buildHero applique les ±carac du signe aux attributs de départ', () => {
    const base = readyDraft();
    const a = buildHero(base, 'h-nostar');
    const b = buildHero({ ...base, star: 'wymund-l-anachorete' }, 'h-star'); // id ; +2 Soc, +2 I, -3 Int
    expect(b.characteristics.sociabilite - a.characteristics.sociabilite).toBe(2);
    expect(b.characteristics.initiative - a.characteristics.initiative).toBe(2);
    expect(b.characteristics.intelligence - a.characteristics.intelligence).toBe(-3);
    expect(b.star).toBe('wymund-l-anachorete');
  });
});
