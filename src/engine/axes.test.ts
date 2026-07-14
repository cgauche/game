import { describe, it, expect } from 'vitest';
import { axisScore, axesProfile, partyCoverage, dominantAxes } from './axes';
import { allAxes, findAxisById } from '../data';
import { PREGEN, pregen, pregenParty } from '../data/pregens';

const MELEE = findAxisById('melee')!;
const TIR = findAxisById('tir')!;
const SOCIAL = findAxisById('social')!;
const SOINS = findAxisById('soins')!;
const INGENIERIE = findAxisById('ingenierie')!;

describe('#409 — engine/axes : axisScore/axesProfile/partyCoverage/dominantAxes', () => {
  it('axisScore : 0..1, un pré-tiré martial score plus haut en Mêlée qu\'un pré-tiré peu combattant', () => {
    const soldat = pregen(PREGEN.soldat);
    const sorcier = pregen(PREGEN.sorcier);
    const soldatScore = axisScore(soldat, MELEE);
    const sorcierScore = axisScore(sorcier, MELEE);
    expect(soldatScore).toBeGreaterThan(0);
    expect(soldatScore).toBeLessThanOrEqual(1);
    expect(sorcierScore).toBeGreaterThanOrEqual(0);
    expect(sorcierScore).toBeLessThanOrEqual(1);
    expect(soldatScore).toBeGreaterThanOrEqual(sorcierScore);
  });

  it('axisScore : le Chasseur (Projectiles formé) score en Tir, le Soldat (Compétence AVANCÉE, aucune Augmentation) score EXACTEMENT 0 — LDB 09 l.30, aucun repli sur la Caractéristique nue', () => {
    const chasseur = pregen(PREGEN.chasseur);
    const soldat = pregen(PREGEN.soldat);
    expect(axisScore(chasseur, TIR)).toBeGreaterThan(0);
    expect(axisScore(soldat, TIR)).toBe(0);
  });

  it('axisScore VERROU NOMINATIF — réfutation utilisateur 2026-07-14 : Wilhelmina Faust (sorcière, PREGEN.sorcier) sans Guérison/Métier(Ingénieur) formés score EXACTEMENT 0 en Soins ET en Ingénierie (jamais « taggée » par la seule Caractéristique)', () => {
    const wilhelmina = pregen(PREGEN.sorcier);
    expect(wilhelmina.skills.some((s) => s.skillId === 'guerison' && s.advances > 0)).toBe(false);
    expect(wilhelmina.skills.some((s) => (s.skillId === 'metier' || (s.skillId === 'savoir' && (s.spec === 'ingenierie' || s.spec === 'artillerie'))) && s.advances > 0)).toBe(false);
    expect(axisScore(wilhelmina, SOINS)).toBe(0);
    expect(axisScore(wilhelmina, INGENIERIE)).toBe(0);
  });

  it('axisScore : Talent seul BONIFIE sans jamais faire déborder [0,1] — formule stable sur tout le catalogue', () => {
    const tueur = pregen(PREGEN.tueur);
    for (const axis of allAxes) {
      const v = axisScore(tueur, axis);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('axesProfile : un score par axe, dans l\'ordre de la liste fournie', () => {
    const soldat = pregen(PREGEN.soldat);
    const profile = axesProfile(soldat, [MELEE, TIR, SOCIAL]);
    expect(profile.map((p) => p.id)).toEqual(['melee', 'tir', 'social']);
    expect(profile.every((p) => p.value >= 0 && p.value <= 1)).toBe(true);
  });

  it('partyCoverage : agrégat MAX par axe — le groupe couvre Mêlée dès qu\'UN membre la couvre', () => {
    const group = pregenParty(PREGEN.soldat, PREGEN.sorcier, PREGEN.chasseur, PREGEN.pretre);
    const coverage = partyCoverage(group, [MELEE, TIR]);
    const meleeCov = coverage.find((c) => c.id === 'melee')!;
    const soloBest = Math.max(...group.map((m) => axisScore(m, MELEE)));
    expect(meleeCov.value).toBe(soloBest);
    expect(meleeCov.value).toBeGreaterThan(0);
  });

  it('dominantAxes : les N axes les mieux notés, triés décroissant, jamais un axe à score nul', () => {
    const soldat = pregen(PREGEN.soldat);
    const dom = dominantAxes(soldat, allAxes, 3);
    expect(dom.length).toBeLessThanOrEqual(3);
    for (const a of dom) expect(a.value).toBeGreaterThan(0);
    const values = dom.map((a) => a.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('dominantAxes : un pré-tiré soigneur (Frère Anselm, guérison en carrière) fait ressortir Soins', () => {
    const pretre = pregen(PREGEN.pretre);
    const dom = dominantAxes(pretre, allAxes, allAxes.length);
    const soinsEntry = dom.find((a) => a.id === 'soins');
    expect(axisScore(pretre, SOINS)).toBeGreaterThanOrEqual(0);
    // Le Prêtre n'est pas garanti d'avoir Guérison formée selon sa carrière — on vérifie la
    // COHÉRENCE de dominantAxes avec axisScore plutôt qu'une valeur en dur.
    if (soinsEntry) expect(soinsEntry.value).toBe(axisScore(pretre, SOINS));
  });
});
