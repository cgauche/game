import { describe, it, expect } from 'vitest';
import { scenario } from './ecuries-clayonnage';
import { scenario as diligence } from './diligence';
import { lineOfSightCover } from '../../state/lineOfSight';
import { wallBetween, areteOcculteEntre, structureAt } from '../../state/scene';

/**
 * Le banc de RECETTE des écuries : il fige les faits GÉOMÉTRIQUES que la recette navigateur va lire à
 * l'écran (#1680, lot 15-B). Chaque adversaire de la rencontre sert une preuve, et chaque preuve se
 * mesure ici sur la MÊME scène que celle qui sera jouée.
 */

/** Cases où `startCombat` pose les héros : (`partyPos.x - 1`, `partyPos.y + i`) depuis le `heroStart`. */
const HEROS = [{ x: 24, y: 31 }, { x: 24, y: 32 }];
const GOBELIN_VOISIN = { x: 23, y: 29 };
const ARCHER = { x: 19, y: 32 };
const GOBELIN_DERRIERE_MUR = { x: 26, y: 31 };

const scene = scenario.scene;
const posDe = (label: string) => scene.entities.find((e) => e.label === label)!.pos!;

describe('Écuries de la Diligence — voir par-dessus le clayonnage', () => {
  it('pose le groupe dans les écuries SANS toucher la scène de campagne partagée', () => {
    expect(scene.entities.find((e) => e.kind === 'heroStart')!.pos).toEqual({ x: 25, y: 31 });
    expect(diligence.scene.entities.find((e) => e.kind === 'heroStart')!.pos).toEqual({ x: 17, y: 2 });
    expect(diligence.scene.encounters).toEqual([]);
  });

  it('poste les trois adversaires aux cases de leurs preuves', () => {
    expect(posDe('Gobelin de la stalle voisine')).toEqual(GOBELIN_VOISIN);
    expect(posDe('Archer gobelin de la stalle sud-ouest')).toEqual(ARCHER);
    expect(posDe('Gobelin derrière le mur de la remise')).toEqual(GOBELIN_DERRIERE_MUR);
  });

  it('arme le tireur du groupe d’une arme à DISTANCE (l’arc en main, pas la fronde rangée)', () => {
    const tireur = scenario.makeParty()[0];
    expect(tireur.weapons.some((w) => w.type === 'ranged')).toBe(true);
  });

  it('(c) le tir par-dessus la séparation de box PART — l’arête est du clayonnage, infranchissable et non occultante', () => {
    const arete = structureAt(scene, 23, 30, 'E', 0);
    expect(arete?.structure).toBe('cloture-en-clayonnage');
    expect(wallBetween(scene, 23, 30, 24, 30)).toBe(true); // on ne PASSE pas
    expect(areteOcculteEntre(scene, 23, 30, 24, 30)).toBe(false); // on VOIT
    for (const h of HEROS) {
      expect(lineOfSightCover(scene, h, GOBELIN_VOISIN, [])).toEqual({ blocked: false, cover: 'none' });
    }
  });

  it('(d) le tireur adverse posté derrière une AUTRE cloison de box voit le groupe (et réciproquement)', () => {
    expect(structureAt(scene, 19, 32, 'E', 0)?.structure).toBe('cloture-en-clayonnage');
    for (const h of HEROS) {
      expect(lineOfSightCover(scene, ARCHER, h, []).blocked).toBe(false);
      expect(lineOfSightCover(scene, h, ARCHER, []).blocked).toBe(false);
    }
  });

  it('contre-épreuve : à distance comparable, le mur à ossature en bois REFUSE la Ligne de Vue', () => {
    expect(structureAt(scene, 25, 31, 'E', 0)?.structure).toBe('mur-a-ossature-en-bois');
    for (const h of HEROS) {
      expect(lineOfSightCover(scene, h, GOBELIN_DERRIERE_MUR, []).blocked).toBe(true);
    }
  });
});
