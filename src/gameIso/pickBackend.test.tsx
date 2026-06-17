import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { pickBackend } from './pickBackend';
import { resolveRender } from './rig/bodyPlan';
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

const NO_AP = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 };
const mk = (over: Partial<Combatant>): Combatant => ({
  id: 't1', name: 'X', kind: 'enemy', armour: NO_AP, items: [], weapons: [], skills: [], talents: [],
  traits: [], characteristics: {}, wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4, ...over,
} as unknown as Combatant);

/**
 * Garde-fou du THREADING data-driven (P5/5c) : `pickBackend` résout le rendu par `resolveRender`
 * (espèce explicite + trait Nuée) et passe `planId`/`species`/`scale` au token — plus de match par
 * nom dans la dispatch. Les goldens ne couvrent PAS pickBackend (ils testent plan.resolve direct).
 */
describe('pickBackend — threading resolveRender → token (P5/5c)', () => {
  it('non-bipède (Cheval) : backend plan + planId/species/scale résolus passés au token', () => {
    const c = mk({ name: 'Cheval', species: 'Cheval', traits: ['Taille (Grande)', 'Bestial'] });
    const r = resolveRender(c.species, c.traits, c.name);
    const out = pickBackend({ kind: 'combatant', combatant: c });
    expect(out.backend).toBe('plan');
    expect(out.speciesScale).toBe(r.scale);
    const body = out.body as ReactElement;
    expect(body.props.planId).toBe(r.plan);
    expect(body.props.species).toBe('Cheval');
  });

  it('Nuée (trait, donnée) : gabarit swarm passé au token même SANS espèce explicite', () => {
    const out = pickBackend({ kind: 'combatant', combatant: mk({ name: 'Essaim de rats', traits: [{ id: 'nuee' }] }) });
    expect(out.backend).toBe('plan');
    expect((out.body as ReactElement).props.planId).toBe('swarm');
  });

  it('bipède (Humain, espèce explicite) : backend rig', () => {
    expect(pickBackend({ kind: 'combatant', combatant: mk({ name: 'Humain', species: 'Humain' }) }).backend).toBe('rig');
  });
});
