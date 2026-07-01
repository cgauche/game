import { describe, it, expect } from 'vitest';
import { sceneCombatModifiers, entityBlockedAt } from './sceneRules';
import { Scene, SceneEntity, isWalkable } from './scene';

const sc = (over: Partial<Scene>): Scene => ({ ambiance: 'exterieur', ...over } as Scene);
const DAY = 12 * 60;   // midi (clair)
const NIGHT = 23 * 60; // nuit (obscurité)

describe('sceneCombatModifiers — obscurité (horloge) / météo (LDB 14 l.94-116/107, #T1c)', () => {
  it('clair de jour → aucun mod', () => {
    expect(sceneCombatModifiers(sc({ weather: 'clair' }), DAY)).toMatchObject({ concealed: false, attackMod: 0, dodgeMod: 0 });
  });
  it('pluie → aucun mod (flavor, +0 LDB l.94-98)', () => {
    expect(sceneCombatModifiers(sc({ weather: 'pluie' }), DAY)).toMatchObject({ concealed: false, attackMod: 0, dodgeMod: 0 });
  });
  it('brouillard → cible dissimulée (concealed), -20 au tir', () => {
    expect(sceneCombatModifiers(sc({ weather: 'brouillard' }), DAY)).toMatchObject({ concealed: true, attackMod: 0, dodgeMod: 0 });
  });
  it('extérieur de nuit (horloge) → concealed (obscurité, l.107)', () => {
    expect(sceneCombatModifiers(sc({ ambiance: 'exterieur' }), NIGHT).concealed).toBe(true);
  });
  it('extérieur de jour (horloge) → pas d’obscurité', () => {
    expect(sceneCombatModifiers(sc({ ambiance: 'exterieur' }), DAY).concealed).toBe(false);
  });
  it('intérieur, même de nuit → jamais obscur (éclairé)', () => {
    expect(sceneCombatModifiers(sc({ ambiance: 'interieur' }), NIGHT).concealed).toBe(false);
  });
  it('tempête → -20 attaque, esquive 0 (l.108-109)', () => {
    expect(sceneCombatModifiers(sc({ weather: 'tempete' }), DAY)).toMatchObject({ attackMod: -20, dodgeMod: 0 });
  });
  it('neige → -20 attaque ET -20 esquive (l.115-116)', () => {
    expect(sceneCombatModifiers(sc({ weather: 'neige' }), DAY)).toMatchObject({ attackMod: -20, dodgeMod: -20 });
  });
});

describe('entityBlockedAt — empreinte multi-cases des décors', () => {
  const cart: SceneEntity = { id: 'c', kind: 'prop', pos: { x: 3, y: 2 }, ref: 'charrette', foot: { w: 2, h: 1 } } as SceneEntity;
  const puddle: SceneEntity = { id: 'b', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'mare-sang' } as SceneEntity; // 1×1, type passable (au sol)
  const scene = { entities: [cart, puddle] } as unknown as Scene;
  it('bloque toutes les cases de l’empreinte (charrette 2×1)', () => {
    expect(entityBlockedAt(scene, 3, 2)).toBe(true);
    expect(entityBlockedAt(scene, 4, 2)).toBe(true);
  });
  it('ne bloque pas hors empreinte', () => {
    expect(entityBlockedAt(scene, 5, 2)).toBe(false);
    expect(entityBlockedAt(scene, 3, 3)).toBe(false);
  });
  it('décor sans foot (1×1) ne bloque pas (comportement actuel préservé)', () => {
    expect(entityBlockedAt(scene, 0, 0)).toBe(false);
  });
  it('décor INTERACTIF 1×1 (coffre fouillable) bloque sa case — on l’aborde, on ne marche pas dessus', () => {
    const chest = { id: 'k', kind: 'prop', pos: { x: 6, y: 6 }, ref: 'coffre', interact: { effects: [] } } as unknown as SceneEntity;
    const sc2 = { entities: [chest] } as unknown as Scene;
    expect(entityBlockedAt(sc2, 6, 6)).toBe(true);
    expect(entityBlockedAt(sc2, 7, 6)).toBe(false); // adjacent libre (fouille P5 / Ramasser en combat)
  });
  it('décor SOLIDE 1×1 par type (feu de camp / barrière) bloque sa case — B5', () => {
    const fire = { id: 'f', kind: 'prop', pos: { x: 2, y: 13 }, ref: 'feu-camp' } as unknown as SceneEntity;
    const fence = { id: 'g', kind: 'prop', pos: { x: 6, y: 6 }, ref: 'barriere' } as unknown as SceneEntity;
    const sc2 = { entities: [fire, fence] } as unknown as Scene;
    expect(entityBlockedAt(sc2, 2, 13)).toBe(true);  // on ne se tient pas dans le feu de camp
    expect(entityBlockedAt(sc2, 6, 6)).toBe(true);   // ni sur la barrière
    expect(entityBlockedAt(sc2, 3, 13)).toBe(false); // case adjacente libre
  });
});

describe('isWalkable — intègre l’empreinte des décors', () => {
  const cart: SceneEntity = { id: 'c', kind: 'prop', pos: { x: 1, y: 0 }, ref: 'charrette', foot: { w: 2, h: 1 } } as SceneEntity;
  const scene = { dimensions: { w: 4, h: 1 }, layers: [{ z: 0, tiles: ['herbe', 'herbe', 'herbe', 'herbe'] }], entities: [cart] } as unknown as Scene;
  it('une case d’empreinte (charrette 2×1) est non-walkable', () => {
    expect(isWalkable(scene, 1, 0)).toBe(false);
    expect(isWalkable(scene, 2, 0)).toBe(false);
  });
  it('une case libre reste walkable', () => {
    expect(isWalkable(scene, 0, 0)).toBe(true);
  });
});
