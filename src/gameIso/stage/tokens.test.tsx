/**
 * Couche DÉCOR en SVG — ce qu'il en reste après la mort de la voie de jeu affine (#1176 P3-4, commit
 * C5a) : l'aperçu WYSIWYG de l'éditeur. Les corps de JEU (combattants, figurants, jeton de groupe)
 * sont posés par le monde volumique ; leur `data-cid` de recette est un ANGLE MORT connu de cette voie
 * (aucun nœud DOM par jeton, cf. `stage/GameStage3D.test.tsx`).
 */
import { describe, it, expect } from 'vitest';
import { propLayerObjs } from './tokens';
import type { TokenCtx } from './tokens';
import type { PropEl } from '../builders/types';

const ctx: TokenCtx = { dims: { w: 5, h: 5 }, view: 'iso', liftAt: () => 0 };

describe('propLayerObjs — ancre logique', () => {
  it('porte les coordonnées entières de la cellule sur le StageObj', () => {
    const propEl: PropEl = {
      kind: 'prop',
      source: 'terrain',
      key: 'prop:2,3,1',
      cell: { x: 2, y: 3, z: 1 },
      states: { visible: true },
      ref: 'tonneau',
      foot: { offX: 0.5, offY: 0.5, scale: 1 },
      interact: false,
    };

    expect(propLayerObjs([propEl], ctx)[0]).toMatchObject({ x: 2, y: 3, z: 1, kind: 'prop' });
  });
});
