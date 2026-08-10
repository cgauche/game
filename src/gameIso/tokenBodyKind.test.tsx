import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tokenBodyKind } from './tokenBodyKind';
import { resolveRender } from './rig/bodyPlan';
import type { Combatant } from '../engine/types';
import type { SceneEntity } from '../state/scene';

const hero = { id: 'h1', kind: 'hero', name: 'Soldat', career: 'Soldat', appearance: { species: 'Humain', sex: 'M', build: 0.5, seed: 3 } } as unknown as Combatant;

describe('tokenBodyKind — view top', () => {
  it('héros bipède : flat=true + portraitBox + corps en vue de face (tête)', () => {
    const r = tokenBodyKind({ kind: 'combatant', combatant: hero }, 'top');
    expect(r.flat).toBe(true);
    expect(r.portraitBox).toMatch(/^[\d.-]+ [\d.-]+ [\d.-]+ [\d.-]+$/);
    const html = renderToStaticMarkup(<svg>{r.body}</svg>);
    expect(html).toContain('data-bone="tete"');
  });

  it('iso (défaut) : flat=false', () => {
    const r = tokenBodyKind({ kind: 'combatant', combatant: hero });
    expect(r.flat).toBe(false);
  });

  it('décor (prop) : backend sprite, flat=false même en top', () => {
    const ent = { id: 'p1', kind: 'prop', ref: 'tonneau', pos: { x: 0, y: 0 } } as SceneEntity;
    const r = tokenBodyKind({ kind: 'sceneEntity', ent }, 'top');
    expect(r.bodyKind).toBe('sprite');
    expect(r.flat).toBe(false);
  });
});

const NO_AP = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 };
const mk = (over: Partial<Combatant>): Combatant => ({
  id: 't1', name: 'X', kind: 'enemy', armour: NO_AP, items: [], weapons: [], skills: [], talents: [],
  traits: [], characteristics: {}, wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4, ...over,
} as unknown as Combatant);

/**
 * Garde-fou du THREADING data-driven (P5/5c) : `tokenBodyKind` résout le rendu par `resolveRender`
 * (espèce explicite + trait Nuée) et passe `planId`/`species`/`scale` au token — plus de match par
 * nom dans la dispatch. Les goldens ne couvrent PAS tokenBodyKind (ils testent plan.resolve direct).
 */
describe('tokenBodyKind — threading resolveRender → token (P5/5c)', () => {
  it('non-bipède (Cheval) : backend plan + planId/species/scale résolus passés au token', () => {
    const c = mk({ name: 'Cheval', species: 'cheval', traits: ['Taille (Grande)', 'Bestial'] });
    const r = resolveRender(c.species, c.traits, c.name);
    const out = tokenBodyKind({ kind: 'combatant', combatant: c });
    expect(out.bodyKind).toBe('plan');
    expect(out.speciesScale).toBe(r.scale);
    const body = out.body as ReactElement;
    expect(body.props.planId).toBe(r.plan);
    expect(body.props.species).toBe('cheval');
  });

  it('Nuée (trait, donnée) : gabarit swarm passé au token même SANS espèce explicite', () => {
    const out = tokenBodyKind({ kind: 'combatant', combatant: mk({ name: 'Essaim de rats', traits: [{ id: 'nuee' }] }) });
    expect(out.bodyKind).toBe('plan');
    expect((out.body as ReactElement).props.planId).toBe('swarm');
  });

  it('bipède (Humain, espèce explicite) : backend rig', () => {
    expect(tokenBodyKind({ kind: 'combatant', combatant: mk({ name: 'Humain', species: 'Humain' }) }).bodyKind).toBe('rig');
  });
});
