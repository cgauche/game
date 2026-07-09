/**
 * #226 — les tokens d'EXPLORATION (figurants) exposent `data-cid` au MÊME canal que le combat
 * (`extras.cid` de `BodyToken`) : cibler un PNJ hors combat en recette navigateur ne coûte plus la
 * lecture ad hoc du DOM, `__wfrp.screenPos(id)` fonctionne dans les deux modes.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { figurantLayerObjs } from './tokens';
import type { TokenCtx } from './tokens';
import type { TokenEl } from '../builders/types';
import type { SceneEntity } from '../../state/scene';

const ctx: TokenCtx = { dims: { w: 5, h: 5 }, view: 'iso', liftAt: () => 0 };

const ent: SceneEntity = { kind: 'personnage', id: 'servant-1', label: 'Servant du bélier', pos: { x: 1, y: 1 }, ref: 'garde-du-village' };

const tokenEl: TokenEl = {
  kind: 'token',
  id: ent.id,
  key: `token:${ent.id}`,
  cell: { x: 1, y: 1, z: 0 },
  states: { visible: true },
  subject: { kind: 'figurant', ent, enrolled: false, inBattle: false },
};

describe('figurantLayerObjs — data-cid (#226)', () => {
  it('un figurant rend son token avec data-cid = id de la SceneEntity', () => {
    const objs = figurantLayerObjs([tokenEl], ctx);
    expect(objs.length).toBeGreaterThan(0);
    const html = objs.map((o) => renderToStaticMarkup(<svg>{o.el}</svg>)).join('');
    expect(html).toContain(`data-cid="${ent.id}"`);
  });
});
