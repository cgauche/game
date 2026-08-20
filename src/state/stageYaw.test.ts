/**
 * LACET LIBRE (#1176) — la loi du module de lacet, mesurée SANS écran : un appui bref pousse d'un PAS
 * FIN, un maintien fait tourner la caméra tant qu'il dure, et le relâchement laisse l'angle EXACTEMENT
 * où il est. Aucun angle n'est privilégié : il n'y a plus de cran qui rattrape la vue.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PAS_TAP_DEG,
  VITESSE_LACET_DEG_S,
  arreterLacet,
  avancerLacet,
  demarrerLacet,
  getStageYaw,
  pasYaw,
  poserYaw,
  resetStageYaw,
} from './stageYaw';

/** Joue le BATTEMENT à la main (#1403) : le lacet n'a plus d'horloge à lui — il est AVANCÉ par l'image
 *  (`avancerLacet`), et le test décide de la cadence, donc de combien la caméra a tourné. Le
 *  `requestAnimationFrame` stubé ne dit qu'une chose au module : une horloge d'images EXISTE (sans
 *  elle, le maintien ne peut pas s'intégrer et la poussée fine arrive tout de suite). */
function harnaisDeFrames() {
  vi.stubGlobal('requestAnimationFrame', (() => 0) as unknown as typeof requestAnimationFrame);
  let horloge = 0;
  return {
    /** Joue `n` images de `dt` ms. Rend le temps écoulé. */
    jouer(n: number, dt = 16): number {
      for (let i = 0; i < n; i++) {
        horloge += dt;
        avancerLacet(horloge);
      }
      return n * dt;
    },
  };
}

beforeEach(() => {
  resetStageYaw();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetStageYaw();
});

describe('PAS FIN — un appui bref pousse de deux degrés, et de rien d’autre', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', undefined); // hors navigateur : la poussée arrive tout de suite
  });

  it('UN pas vaut exactement PAS_TAP_DEG', () => {
    expect(PAS_TAP_DEG).toBe(2);
    pasYaw(1);
    expect(getStageYaw()).toBe(2);
    resetStageYaw();
    pasYaw(-1);
    expect(getStageYaw()).toBe(-2);
  });

  it('N pas valent N × PAS_TAP_DEG — aucun aimant ne rattrape l’angle', () => {
    for (let i = 0; i < 7; i++) pasYaw(1);
    expect(getStageYaw()).toBe(14);
    expect(getStageYaw() % 90).not.toBe(0); // l'angle de repos n'est pas un cran, et n'a pas à l'être
    for (let i = 0; i < 3; i++) pasYaw(-1);
    expect(getStageYaw()).toBe(8);
  });

  it('un pas depuis un angle QUELCONQUE ajoute deux degrés à CET angle', () => {
    poserYaw(37.4);
    pasYaw(1);
    expect(getStageYaw()).toBeCloseTo(39.4, 9);
  });
});

describe('MAINTIEN — la caméra tourne tant que le geste dure, sans plafond', () => {
  it('trois secondes de maintien dépassent largement le plafond de la poussée fine', () => {
    const h = harnaisDeFrames();
    demarrerLacet(1);
    const ms = h.jouer(Math.round(3000 / 16));
    expect(getStageYaw()).toBeCloseTo((VITESSE_LACET_DEG_S * ms) / 1000, 6);
    expect(getStageYaw()).toBeGreaterThan(90); // le retard maximal de la poussée fine ne mord pas
    expect(getStageYaw()).toBeGreaterThan(180); // ni aucun plafond exprimé en quarts de tour
  });

  it('un maintien assez long passe DEUX TOURS entiers', () => {
    const h = harnaisDeFrames();
    demarrerLacet(1);
    h.jouer(Math.round(8000 / 16));
    expect(getStageYaw()).toBeGreaterThan(720);
  });

  it('le sens est celui du geste', () => {
    const h = harnaisDeFrames();
    demarrerLacet(-1);
    h.jouer(60);
    expect(getStageYaw()).toBeLessThan(-50);
  });

  it('RELÂCHER laisse l’angle TEL QUEL — rien ne le ramène à un cran', () => {
    const h = harnaisDeFrames();
    demarrerLacet(1);
    h.jouer(100);
    const relache = getStageYaw();
    expect(relache % 90).not.toBe(0); // on relâche bien entre deux crans
    arreterLacet();
    expect(getStageYaw()).toBe(relache);
    h.jouer(120); // les images ont tout le temps de ramener la vue quelque part : elles ne le font pas
    expect(getStageYaw()).toBe(relache);
  });
});

describe('GLISSER et REMISE À ZÉRO', () => {
  it('poserYaw écrit l’angle DIRECTEMENT, sans animation', () => {
    const h = harnaisDeFrames();
    poserYaw(123.5);
    expect(getStageYaw()).toBe(123.5);
    h.jouer(30);
    expect(getStageYaw()).toBe(123.5);
  });

  it('resetStageYaw rend l’angle initial (0) et arrête tout', () => {
    const h = harnaisDeFrames();
    demarrerLacet(1);
    h.jouer(40);
    resetStageYaw();
    expect(getStageYaw()).toBe(0);
    h.jouer(40);
    expect(getStageYaw()).toBe(0);
  });
});
