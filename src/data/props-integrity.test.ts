import { describe, it, expect } from 'vitest';
import { schema as propsSchema } from './schemas/defs/props';
import { PROPS_VOLUMIQUES } from './schemas/_ids.generated';
import { props, propMaterials, findPropMaterialById } from './index';
import { aretesNonAppariees, polygonesDePrimitive, validatePropCatalog, type PropData, type PropPrimitive } from './props.types';

const propFixture = (patch: Partial<PropData>): PropData => ({ id: 'x', type: 'props', label: 'X d’épreuve', solid: true, ...patch });

describe('props.json — formes strictes de la recette volumique et des places assises', () => {
  it('refuse une primitive inconnue et un matériau absent', () => {
    // Le `type` d'enveloppe est POSÉ sur chaque sonde négative : sans lui, elles sortiraient rouges
    // pour un `type` manquant et ne mordraient plus la forme qu'elles visent.
    expect(() => propsSchema.parse([{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { capIdentite: 'S', primitives: [{ kind: 'sphere' }] } }])).toThrow();
    expect(validatePropCatalog(
      [{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { capIdentite: 'S', primitives: [{ kind: 'box', center: { x: 0, y: 0, h: 0.5 }, size: { x: 1, y: 1, h: 1 }, material: 'absent' }] } }],
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
        capIdentite: 'S',
        primitives: [
          { kind: 'box', center: { x: 0, y: 0, h: 0.4 }, size: { x: 1.6, y: 0.8, h: 0.08 }, material: 'bois-chene' },
          { kind: 'cylinder', center: { x: 0, y: 0, h: 0.2 }, radius: 0.06, heightM: 0.4, sides: 8, material: 'fer-noirci' },
          { kind: 'prism', center: { x: 0, y: 0, h: 0.9 }, size: { x: 1, y: 0.6, h: 0.3 }, slope: 'y+', material: 'pierre-atre' },
        ],
      },
      seatSlots: [{ id: 'place-1', anchor: { x: 0, y: -0.35, h: 0.48 }, facing: 'S', approach: { x: 0, y: -1 } }],
    }])).not.toThrow();
  });

  it('refuse une face de cylindre hors barème et une pente inconnue', () => {
    expect(() => propsSchema.parse([{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { capIdentite: 'S', primitives: [{ kind: 'cylinder', center: { x: 0, y: 0, h: 0.2 }, radius: 0.1, heightM: 0.4, sides: 10, material: 'fer-noirci' }] } }])).toThrow();
    // 12 côtés : quatre normales latérales à ±45°, l'arête de couteau du modelé de forme (#1680 ligne 9).
    expect(() => propsSchema.parse([{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { capIdentite: 'S', primitives: [{ kind: 'cylinder', center: { x: 0, y: 0, h: 0.2 }, radius: 0.1, heightM: 0.4, sides: 12, material: 'fer-noirci' }] } }])).toThrow();
    expect(() => propsSchema.parse([{ id: 'x', type: 'props', label: 'X d’épreuve', volume: { capIdentite: 'S', primitives: [{ kind: 'prism', center: { x: 0, y: 0, h: 0.2 }, size: { x: 1, y: 1, h: 1 }, slope: 'z+', material: 'bois-chene' }] } }])).toThrow();
  });

  /**
   * REPÈRE DÉCLARÉ (#1680 ligne 16) : `capIdentite` est le marqueur qui dit dans quel repère la
   * géométrie est écrite. Il est REQUIS — une recette mutée sous l'ancien repère (`N`) ou sans repère
   * du tout ne peut pas entrer, et c'est aussi ce qui rend la migration `2026-09-02-1680-cap-identite-
   * sud.mjs` idempotente : une rotation de 180° est sa propre inverse, aucune FORME ne la distingue.
   */
  /**
   * ID DE PLACE SANS CÔTÉ (#1680 ligne 16) : la clé d'une place porte son RANG, jamais un point
   * cardinal ni une main — un id cardinal ment dès que le repère de la recette bouge, et le côté est
   * déjà porté par `anchor`/`facing`/`approach`, qui tournent avec le cap de l'instance.
   */
  it('refuse un id de place qui porte un CÔTÉ', () => {
    const place = (id: string) => [{
      id: 'x', type: 'props', label: 'X d’épreuve',
      seatSlots: [{ id, anchor: { x: 0, y: -0.35, h: 0.48 }, facing: 'S', approach: { x: 0, y: -1 } }],
    }];
    for (const cote of ['place-nord', 'place-sud', 'place-est', 'place-ouest', 'place-gauche', 'place-droite'])
      expect(propsSchema.safeParse(place(cote)).success, cote).toBe(false);
    expect(propsSchema.safeParse(place('nord')).success, 'sans le préfixe').toBe(false);
    expect(propsSchema.safeParse(place('place-1')).success, 'place-1').toBe(true);
    expect(propsSchema.safeParse(place('place-12')).success, 'place-12').toBe(true);
  });

  it('refuse une recette SANS repère déclaré, et une recette restée au repère `N`', () => {
    const recette = (volume: unknown) => [{ id: 'x', type: 'props', label: 'X d’épreuve', volume }];
    const primitives = [{ kind: 'box', center: { x: 0, y: 0, h: 0.5 }, size: { x: 1, y: 1, h: 1 }, material: 'bois-chene' }];
    expect(propsSchema.safeParse(recette({ primitives })).success, 'sans `capIdentite`').toBe(false);
    expect(propsSchema.safeParse(recette({ capIdentite: 'N', primitives })).success, 'repère `N`').toBe(false);
    expect(propsSchema.safeParse(recette({ capIdentite: 'S', primitives })).success, 'repère `S`').toBe(true);
  });
});

describe('validatePropCatalog — invariants de données du décor', () => {
  it('refuse dimensions non positives, nombres non finis et slots ambigus', () => {
    const bad = propFixture({
      volume: { capIdentite: 'S', primitives: [{ kind: 'box', center: { x: 0, y: 0, h: 0 }, size: { x: 0, y: 1, h: 1 }, material: 'bois-chene' }] },
      seatSlots: [
        { id: 'place-1', anchor: { x: 0, y: -0.35, h: 0.48 }, facing: 'S', approach: { x: 0, y: 1 } },
        { id: 'place-1', anchor: { x: 0.3, y: 0, h: 0.48 }, facing: 'O', approach: { x: 0, y: 1 } },
      ],
    });
    expect(validatePropCatalog([bad], propMaterials)).toEqual(expect.arrayContaining([
      expect.stringContaining('dimension non positive'),
      expect.stringContaining('slot dupliqué « place-1 »'),
      expect.stringContaining('approche dupliquée (0,1)'),
    ]));
  });

  it('distingue un slot SANS id d’un slot DUPLIQUÉ (deux causes, deux messages)', () => {
    const sansId = propFixture({ seatSlots: [{ id: '  ', anchor: { x: 0, y: -0.35, h: 0.48 }, facing: 'S', approach: { x: 0, y: -1 } }] });
    expect(validatePropCatalog([sansId], propMaterials)).toEqual(['x: slot sans id']);
  });

  it('refuse une coordonnée non finie, sur une boîte comme sur un cylindre', () => {
    const boite = propFixture({ volume: { capIdentite: 'S', primitives: [{ kind: 'box', center: { x: Number.NaN, y: 0, h: 0.5 }, size: { x: 1, y: 1, h: 1 }, material: 'bois-chene' }] } });
    const cylindre = propFixture({ volume: { capIdentite: 'S', primitives: [{ kind: 'cylinder', center: { x: 0, y: 0, h: 0.5 }, radius: Number.POSITIVE_INFINITY, heightM: 1, sides: 16, material: 'fer-noirci' }] } });
    expect(validatePropCatalog([boite], propMaterials)).toContain('x: coordonnée non finie');
    expect(validatePropCatalog([cylindre], propMaterials)).toContain('x: coordonnée non finie');
  });

  it('refuse une approche qui tombe DANS l’empreinte d’un décor solide — empreinte 2×1 comprise', () => {
    const unSurUn = propFixture({ seatSlots: [{ id: 'place-1', anchor: { x: 0, y: 0, h: 0.48 }, facing: 'S', approach: { x: 0, y: 0 } }] });
    expect(validatePropCatalog([unSurUn], propMaterials)).toContain('x: approche « place-1 » dans l’empreinte (0,0)');

    const deuxSurUn = propFixture({
      foot: { w: 2, h: 1 },
      seatSlots: [{ id: 'place-1', anchor: { x: 1, y: 0, h: 0.48 }, facing: 'O', approach: { x: 1, y: 0 } }],
    });
    expect(validatePropCatalog([deuxSurUn], propMaterials)).toContain('x: approche « place-1 » dans l’empreinte (1,0)');

    const degage = propFixture({
      foot: { w: 2, h: 1 },
      seatSlots: [{ id: 'place-1', anchor: { x: 1, y: 0, h: 0.48 }, facing: 'O', approach: { x: 2, y: 0 } }],
    });
    expect(validatePropCatalog([degage], propMaterials)).toEqual([]);
  });

  it('refuse une recette dont le REPÈRE déclaré n’est pas celui qu’implémente `rotatePropLocal`', () => {
    const primitives: PropPrimitive[] = [{ kind: 'box', center: { x: 0, y: 0, h: 0.5 }, size: { x: 1, y: 1, h: 1 }, material: 'bois-chene' }];
    const auNord = propFixture({ volume: { capIdentite: 'N', primitives } as unknown as PropData['volume'] });
    expect(validatePropCatalog([auNord], propMaterials)).toContain('x: recette au repère « N » (seul S est implémenté)');
    expect(validatePropCatalog([propFixture({ volume: { capIdentite: 'S', primitives } })], propMaterials)).toEqual([]);
  });

  it('un décor NON solide se laisse aborder sur sa propre case', () => {
    const traversable = propFixture({ solid: false, seatSlots: [{ id: 'place-1', anchor: { x: 0, y: 0, h: 0.48 }, facing: 'S', approach: { x: 0, y: 0 } }] });
    expect(validatePropCatalog([traversable], propMaterials)).toEqual([]);
  });

  it('le catalogue RÉEL est intègre', () => {
    expect(validatePropCatalog(props, propMaterials)).toEqual([]);
  });
});

describe('FERMETURE — une primitive est une COQUILLE CLOSE', () => {
  const UNE_DE_CHAQUE: PropPrimitive[] = [
    { kind: 'box', center: { x: 0, y: 0, h: 0.5 }, size: { x: 1, y: 0.6, h: 1 }, material: 'bois-chene' },
    { kind: 'cylinder', center: { x: 0, y: 0, h: 0.5 }, radius: 0.3, heightM: 1, sides: 8, material: 'fer-noirci' },
    { kind: 'cylinder', center: { x: 0, y: 0, h: 0.5 }, radius: 0.3, heightM: 1, sides: 16, material: 'fer-noirci' },
    { kind: 'prism', center: { x: 0, y: 0, h: 0.5 }, size: { x: 1, y: 0.8, h: 1 }, slope: 'y+', material: 'pierre-atre' },
  ];

  it.each(UNE_DE_CHAQUE.map((p) => [`${p.kind}${p.kind === 'cylinder' ? ` ${p.sides}` : ''}`, p] as const))(
    '%s : chaque arête portée par exactement 2 faces, en sens opposés',
    (_nom, primitive) => {
      expect(aretesNonAppariees(polygonesDePrimitive(primitive))).toEqual([]);
    },
  );

  it('une coquille PERCÉE est nommée arête par arête (le prédicat ne rend pas `[]` par défaut)', () => {
    const [boite] = UNE_DE_CHAQUE;
    const polys = polygonesDePrimitive(boite);
    expect(polys).toHaveLength(6);
    // Une face en moins : les 4 arêtes qu'elle portait n'ont plus qu'un seul sens.
    const percée = aretesNonAppariees(polys.slice(1));
    expect(percée).toHaveLength(4);
    for (const { sens, contreSens } of percée) expect([sens, contreSens]).toEqual([1, 0]);
    expect(percée.map((d) => d.arete)).toContain('-0.5,-0.3,0→-0.5,-0.3,1');
  });

  it('le CATALOGUE réel ne porte aucune arête non appariée', () => {
    const primitives = props.flatMap((p) => p.volume?.primitives ?? []);
    expect(primitives.length, 'aucune primitive : ce contrat mesurerait du néant').toBeGreaterThan(100);
    expect(primitives.filter((p) => aretesNonAppariees(polygonesDePrimitive(p)).length > 0)).toEqual([]);
  });

  it('le validateur refuse un cylindre à 12 côtés arrivé par la DONNÉE (le JSON n’est pas typé à l’exécution)', () => {
    const douze = { kind: 'cylinder', center: { x: 0, y: 0, h: 0.5 }, radius: 0.3, heightM: 1, sides: 12, material: 'fer-noirci' } as unknown as PropPrimitive;
    expect(validatePropCatalog([propFixture({ volume: { capIdentite: 'S', primitives: [douze] } })], propMaterials))
      .toEqual(['x: cylindre à 12 côtés (admis : 8 ou 16)']);
    const huit: PropPrimitive = { ...(douze as { kind: 'cylinder' } & PropPrimitive), sides: 8 };
    expect(validatePropCatalog([propFixture({ volume: { capIdentite: 'S', primitives: [huit] } })], propMaterials)).toEqual([]);
  });
});

/**
 * REGISTRE GÉNÉRÉ des décors À RECETTE (`PROPS_VOLUMIQUES`, `schemas/_ids.generated.ts`) — le seul
 * canal par lequel la couche SCHÉMAS sait, au parse, qu'un `ref` désigne un volume (elle ne peut pas
 * lire le catalogue au runtime : `src/data/index.ts` importe les schémas). Ce contrat le tient ÉGAL à
 * la mesure sur `props.json` : une recette ajoutée sans `npm run gen` est rouge ici, et le verrou de
 * cap du schéma ne peut donc pas se périmer en silence.
 */
describe('PROPS_VOLUMIQUES — le registre généré == la mesure sur props.json', () => {
  it('exactement les ids qui portent des primitives, triés', () => {
    const mesure = props
      .filter((p) => (p.volume?.primitives.length ?? 0) > 0)
      .map((p) => p.id)
      .sort();
    expect(mesure.length, 'aucune recette : ce contrat mesurerait du néant').toBeGreaterThan(10);
    expect([...PROPS_VOLUMIQUES]).toEqual(mesure);
  });

  it('un décor SANS recette n’y figure pas (le registre n’est pas la liste des props)', () => {
    const billboards = props.filter((p) => !p.volume?.primitives.length).map((p) => p.id);
    expect(billboards.length).toBeGreaterThan(10);
    expect(billboards.filter((id) => PROPS_VOLUMIQUES.includes(id))).toEqual([]);
  });
});

describe('propMaterials.json — matériaux du décor', () => {
  it('porte les matériaux du décor, en couleur hexadécimale et sans émission', () => {
    expect(propMaterials.map((m) => m.id)).toEqual([
      'bois-chene', 'pierre-atre', 'fer-noirci', 'braises', 'ardoise', 'toile-rouge', 'laiton-dore',
      'albatre',
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
