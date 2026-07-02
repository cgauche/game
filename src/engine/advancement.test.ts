import { describe, it, expect } from 'vitest';
import { Combatant, CharKey } from './types';
import {
  advanceCost,
  talentCost,
  buyCharAdvance,
  buySkillAdvance,
  buyTalent,
  careerCompletionAdvances,
  isCareerLevelComplete,
  careerChangeCost,
  changeCareer,
  validateCareerChange,
  inCareerChar,
  mentorBlocks,
} from './advancement';
import { skillSlots, talentSlots, parseAdvancement } from './careerSlots';
import { CareerLevelData } from '../data';

/** Fixtures : libellés d'avancement → `AdvancementRef[]`. */
const A = (xs: string[]) => xs.map(parseAdvancement);

const hero = (xp: number): Combatant =>
  ({
    id: 'h',
    name: 'H',
    kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ skillId: 'discretion', characteristic: 'Ag', advances: 0 }],
    talents: [],
    movement: 4,
    xp,
    charAdvances: {},
  }) as unknown as Combatant;

describe('advanceCost — Tableau de Coût (LDB 07-Carrières l.45-62), verbatim', () => {
  it('Caractéristique : coûts par bande (déjà-achetées → coût de la prochaine)', () => {
    expect(advanceCost(0, 'characteristic')).toBe(25); // bande 0 à 5
    expect(advanceCost(5, 'characteristic')).toBe(25);
    expect(advanceCost(6, 'characteristic')).toBe(30); // bande 6 à 10
    expect(advanceCost(10, 'characteristic')).toBe(30);
    expect(advanceCost(11, 'characteristic')).toBe(40);
    expect(advanceCost(25, 'characteristic')).toBe(70);
    expect(advanceCost(70, 'characteristic')).toBe(450);
    expect(advanceCost(71, 'characteristic')).toBe(520); // 71 et +
    expect(advanceCost(999, 'characteristic')).toBe(520);
  });
  it('Compétence : coûts par bande', () => {
    expect(advanceCost(0, 'skill')).toBe(10);
    expect(advanceCost(5, 'skill')).toBe(10);
    expect(advanceCost(6, 'skill')).toBe(15);
    expect(advanceCost(11, 'skill')).toBe(20);
    expect(advanceCost(25, 'skill')).toBe(40);
    expect(advanceCost(71, 'skill')).toBe(440);
  });
  it('hors carrière : coût DOUBLE (l.95)', () => {
    expect(advanceCost(0, 'characteristic', false)).toBe(50);
    expect(advanceCost(0, 'skill', false)).toBe(20);
    expect(advanceCost(11, 'characteristic', false)).toBe(80);
  });
});

describe('Détection in-carrière (LDB 07-Carrières l.95 : hors-carrière → coût ×2)', () => {
  it('inCareerChar : vrai si la clé de la Caractéristique est listée au Niveau', () => {
    const chars: CharKey[] = ['CT', 'Int', 'Soc']; // Niveau « Pamphlétaire »
    expect(inCareerChar(chars, 'CT')).toBe(true);
    expect(inCareerChar(chars, 'Int')).toBe(true);
    expect(inCareerChar(chars, 'CC')).toBe(false);
    expect(inCareerChar(chars, 'F')).toBe(false);
  });
});

describe('talentCost — 100 + 100 × déjà achetées (l.102)', () => {
  it('1ʳᵉ = 100, 2ᵉ = 200, 3ᵉ = 300', () => {
    expect(talentCost(0)).toBe(100);
    expect(talentCost(1)).toBe(200);
    expect(talentCost(2)).toBe(300);
  });
});

describe('Achat un par un (mutation du héros, PX déduits)', () => {
  it('buyCharAdvance : +1 valeur, +1 compteur, PX déduits ; coût escalade à l’achat suivant', () => {
    const h = hero(1000);
    const r1 = buyCharAdvance(h, 'CC');
    expect(r1).toEqual({ ok: true, cost: 25 });
    expect(h.characteristics.CC).toBe(31);
    expect(h.charAdvances!.CC).toBe(1);
    expect(h.xp).toBe(975);
    // on enchaîne jusqu'à 6 Augmentations : les 6 premières (compteur 0..5) coûtent 25 chacune
    for (let i = 0; i < 5; i++) buyCharAdvance(h, 'CC');
    expect(h.charAdvances!.CC).toBe(6);
    expect(h.characteristics.CC).toBe(36);
    expect(h.xp).toBe(1000 - 6 * 25); // 850
    // la 7ᵉ (compteur 6) coûte 30
    const r7 = buyCharAdvance(h, 'CC');
    expect(r7.cost).toBe(30);
    expect(h.xp).toBe(850 - 30);
  });
  it('buyCharAdvance : PX insuffisants → refus, rien n’est appliqué', () => {
    const h = hero(10);
    const r = buyCharAdvance(h, 'F');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('PX insuffisants');
    expect(h.characteristics.F).toBe(30); // inchangé
    expect(h.xp).toBe(10);
  });
  it('buySkillAdvance : +1 avance, coût selon avances déjà prises ; identité (name, spec)', () => {
    const h = hero(1000);
    const r = buySkillAdvance(h, 'Discrétion', undefined); // 0 avance → 10 PX
    expect(r).toEqual({ ok: true, cost: 10 });
    expect(h.skills.find((s) => s.skillId === 'discretion')!.advances).toBe(1);
    expect(h.xp).toBe(990);
    expect(buySkillAdvance(h, 'Inconnue', undefined).ok).toBe(false); // compétence non connue
    // Une AUTRE spec du même groupe est une Compétence distincte (LDB 09 l.42).
    h.skills.push({ skillId: 'discretion', spec: 'Urbaine', characteristic: 'Ag', advances: 0 });
    expect(buySkillAdvance(h, 'Discrétion', 'Rurale').ok).toBe(false); // (Rurale) non connue
    expect(buySkillAdvance(h, 'Discrétion', 'Urbaine')).toEqual({ ok: true, cost: 10 });
    expect(h.skills.find((s) => s.spec === 'Urbaine')!.advances).toBe(1);
    expect(h.skills.find((s) => !s.spec && s.skillId === 'discretion')!.advances).toBe(1); // inchangée
  });
  it('buySkillAdvance : remise −5 PX (talent Maître artisan…, LDB 10) in-carrière seulement', () => {
    const h = hero(1000);
    expect(buySkillAdvance(h, 'Discrétion', undefined, true, 5)).toEqual({ ok: true, cost: 5 });
    expect(buySkillAdvance(h, 'Discrétion', undefined, false, 5).cost).toBe(20); // ×2, pas de remise
  });
  it('buyTalent : crée à times 1 (100 PX), puis +1 (200 PX)', () => {
    const h = hero(1000);
    expect(buyTalent(h, 'Sang-froid')).toEqual({ ok: true, cost: 100 });
    expect(h.talents.find((t) => t.talentId === 'sang-froid')!.times).toBe(1);
    expect(buyTalent(h, 'Sang-froid')).toEqual({ ok: true, cost: 200 });
    expect(h.talents.find((t) => t.talentId === 'sang-froid')!.times).toBe(2);
    expect(h.xp).toBe(1000 - 100 - 200);
  });
});

describe('Compléter / Changer de Carrière (LDB 07-Carrières l.108-137, LDB 08 l.7-11)', () => {
  // Carrière factice à 2 niveaux : 9 compétences au Niveau 1 (dont un joker), 2 talents.
  const LEVELS: CareerLevelData[] = [
    {
      label: 'Niv1',
      career: 'Test',
      level: 1,
      skills: A(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9']),
      talents: A(['T1', 'T2']),
      trappings: [],
      characteristics: ['CC', 'F', 'E'],
      status: 'Bronze 1',
    },
    {
      label: 'Niv2',
      career: 'Test',
      level: 2,
      skills: A(['S10', 'S11']),
      talents: A(['T3']),
      trappings: [],
      characteristics: ['Ag'],
      status: 'Bronze 2',
    },
  ];
  const completionOpts = (level: number) => ({
    skillSlots: skillSlots(LEVELS, level),
    talentSlots: talentSlots(LEVELS, level),
    careerChars: LEVELS.filter((l) => l.level <= level).flatMap((l) => l.characteristics),
    designations: {},
  });

  // Héros qui COMPLÈTE le Niveau 1 : les 3 caracs DE CARRIÈRE à 5 Augmentations (et pas les
  // 7 autres — l.125 : « toutes les Caractéristiques… disponibles à votre Niveau »),
  // 8 compétences du Niveau à 5, 1 talent du Niveau.
  const completedHero = (xp: number): Combatant =>
    ({
      ...hero(xp),
      career: 'Test',
      charAdvances: { CC: 5, F: 5, E: 5 },
      skills: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map((skillId) => ({ skillId, characteristic: 'Ag', advances: 5 })),
      talents: [{ talentId: 't1', times: 1 }],
      careerLevel: 1,
    }) as unknown as Combatant;

  it('careerCompletionAdvances = 5 × Niveau (l.127-132)', () => {
    expect(careerCompletionAdvances(1)).toBe(5);
    expect(careerCompletionAdvances(2)).toBe(10);
    expect(careerCompletionAdvances(4)).toBe(20);
  });
  it('isCareerLevelComplete : vrai avec les 3 caracs DE CARRIÈRE + 8 compétences + 1 talent', () => {
    expect(isCareerLevelComplete(completedHero(0), 1, completionOpts(1))).toBe(true);
  });
  it('isCareerLevelComplete : faux si une caractéristique DE CARRIÈRE sous le seuil', () => {
    const h = completedHero(0);
    h.charAdvances!.E = 4;
    expect(isCareerLevelComplete(h, 1, completionOpts(1))).toBe(false);
  });
  it('isCareerLevelComplete : les caracs HORS carrière ne comptent pas', () => {
    const h = completedHero(0);
    h.charAdvances = { ...h.charAdvances, Soc: 0 }; // Soc hors carrière à 0 → sans effet
    expect(isCareerLevelComplete(h, 1, completionOpts(1))).toBe(true);
  });
  it('isCareerLevelComplete : faux si moins de 8 compétences au seuil', () => {
    const h = completedHero(0);
    h.skills = h.skills.slice(0, 7);
    expect(isCareerLevelComplete(h, 1, completionOpts(1))).toBe(false);
  });
  it('isCareerLevelComplete : faux sans aucun talent du Niveau', () => {
    const h = completedHero(0);
    h.talents = [];
    expect(isCareerLevelComplete(h, 1, completionOpts(1))).toBe(false);
  });
  it('niveau 2 : seuil 10, compétences CUMULATIVES (l.78) mais talent du niveau COURANT (l.100)', () => {
    const h = completedHero(0);
    h.careerLevel = 2;
    h.charAdvances = { CC: 10, F: 10, E: 10, Ag: 10 };
    h.skills = h.skills.map((s) => ({ ...s, advances: 10 })); // 8 compétences du Niveau 1 à 10
    expect(isCareerLevelComplete(h, 2, completionOpts(2))).toBe(false); // T1 n'est PAS du niveau 2
    h.talents = [{ talentId: 't3', times: 1 }];
    expect(isCareerLevelComplete(h, 2, completionOpts(2))).toBe(true);
  });
  it('careerChangeCost : 100 si complété, 200 sinon (l.120)', () => {
    expect(careerChangeCost(true)).toBe(100);
    expect(careerChangeCost(false)).toBe(200);
  });
  it('validateCareerChange : niveau suivant EXIGE la complétion (l.137) ; pas de saut', () => {
    const h = completedHero(500);
    expect(validateCareerChange(h, 'Test', 2, { completed: true, sameClass: true, targetLevelExists: true }).ok).toBe(true);
    expect(validateCareerChange(h, 'Test', 2, { completed: false, sameClass: true, targetLevelExists: true })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('non complété'),
    });
    expect(validateCareerChange(h, 'Test', 3, { completed: true, sameClass: true, targetLevelExists: true }).ok).toBe(false); // saut
  });
  it('validateCareerChange : autre carrière → niveau 1 imposé (LDB 08 l.9), +100 hors Classe', () => {
    const h = completedHero(500);
    expect(validateCareerChange(h, 'Érudit', 2, { completed: true, sameClass: true, targetLevelExists: true }).ok).toBe(false);
    expect(validateCareerChange(h, 'Érudit', 1, { completed: true, sameClass: true, targetLevelExists: true }).cost).toBe(100);
    expect(validateCareerChange(h, 'Érudit', 1, { completed: true, sameClass: false, targetLevelExists: true }).cost).toBe(200);
    expect(validateCareerChange(h, 'Érudit', 1, { completed: false, sameClass: false, targetLevelExists: true }).cost).toBe(300);
  });
  it('validateCareerChange : redescendre à un niveau inférieur de la même carrière', () => {
    const h = completedHero(500);
    h.careerLevel = 2;
    expect(validateCareerChange(h, 'Test', 1, { completed: false, sameClass: true, targetLevelExists: true })).toMatchObject({ ok: true, cost: 200 });
  });
  it('changeCareer : déduit le coût et met à jour carrière + niveau ; refus si PX insuffisants', () => {
    const h = completedHero(150);
    const r = changeCareer(h, 'Érudit', 1, { completed: true, sameClass: true, targetLevelExists: true });
    expect(r).toEqual({ ok: true, cost: 100 });
    expect(h.career).toBe('Érudit');
    expect(h.careerLevel).toBe(1);
    expect(h.xp).toBe(50);
    const poor = hero(50);
    poor.career = 'Test';
    const refused = changeCareer(poor, 'Soldat', 1, { completed: false, sameClass: true, targetLevelExists: true }); // 200 PX requis
    expect(refused.ok).toBe(false);
    expect(refused.reason).toBe('PX insuffisants');
  });

  it('gmJump : SAUT de Niveau supérieur non-adjacent — refusé sans accord MJ, permis avec (l.140)', () => {
    const h = completedHero(500); // Test niv.1 complété
    expect(validateCareerChange(h, 'Test', 3, { completed: true, sameClass: true, targetLevelExists: true })).toMatchObject({ ok: false });
    expect(validateCareerChange(h, 'Test', 3, { completed: true, sameClass: true, targetLevelExists: true, gmJump: true })).toMatchObject({ ok: true, cost: 100 });
  });
  it('gmJump : MÊME Niveau d’une autre Carrière de la Classe — exige complétion + même Classe (l.148)', () => {
    const h = completedHero(500); // niv.1
    // Sans accord MJ : autre carrière → niveau 1 seulement (le niveau courant ≠ 1 refusé)
    h.careerLevel = 2;
    expect(validateCareerChange(h, 'Érudit', 2, { completed: true, sameClass: true, targetLevelExists: true })).toMatchObject({ ok: false });
    // Avec accord MJ + complété + même Classe : accès au MÊME niveau (2) pour 100 PX
    expect(validateCareerChange(h, 'Érudit', 2, { completed: true, sameClass: true, targetLevelExists: true, gmJump: true })).toMatchObject({ ok: true, cost: 100 });
    // Classe différente : refusé même avec accord MJ (le même-niveau exige la MÊME Classe)
    expect(validateCareerChange(h, 'Érudit', 2, { completed: true, sameClass: false, targetLevelExists: true, gmJump: true })).toMatchObject({ ok: false });
    // Non complété : refusé
    expect(validateCareerChange(h, 'Érudit', 2, { completed: false, sameClass: true, targetLevelExists: true, gmJump: true })).toMatchObject({ ok: false });
  });
});

describe('mentorBlocks — Augmentation hors carrière + mentor (LDB 07 l.89)', () => {
  it('bloque une Augmentation hors carrière quand la règle est active et sans mentor', () => {
    expect(mentorBlocks(false, true, false)).toBe(true); // hors carrière, règle ON, pas de mentor
    expect(mentorBlocks(false, true, true)).toBe(false); // mentor présent
    expect(mentorBlocks(false, false, false)).toBe(false); // règle OFF
    expect(mentorBlocks(true, true, false)).toBe(false); // in-carrière : jamais bloqué
  });
});
