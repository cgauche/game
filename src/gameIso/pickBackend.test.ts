import { describe, it, expect } from 'vitest';
import { pickBackend } from './pickBackend';
import type { SceneEntity } from '../state/scene';

const ent = (over: Partial<SceneEntity>): SceneEntity => ({ id: 'x', kind: 'objet', pos: { x: 0, y: 0 }, ...over });

describe('pickBackend — classifieur de backend (rig / plan / sprite)', () => {
  it('leader absent → sprite, id __party', () => {
    const r = pickBackend({ kind: 'partyLeader', leader: undefined });
    expect(r.backend).toBe('sprite');
    expect(r.id).toBe('__party');
  });

  it('entité objet sans ref → sprite, id préfixé e-', () => {
    const r = pickBackend({ kind: 'sceneEntity', ent: ent({ id: 'a', kind: 'objet' }) });
    expect(r.backend).toBe('sprite');
    expect(r.id).toBe('e-a');
  });

  it('personnage humanoïde (Villageois) → rig', () => {
    const r = pickBackend({ kind: 'sceneEntity', ent: ent({ id: 'b', kind: 'personnage', ref: 'Villageois' }) });
    expect(r.backend).toBe('rig');
    expect(r.id).toBe('e-b');
  });

  it('personnage créature non-bipède (Rat géant) → plan (fin de l’asymétrie sprite figé)', () => {
    const r = pickBackend({ kind: 'sceneEntity', ent: ent({ id: 'c', kind: 'personnage', ref: 'Rat géant' }) });
    expect(r.backend).toBe('plan');
    expect(r.id).toBe('e-c');
  });
});
