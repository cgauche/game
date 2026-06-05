import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
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
  inCareerChar,
  inCareerSkill,
  inCareerTalent,
} from './advancement';

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
    skills: [{ name: 'Discrétion', characteristic: 'Ag', advances: 0 }],
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
  it('inCareerChar : vrai si le libellé long de la Caractéristique est listé au Niveau', () => {
    const chars = ['Capacité de Tir', 'Intelligence', 'Sociabilité']; // Niveau « Pamphlétaire »
    expect(inCareerChar(chars, 'CT')).toBe(true);
    expect(inCareerChar(chars, 'Int')).toBe(true);
    expect(inCareerChar(chars, 'CC')).toBe(false);
    expect(inCareerChar(chars, 'F')).toBe(false);
  });
  it('inCareerSkill : appartenance par nom exact', () => {
    expect(inCareerSkill(['Charme', 'Ragot', 'Subornation'], 'Charme')).toBe(true);
    expect(inCareerSkill(['Charme', 'Ragot', 'Subornation'], 'Esquive')).toBe(false);
  });
  it('inCareerTalent : appartenance par nom exact', () => {
    expect(inCareerTalent(['Baratiner', 'Sociable'], 'Sociable')).toBe(true);
    expect(inCareerTalent(['Baratiner', 'Sociable'], 'Orateur')).toBe(false);
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
  it('buySkillAdvance : +1 avance, coût selon avances déjà prises', () => {
    const h = hero(1000);
    const r = buySkillAdvance(h, 'Discrétion'); // 0 avance → 10 PX
    expect(r).toEqual({ ok: true, cost: 10 });
    expect(h.skills.find((s) => s.name === 'Discrétion')!.advances).toBe(1);
    expect(h.xp).toBe(990);
    expect(buySkillAdvance(h, 'Inconnue').ok).toBe(false); // compétence non connue
  });
  it('buyTalent : crée à times 1 (100 PX), puis +1 (200 PX)', () => {
    const h = hero(1000);
    expect(buyTalent(h, 'Sang-froid')).toEqual({ ok: true, cost: 100 });
    expect(h.talents.find((t) => t.name === 'Sang-froid')!.times).toBe(1);
    expect(buyTalent(h, 'Sang-froid')).toEqual({ ok: true, cost: 200 });
    expect(h.talents.find((t) => t.name === 'Sang-froid')!.times).toBe(2);
    expect(h.xp).toBe(1000 - 100 - 200);
  });
});

describe('Changer de Carrière (LDB 07-Carrières l.108-137)', () => {
  const CAREER_SKILLS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'];
  const CAREER_TALENTS = ['T1', 'T2'];

  // Héros qui COMPLÈTE le Niveau 1 : 10 caracs à 5 Augmentations, 8 compétences à 5, 1 talent du Niveau.
  const completedHero = (xp: number): Combatant =>
    ({
      ...hero(xp),
      charAdvances: { CC: 5, CT: 5, F: 5, E: 5, I: 5, Ag: 5, Dex: 5, Int: 5, FM: 5, Soc: 5 },
      skills: CAREER_SKILLS.slice(0, 8).map((name) => ({ name, characteristic: 'Ag', advances: 5 })),
      talents: [{ name: 'T1', times: 1 }],
      careerLevel: 1,
    }) as unknown as Combatant;

  it('careerCompletionAdvances = 5 × Niveau (l.127-132)', () => {
    expect(careerCompletionAdvances(1)).toBe(5);
    expect(careerCompletionAdvances(2)).toBe(10);
    expect(careerCompletionAdvances(4)).toBe(20);
  });
  it('isCareerLevelComplete : vrai si 10 caracs + 8 compétences + 1 talent au seuil', () => {
    const h = completedHero(0);
    expect(isCareerLevelComplete(h, 1, CAREER_SKILLS, CAREER_TALENTS)).toBe(true);
  });
  it('isCareerLevelComplete : faux si une caractéristique sous le seuil', () => {
    const h = completedHero(0);
    h.charAdvances!.Soc = 4; // une carac à 4 < 5
    expect(isCareerLevelComplete(h, 1, CAREER_SKILLS, CAREER_TALENTS)).toBe(false);
  });
  it('isCareerLevelComplete : faux si moins de 8 compétences au seuil', () => {
    const h = completedHero(0);
    h.skills = CAREER_SKILLS.slice(0, 7).map((name) => ({ name, characteristic: 'Ag', advances: 5 })) as never;
    expect(isCareerLevelComplete(h, 1, CAREER_SKILLS, CAREER_TALENTS)).toBe(false);
  });
  it('isCareerLevelComplete : faux sans aucun talent du Niveau', () => {
    const h = completedHero(0);
    h.talents = [];
    expect(isCareerLevelComplete(h, 1, CAREER_SKILLS, CAREER_TALENTS)).toBe(false);
  });
  it('careerChangeCost : 100 si complété, 200 sinon (l.120)', () => {
    expect(careerChangeCost(true)).toBe(100);
    expect(careerChangeCost(false)).toBe(200);
  });
  it('changeCareer : déduit le coût et met à jour carrière + niveau ; refus si PX insuffisants', () => {
    const h = completedHero(150);
    const r = changeCareer(h, 'Érudit', 1, true);
    expect(r).toEqual({ ok: true, cost: 100 });
    expect(h.career).toBe('Érudit');
    expect(h.careerLevel).toBe(1);
    expect(h.xp).toBe(50);
    const poor = changeCareer(hero(50), 'Soldat', 2, false); // 200 PX requis, 50 dispo
    expect(poor.ok).toBe(false);
    expect(poor.reason).toBe('PX insuffisants');
  });
});
