import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { pickBackend } from './pickBackend';
import type { Combatant } from '../engine/types';
import type { SceneEntity } from '../state/scene';

const hero = { id: 'h1', kind: 'hero', name: 'Soldat', career: 'Soldat', appearance: { species: 'Humain', sex: 'M', build: 0.5, seed: 3 } } as unknown as Combatant;

describe('pickBackend — view top', () => {
  it('héros bipède : flat=true + portraitBox + corps en vue de face (tête)', () => {
    const r = pickBackend({ kind: 'combatant', combatant: hero }, 'top');
    expect(r.flat).toBe(true);
    expect(r.portraitBox).toMatch(/^[\d.-]+ [\d.-]+ [\d.-]+ [\d.-]+$/);
    const html = renderToStaticMarkup(<svg>{r.body}</svg>);
    expect(html).toContain('data-bone="tete"');
  });

  it('iso (défaut) : flat=false', () => {
    const r = pickBackend({ kind: 'combatant', combatant: hero });
    expect(r.flat).toBe(false);
  });

  it('décor (prop) : backend sprite, flat=false même en top', () => {
    const ent = { id: 'p1', kind: 'prop', ref: 'tonneau', pos: { x: 0, y: 0 } } as SceneEntity;
    const r = pickBackend({ kind: 'sceneEntity', ent }, 'top');
    expect(r.backend).toBe('sprite');
    expect(r.flat).toBe(false);
  });
});
