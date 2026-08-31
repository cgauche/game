import { describe, it, expect } from 'vitest';
import { schema as propsSchema } from './schemas/defs/props';
import { props, propMaterials, findPropMaterialById } from './index';
import { validatePropCatalog, type PropData } from './props.types';

const propFixture = (patch: Partial<PropData>): PropData => ({ id: 'x', type: 'props', label: 'X d’épreuve', solid: true, ...patch });

describe('props.json — formes strictes de la recette volumique et des places assises', () => {
  it('refuse une primitive inconnue et un matériau absent', () => {
    // Le `type` d'enveloppe est POSÉ sur chaque sonde négative : sans lui, elles sortiraient rouges
    // pour un `type` manquant et ne mordraient plus la forme qu'elles visent.
    expect(() => propsSchema.parse([{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { primitives: [{ kind: 'sphere' }] } }])).toThrow();
    expect(validatePropCatalog(
      [{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { primitives: [{ kind: 'box', center: { x: 0, y: 0, h: 0.5 }, size: { x: 1, y: 1, h: 1 }, material: 'absent' }] } }],
      [{ id: 'bois-chene', type: 'propMaterials', label: 'Chêne', color: '#5b3a22', roughness: 0.82, metalness: 0 }],
    )).toContain('x: matériau inconnu « absent »');
  });

  it('accepte une recette et des places assises bien formées', () => {
    expect(() => propsSchema.parse([{
      id: 'x',
      type: 'props',
      label: 'X d’épreuve',
      solid: true,
      foot: { w: 2, h: 1 },
      volume: {
        primitives: [
          { kind: 'box', center: { x: 0, y: 0, h: 0.4 }, size: { x: 1.6, y: 0.8, h: 0.08 }, material: 'bois-chene' },
          { kind: 'cylinder', center: { x: 0, y: 0, h: 0.2 }, radius: 0.06, heightM: 0.4, sides: 8, material: 'fer-noirci' },
          { kind: 'prism', center: { x: 0, y: 0, h: 0.9 }, size: { x: 1, y: 0.6, h: 0.3 }, slope: 'y+', material: 'pierre-atre' },
        ],
      },
      seatSlots: [{ id: 'nord', anchor: { x: 0, y: -0.35, h: 0.48 }, facing: 'S', approach: { x: 0, y: -1 } }],
    }])).not.toThrow();
  });

  it('refuse une face de cylindre hors barème et une pente inconnue', () => {
    expect(() => propsSchema.parse([{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { primitives: [{ kind: 'cylinder', center: { x: 0, y: 0, h: 0.2 }, radius: 0.1, heightM: 0.4, sides: 10, material: 'fer-noirci' }] } }])).toThrow();
    expect(() => propsSchema.parse([{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { primitives: [{ kind: 'prism', center: { x: 0, y: 0, h: 0.2 }, size: { x: 1, y: 1, h: 1 }, slope: 'z+', material: 'bois-chene' }] } }])).toThrow();
  });
});

describe('validatePropCatalog — invariants de données du décor', () => {
  it('refuse dimensions non positives, nombres non finis et slots ambigus', () => {
    const bad = propFixture({
      volume: { primitives: [{ kind: 'box', center: { x: 0, y: 0, h: 0 }, size: { x: 0, y: 1, h: 1 }, material: 'bois-chene' }] },
      seatSlots: [
        { id: 'nord', anchor: { x: 0, y: -0.35, h: 0.48 }, facing: 'S', approach: { x: 0, y: 1 } },
        { id: 'nord', anchor: { x: 0.3, y: 0, h: 0.48 }, facing: 'O', approach: { x: 0, y: 1 } },
      ],
    });
    expect(validatePropCatalog([bad], propMaterials)).toEqual(expect.arrayContaining([
      expect.stringContaining('dimension non positive'),
      expect.stringContaining('slot dupliqué « nord »'),
      expect.stringContaining('approche dupliquée (0,1)'),
    ]));
  });

  it('distingue un slot SANS id d’un slot DUPLIQUÉ (deux causes, deux messages)', () => {
    const sansId = propFixture({ seatSlots: [{ id: '  ', anchor: { x: 0, y: -0.35, h: 0.48 }, facing: 'S', approach: { x: 0, y: -1 } }] });
    expect(validatePropCatalog([sansId], propMaterials)).toEqual(['x: slot sans id']);
  });

  it('refuse une coordonnée non finie, sur une boîte comme sur un cylindre', () => {
    const boite = propFixture({ volume: { primitives: [{ kind: 'box', center: { x: Number.NaN, y: 0, h: 0.5 }, size: { x: 1, y: 1, h: 1 }, material: 'bois-chene' }] } });
    const cylindre = propFixture({ volume: { primitives: [{ kind: 'cylinder', center: { x: 0, y: 0, h: 0.5 }, radius: Number.POSITIVE_INFINITY, heightM: 1, sides: 12, material: 'fer-noirci' }] } });
    expect(validatePropCatalog([boite], propMaterials)).toContain('x: coordonnée non finie');
    expect(validatePropCatalog([cylindre], propMaterials)).toContain('x: coordonnée non finie');
  });

  it('refuse une approche qui tombe DANS l’empreinte d’un décor solide — empreinte 2×1 comprise', () => {
    const unSurUn = propFixture({ seatSlots: [{ id: 'centre', anchor: { x: 0, y: 0, h: 0.48 }, facing: 'S', approach: { x: 0, y: 0 } }] });
    expect(validatePropCatalog([unSurUn], propMaterials)).toContain('x: approche « centre » dans l’empreinte (0,0)');

    const deuxSurUn = propFixture({
      foot: { w: 2, h: 1 },
      seatSlots: [{ id: 'est', anchor: { x: 1, y: 0, h: 0.48 }, facing: 'O', approach: { x: 1, y: 0 } }],
    });
    expect(validatePropCatalog([deuxSurUn], propMaterials)).toContain('x: approche « est » dans l’empreinte (1,0)');

    const degage = propFixture({
      foot: { w: 2, h: 1 },
      seatSlots: [{ id: 'est', anchor: { x: 1, y: 0, h: 0.48 }, facing: 'O', approach: { x: 2, y: 0 } }],
    });
    expect(validatePropCatalog([degage], propMaterials)).toEqual([]);
  });

  it('un décor NON solide se laisse aborder sur sa propre case', () => {
    const traversable = propFixture({ solid: false, seatSlots: [{ id: 'centre', anchor: { x: 0, y: 0, h: 0.48 }, facing: 'S', approach: { x: 0, y: 0 } }] });
    expect(validatePropCatalog([traversable], propMaterials)).toEqual([]);
  });

  it('le catalogue RÉEL est intègre', () => {
    expect(validatePropCatalog(props, propMaterials)).toEqual([]);
  });
});

describe('propMaterials.json — matériaux du décor', () => {
  it('porte les matériaux du décor, en couleur hexadécimale et sans émission', () => {
    expect(propMaterials.map((m) => m.id)).toEqual([
      'bois-chene', 'pierre-atre', 'fer-noirci', 'braises', 'ardoise', 'toile-rouge', 'laiton-dore',
    ]);
    for (const m of propMaterials) {
      expect(m.color, m.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(m.roughness, m.id).toBeGreaterThanOrEqual(0);
      expect(m.roughness, m.id).toBeLessThanOrEqual(1);
      expect(m.metalness, m.id).toBeGreaterThanOrEqual(0);
      expect(m.metalness, m.id).toBeLessThanOrEqual(1);
      expect(Object.keys(m).sort(), m.id).toEqual(['color', 'id', 'label', 'metalness', 'roughness', 'type']);
    }
  });

  it('les braises ne portent AUCUNE émission — la lumière de cheminée vient de `light`', () => {
    const braises = findPropMaterialById('braises');
    expect(braises).toBeDefined();
    expect(braises).not.toHaveProperty('emissive');
    expect(findPropMaterialById('inconnu')).toBeUndefined();
  });
});
