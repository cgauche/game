import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, type Scene, type SceneEntity } from './scene';
import type { Flow } from './flow';
import { exploreMoveDest } from './exploreNav';

const emptyFlow: Flow = { kind: 'seq', steps: [] };
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function sceneWith(entities: SceneEntity[]): Scene {
  const sc = emptyScene(10, 10); // grille entièrement 'herbe' (marchable)
  sc.entities = entities;
  return sc;
}

describe('exploreMoveDest — case d’arrivée partagée survol/clic (exploration)', () => {
  it('case libre : renvoie la case elle-même', () => {
    expect(exploreMoveDest(sceneWith([]), { x: 1, y: 1 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });

  it('objet interactif (case bloquée) : vise une case adjacente marchable, pas la case de l’objet', () => {
    // RÉGRESSION : « au survol d’un objet avec interaction, le chemin ne s’affiche pas ». La case de
    // l’objet est non marchable (entityBlockedAt), donc l’aperçu doit viser la case adjacente — celle
    // où le clic emmène le groupe avant la fouille — au lieu de ne rien afficher.
    const prop: SceneEntity = { id: 'coffre', kind: 'prop', pos: { x: 5, y: 5 }, interact: { flow: emptyFlow } };
    const sc = sceneWith([prop]);
    expect(isWalkable(sc, 5, 5)).toBe(false); // précondition : la case de l’objet est bloquée
    const dest = exploreMoveDest(sc, { x: 1, y: 1 }, { x: 5, y: 5 });
    expect(dest).not.toBeNull();
    expect(dest).not.toEqual({ x: 5, y: 5 });
    expect(cheb(dest!, { x: 5, y: 5 })).toBe(1);
    expect(isWalkable(sc, dest!.x, dest!.y, dest!.z ?? 0)).toBe(true);
  });

  it('objet interactif, groupe déjà adjacent : aucune marche (fouille sur place)', () => {
    const prop: SceneEntity = { id: 'coffre', kind: 'prop', pos: { x: 5, y: 5 }, interact: { flow: emptyFlow } };
    expect(exploreMoveDest(sceneWith([prop]), { x: 5, y: 6 }, { x: 5, y: 5 })).toBeNull();
  });

  it('PNJ à dialogue (case marchable) : on s’arrête à une case adjacente, pas sur le PNJ', () => {
    const npc: SceneEntity = { id: 'garde', kind: 'personnage', pos: { x: 5, y: 5 }, dialogueId: 'd1' };
    const sc = sceneWith([npc]);
    expect(isWalkable(sc, 5, 5)).toBe(true); // un personnage ne bloque pas sa case…
    const dest = exploreMoveDest(sc, { x: 1, y: 1 }, { x: 5, y: 5 });
    expect(dest).not.toEqual({ x: 5, y: 5 }); // …mais on ne marche pas dessus (cohérent avec le clic)
    expect(cheb(dest!, { x: 5, y: 5 })).toBe(1);
  });

  it('figurant (sans dialogue) à distance : on s’approche d’une case adjacente', () => {
    const fig: SceneEntity = { id: 'badaud', kind: 'personnage', pos: { x: 5, y: 5 } };
    const dest = exploreMoveDest(sceneWith([fig]), { x: 1, y: 1 }, { x: 5, y: 5 });
    expect(cheb(dest!, { x: 5, y: 5 })).toBe(1);
  });

  it('figurant déjà adjacent : aucune marche', () => {
    const fig: SceneEntity = { id: 'badaud', kind: 'personnage', pos: { x: 5, y: 5 } };
    expect(exploreMoveDest(sceneWith([fig]), { x: 4, y: 5 }, { x: 5, y: 5 })).toBeNull();
  });

  it('escalier : viser une marche envoie à l’autre bout', () => {
    const sc = emptyScene(10, 10);
    sc.levels.push({ z: 1, tiles: new Array(100).fill('plancher') });
    sc.stairs = [{ from: { x: 2, y: 2, z: 0 }, to: { x: 3, y: 2, z: 1 } }];
    expect(exploreMoveDest(sc, { x: 1, y: 1 }, { x: 2, y: 2, z: 0 })).toEqual({ x: 3, y: 2, z: 1 });
    expect(exploreMoveDest(sc, { x: 4, y: 4, z: 1 }, { x: 3, y: 2, z: 1 })).toEqual({ x: 2, y: 2, z: 0 });
  });
});
