import { flowFromEffects, testFlow, EMPTY_FLOW } from '../state/flow';
import { describe, it, expect } from 'vitest';
import { validateScene, type Warning } from './validateScene';
import { emptyScene } from './scene';
import { METRES_PER_LEVEL } from './relief';
import type { WorldMap, MapPlace } from './worldMap';

function base() {
  const s = emptyScene(5, 5);
  s.id = 'A';
  return s;
}
const msgs = (w: Warning[]) => w.map((x) => x.message);

describe('validateScene', () => {
  it('scène propre = 0 avertissement', () => {
    expect(validateScene([base()])).toEqual([]);
  });

  it("dialogueId d'entité inexistant → erreur", () => {
    const s = base();
    s.entities.push({ id: 'e-0', kind: 'personnage', pos: { x: 1, y: 1 }, dialogueId: 'manque' });
    const w = validateScene([s]);
    expect(w.some((x) => x.scope === 'entity' && x.refId === 'e-0' && /dialogue inexistant/.test(x.message))).toBe(true);
  });

  it('entité sur un étage inexistant → avertissement', () => {
    const s = base(); // un seul niveau z=0
    s.entities.push({ id: 'e-z', kind: 'personnage', pos: { x: 1, y: 1 }, z: 2 });
    expect(msgs(validateScene([s])).some((m) => /étage 2 inexistant/.test(m))).toBe(true);
  });

  it('effet transition vers scène inconnue → erreur', () => {
    const s = base();
    s.triggers.push({ id: 't-0', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'transition', scene: 'nope' }]) });
    expect(msgs(validateScene([s])).some((m) => /scène inexistante/.test(m))).toBe(true);
  });

  it('trigger hors carte → avertissement', () => {
    const s = base();
    s.triggers.push({ id: 't-1', rect: { x: 4, y: 4, w: 3, h: 3 }, flow: flowFromEffects([]) });
    expect(msgs(validateScene([s])).some((m) => /déborde/.test(m))).toBe(true);
  });

  it('ids dupliqués → erreur', () => {
    const s = base();
    s.entities.push({ id: 'dup', kind: 'prop', pos: { x: 0, y: 0 } }, { id: 'dup', kind: 'prop', pos: { x: 1, y: 1 } });
    expect(msgs(validateScene([s])).some((m) => /dupliqué/.test(m))).toBe(true);
  });

  it('ids de zones d’effet dupliqués → erreur', () => {
    const s = base();
    s.effectZones = [
      { id: 'zone', label: 'Une', area: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 } },
      { id: 'zone', label: 'Deux', area: { kind: 'rect', x: 1, y: 0, w: 1, h: 1 } },
    ];
    expect(validateScene([s]).some((w) => w.scope === 'scene' && w.refId === 'zone' && /dupliqué/.test(w.message))).toBe(true);
  });

  it.each([
    ['masse hors carte', { footprint: [{ x: 4, y: 4, w: 3, h: 3 }] }],
    ['masse sans partie', { footprint: [] }],
  ])('architecture : refuse %s', (_label, patch) => {
    const s = base();
    s.effectZones = [{ id: 'salle', label: 'Salle', presentation: 'interior', z: 0, area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 } }];
    s.architecture = [{
      id: 'corps', style: 'maison',
      storeys: [{ id: 'z0', z: 0, parts: [{ id: 'nef', foot: { x: 1, y: 1, w: 2, h: 2 } }], roomZoneIds: ['salle'] }],
      facades: [],
      masses: [{ id: 'toit', z: 0, footprint: [{ x: 1, y: 1, w: 2, h: 2 }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 42, material: 'tuile' }],
    }];
    Object.assign(s.architecture[0].masses[0], patch);
    expect(validateScene([s]).some((w) => w.scope === 'architecture' && w.level === 'error')).toBe(true);
  });

  it('architecture : un ÉTAGE référençant une zone d’un autre étage (au-dessus OU en-dessous) → erreur', () => {
    const s = base();
    s.layers.push({ z: 1, tiles: new Array(25).fill('vide') });
    s.effectZones = [
      { id: 'rez-de-chaussee', label: 'Salle', presentation: 'interior', z: 0, area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 } },
      { id: 'combles', label: 'Combles', presentation: 'interior', z: 1, area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 } },
    ];
    s.architecture = [{
      id: 'corps', style: 'maison',
      storeys: [
        { id: 'rez', z: 0, parts: [{ id: 'partie-rez', foot: { x: 1, y: 1, w: 2, h: 2 } }], roomZoneIds: ['combles'] },
        { id: 'etage', z: 1, parts: [{ id: 'partie-etage', foot: { x: 1, y: 1, w: 2, h: 2 } }], roomZoneIds: ['rez-de-chaussee'] },
      ],
      facades: [],
      masses: [],
    }];
    const w = validateScene([s]);
    expect(w.some((x) => x.scope === 'architecture' && x.refId === 'rez' && x.level === 'error')).toBe(true);
    expect(w.some((x) => x.scope === 'architecture' && x.refId === 'etage' && x.level === 'error')).toBe(true);
  });

  it('architecture : un étage doit dominer celui du dessous d’une hauteur de mur (le relief, lui, reste libre)', () => {
    const s = base();
    s.layers.push({ z: 1, tiles: new Array(25).fill('sol') });
    s.architecture = [{
      id: 'corps', style: 'maison', storeys: [], facades: [],
      masses: [{ id: 'toit', z: 1, footprint: [{ x: 1, y: 1, w: 2, h: 2 }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 42, material: 'tuile' }],
    }];
    // Couche d'étage NON cotée : plancher, murs et toiture de l'étage retombent tous au rez.
    expect(validateScene([s]).some((w) => w.scope === 'architecture' && w.refId === 'toit' && w.level === 'error' && /plancher/.test(w.message))).toBe(true);
    // CONTRE-ÉPREUVE : cotée au sommet des murs du rez, la même masse ne dit plus rien.
    s.layers.find((layer) => layer.z === 1)!.height = new Array(25).fill(METRES_PER_LEVEL);
    expect(validateScene([s]).filter((w) => w.scope === 'architecture')).toEqual([]);
    // RELIEF LIBRE : bâtiment sur une BUTTE — les deux couches montent ensemble, l'empilement tient.
    s.layers.find((layer) => layer.z === 0)!.height = new Array(25).fill(6);
    s.layers.find((layer) => layer.z === 1)!.height = new Array(25).fill(6 + METRES_PER_LEVEL);
    expect(validateScene([s]).filter((w) => w.scope === 'architecture')).toEqual([]);
  });

  it('architecture : refuse ids dupliqués, arêtes invalides et valeurs de masse incohérentes', () => {
    const s = base();
    s.architecture = [{
      id: 'corps', style: 'maison',
      storeys: [
        { id: 'z', z: 0, parts: [{ id: 'p', foot: { x: 1, y: 1, w: 2, h: 2 } }, { id: 'p', foot: { x: 1, y: 1, w: 2, h: 2 } }], roomZoneIds: [] },
        { id: 'z', z: 0, parts: [], roomZoneIds: [] },
      ],
      facades: [{ id: 'f', z: 0, edges: [{ x: 5, y: 0, side: 'S' as never, z: 1 }], appearance: 'mur', features: [{ id: 'g', kind: 'gable', edge: { x: 5, y: 0, side: 'S' as never } }] }],
      masses: [{ id: 'r', z: 0, footprint: [{ x: 1, y: 1, w: 2, h: 2 }], levels: -1, profile: 'bad' as never, ridge: 'z' as never, pitchDeg: 0, material: 'inconnu' }],
    }, {
      id: 'corps', style: 'maison', storeys: [], facades: [], masses: [],
    }];
    const w = validateScene([s]).filter((x) => x.scope === 'architecture' && x.level === 'error');
    expect(w.length).toBeGreaterThanOrEqual(10);
  });

  it.each([
    ['offset négatif', { offset: -0.1 }],
    ['offset supérieur à 1', { offset: 1.1 }],
    ['offset non fini', { offset: Number.NaN }],
    ['largeur nulle', { width: 0 }],
    ['largeur négative', { width: -1 }],
    ['largeur non finie', { width: Number.POSITIVE_INFINITY }],
  ])('architecture : refuse une feature avec %s', (_label, patch) => {
    const s = base();
    s.architecture = [{
      id: 'corps', style: 'maison', storeys: [], masses: [],
      facades: [{
        id: 'facade', z: 0, edges: [{ x: 2, y: 2, side: 'N' }], appearance: 'auberge-relais-imperiale',
        features: [{ id: 'feature', kind: 'gable', edge: { x: 2, y: 2, side: 'N' }, ...patch }],
      }],
    }];
    expect(validateScene([s]).some((warning) =>
      warning.scope === 'architecture' && warning.refId === 'feature' && /offset|largeur/.test(warning.message))).toBe(true);
  });

  it('architecture : expose une cible d’éditeur stable pour partie, feature et masse invalides', () => {
    const s = base();
    s.architecture = [{
      id: 'corps',
      style: 'maison',
      storeys: [{
        id: 'z0',
        z: 0,
        parts: [{ id: 'partie', foot: { x: 7, y: 7, w: 2, h: 2 } }],
        roomZoneIds: [],
      }],
      facades: [{
        id: 'facade',
        z: 0,
        edges: [{ x: 2, y: 2, side: 'N' }],
        appearance: 'auberge-relais-imperiale',
        features: [{ id: 'feature', kind: 'gable', edge: { x: 2, y: 2, side: 'N' }, width: 0 }],
      }],
      masses: [{
        id: 'toiture',
        z: 0,
        footprint: [{ x: 7, y: 7, w: 2, h: 2 }],
        levels: 1,
        profile: 'gable',
        ridge: 'x',
        pitchDeg: 42,
        material: 'tuile',
      }],
    }];

    const warnings = validateScene([s]);
    expect(warnings.find((warning) => warning.refId === 'partie')?.architectureRef).toEqual({
      type: 'architecturePart',
      bodyId: 'corps',
      storeyId: 'z0',
      id: 'partie',
    });
    expect(warnings.find((warning) => warning.refId === 'feature')?.architectureRef).toEqual({
      type: 'facadeSection',
      bodyId: 'corps',
      id: 'facade',
    });
    expect(warnings.find((warning) => warning.refId === 'toiture')?.architectureRef).toEqual({
      type: 'roofSection',
      bodyId: 'corps',
      id: 'toiture',
    });
  });

  it('architecture : rend navigables doublons de chaque famille et étage invalide', () => {
    const s = base();
    s.architecture = [{
      id: 'corps',
      style: 'maison',
      storeys: [
        {
          id: 'etage',
          z: 3,
          parts: [
            { id: 'partie', foot: { x: 0, y: 0, w: 1, h: 1 } },
            { id: 'partie', foot: { x: 1, y: 0, w: 1, h: 1 } },
          ],
          roomZoneIds: [],
        },
        { id: 'etage', z: 0, parts: [], roomZoneIds: [] },
      ],
      facades: [{
        id: 'facade',
        z: 0,
        edges: [{ x: 0, y: 0, side: 'N' }],
        appearance: 'mur',
        features: [
          { id: 'feature', kind: 'gable', edge: { x: 0, y: 0, side: 'N' } },
          { id: 'feature', kind: 'gable', edge: { x: 0, y: 0, side: 'N' } },
        ],
      }, {
        id: 'facade',
        z: 0,
        edges: [{ x: 1, y: 0, side: 'N' }],
        appearance: 'mur',
        features: [],
      }],
      masses: [{
        id: 'toiture',
        z: 0,
        footprint: [{ x: 0, y: 0, w: 1, h: 1 }],
        levels: 1,
        profile: 'gable',
        ridge: 'x',
        pitchDeg: 42,
        material: 'tuile',
      }, {
        id: 'toiture',
        z: 0,
        footprint: [{ x: 1, y: 0, w: 1, h: 1 }],
        levels: 1,
        profile: 'gable',
        ridge: 'x',
        pitchDeg: 42,
        material: 'tuile',
      }],
    }, {
      id: 'corps',
      style: 'maison',
      storeys: [],
      facades: [],
      masses: [],
    }];

    const warnings = validateScene([s]).filter((warning) => warning.scope === 'architecture');
    expect(warnings.every((warning) => warning.architectureRef !== undefined)).toBe(true);
    expect(warnings.find((warning) => warning.refId === 'corps')?.architectureRef).toEqual({
      type: 'architectureBody',
      id: 'corps',
    });
    expect(warnings.find((warning) => warning.refId === 'etage' && warning.message.includes('dupliqué'))?.architectureRef).toEqual({
      type: 'architectureStorey',
      bodyId: 'corps',
      id: 'etage',
    });
    expect(warnings.find((warning) => warning.refId === 'etage' && warning.message.includes('inexistant'))?.architectureRef).toEqual({
      type: 'architectureStorey',
      bodyId: 'corps',
      id: 'etage',
    });
    expect(warnings.find((warning) => warning.refId === 'partie' && warning.message.includes('dupliqué'))?.architectureRef).toEqual({
      type: 'architecturePart',
      bodyId: 'corps',
      storeyId: 'etage',
      id: 'partie',
    });
    expect(warnings.find((warning) => warning.refId === 'facade' && warning.message.includes('dupliqué'))?.architectureRef).toEqual({
      type: 'facadeSection',
      bodyId: 'corps',
      id: 'facade',
    });
    expect(warnings.find((warning) => warning.refId === 'feature' && warning.message.includes('dupliqué'))?.architectureRef).toEqual({
      type: 'facadeSection',
      bodyId: 'corps',
      id: 'facade',
    });
    expect(warnings.find((warning) => warning.refId === 'toiture' && warning.message.includes('dupliqué'))?.architectureRef).toEqual({
      type: 'roofSection',
      bodyId: 'corps',
      id: 'toiture',
    });
  });

  it('effet imbriqué dans la branche RÉUSSITE d’un nœud Test est validé', () => {
    const s = base();
    s.triggers.push({
      id: 't-2',
      rect: { x: 0, y: 0, w: 1, h: 1 },
      flow: testFlow({ skill: 'perception' }, flowFromEffects([{ type: 'startDialogue', dialogue: 'absent' }]), EMPTY_FLOW),
    });
    expect(msgs(validateScene([s])).some((m) => /dialogue inexistant/.test(m))).toBe(true);
  });

  it('zoneBlast : aucun effet mécanique → erreur ; centre hors carte → avertissement', () => {
    const s = base(); // 5×5
    s.triggers.push({ id: 't-zb', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'zoneBlast', center: { x: 9, y: 9 }, radius: 2, ops: [] }]) });
    const m = msgs(validateScene([s]));
    expect(m.some((x) => /aucun effet mécanique/.test(x))).toBe(true);
    expect(m.some((x) => /centre.*hors de la carte/.test(x))).toBe(true);
  });

  it('zoneBlast bien formé = 0 avertissement', () => {
    const s = base();
    s.triggers.push({ id: 't-zb2', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'zoneBlast', center: { x: 2, y: 2 }, radius: 2, ops: [{ op: 'wounds', amount: { dice: { n: 1, sides: 10, plus: 15 } } }] }]) });
    expect(validateScene([s]).filter((w) => /zone/i.test(w.message))).toEqual([]);
  });

  it('musique de scène inconnue au registre → avertissement ; piste réelle / silence / auto = OK', () => {
    const s = base();
    s.music = { ambient: 'piste-fantome', combat: 'musique-combat' };
    expect(msgs(validateScene([s])).some((m) => /Musique .*piste-fantome/.test(m))).toBe(true);
    s.music = { ambient: null, combat: 'musique-combat' }; // silence + piste réelle
    expect(validateScene([s])).toEqual([]);
    s.music = undefined; // automatique
    expect(validateScene([s])).toEqual([]);
  });
});

describe('validateScene — Flow corrompu (crash n°2 éditeur, document ANCIEN)', () => {
  it("trigger avec un flow ENTIÈREMENT ABSENT (document pré-migration Flow) → warning « corrompu », ne throw pas", () => {
    const s = base();
    // `flow` est requis par le type `Trigger` mais un document ANCIEN peut ne pas le porter — reproduit
    // sans passer par normalizeScene (le crash rapporté se produit malgré ce garde-fou).
    s.triggers.push({ id: 't-corrompu', rect: { x: 0, y: 0, w: 1, h: 1 } } as unknown as (typeof s.triggers)[number]);
    let w: Warning[] = [];
    expect(() => { w = validateScene([s]); }).not.toThrow();
    expect(w.some((x) => x.scope === 'trigger' && x.refId === 't-corrompu' && /corrompu/.test(x.message))).toBe(true);
  });

  it('un flow avec un nœud `null` (JSON sérialise `undefined` en `null`) → warning « corrompu », ne throw pas', () => {
    const s = base();
    const corrupted = { kind: 'seq', steps: [null, { kind: 'do', effect: { type: 'ops', ops: [] } }] };
    s.triggers.push({ id: 't-null', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: corrupted as unknown as (typeof s.triggers)[number]['flow'] });
    let w: Warning[] = [];
    expect(() => { w = validateScene([s]); }).not.toThrow();
    expect(w.some((x) => x.scope === 'trigger' && x.refId === 't-null' && /corrompu/.test(x.message))).toBe(true);
  });

  it('un flow avec une réf PENDANTE (nœud `test` sans branche `success`) → warning « corrompu », les AUTRES flows restent validés', () => {
    const s = base();
    const dangling = { kind: 'test', test: { skill: 'perception' }, fail: EMPTY_FLOW } as unknown as ReturnType<typeof testFlow>;
    s.triggers.push({ id: 't-pendant', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: dangling });
    s.triggers.push({ id: 't-sain', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'transition', scene: 'nope' }]) });
    let w: Warning[] = [];
    expect(() => { w = validateScene([s]); }).not.toThrow();
    expect(w.some((x) => x.scope === 'trigger' && x.refId === 't-pendant' && /corrompu/.test(x.message))).toBe(true);
    expect(w.some((x) => x.scope === 'trigger' && x.refId === 't-sain' && /scène inexistante/.test(x.message))).toBe(true);
  });
});

describe('validateScene — POI de plan (#345 phase 5)', () => {
  // `services` : le lieu doit RÉSOUDRE (`placeServices`) la cible d'un POI de service (#360 — un POI
  // peut aussi cibler le port/marché AUTOMATIQUES du lieu, `'port'`/`'marche'`, pas que le catalogue).
  const place = (poi: MapPlace['poi'], services?: MapPlace['services']): MapPlace => ({ id: 'lieu', label: 'Lieu', pos: { x: 0, y: 0 }, scene: 'A', poi, services });
  const wm = (poi: MapPlace['poi'], services?: MapPlace['services']): WorldMap => ({ id: 'w', nom: 'Carte', places: [place(poi, services)], routes: [] });

  it('POI bien formé ciblant une scène du projet → aucune erreur', () => {
    const w = validateScene([base()], wm([{ id: 'poi-1', label: 'Entrée', pos: { x: 10, y: 10 }, sceneId: 'A' }]));
    expect(w.filter((x) => x.level === 'error')).toEqual([]);
  });

  it('POI bien formé ciblant un service DÉCLARÉ par le lieu → aucune erreur', () => {
    const w = validateScene([base()], wm(
      [{ id: 'poi-1', label: 'Auberge', pos: { x: 10, y: 10 }, serviceKind: 'auberge' }],
      [{ kind: 'auberge' }],
    ));
    expect(w.filter((x) => x.level === 'error')).toEqual([]);
  });

  it('POI ciblant le PORT automatique du lieu (`serviceKind: "port"`, sans catalogue) → aucune erreur', () => {
    const w = validateScene([base()], {
      id: 'w', nom: 'Carte',
      places: [{
        id: 'lieu', label: 'Lieu', pos: { x: 0, y: 0 }, scene: 'A',
        port: { ref: undefined, taille: 1, richesse: 1, production: [] } as unknown as MapPlace['port'],
        poi: [{ id: 'poi-1', label: 'Le port', pos: { x: 10, y: 10 }, serviceKind: 'port' }],
      }],
      routes: [],
    });
    expect(w.filter((x) => x.level === 'error')).toEqual([]);
  });

  it('id de POI dupliqué (même lieu) → erreur', () => {
    const w = validateScene([base()], wm([
      { id: 'poi-1', label: 'A', pos: { x: 1, y: 1 }, sceneId: 'A' },
      { id: 'poi-1', label: 'B', pos: { x: 2, y: 2 }, serviceKind: 'auberge' },
    ]));
    expect(msgs(w).some((m) => /id dupliqué/.test(m))).toBe(true);
  });

  it('ni scène ni service (cible absente) → erreur EXCLUSIVE', () => {
    const w = validateScene([base()], wm([{ id: 'poi-1', label: 'Rien', pos: { x: 1, y: 1 } }]));
    expect(msgs(w).some((m) => /cible EXCLUSIVE/.test(m))).toBe(true);
  });

  it('scène ET service à la fois → erreur EXCLUSIVE', () => {
    const w = validateScene([base()], wm([{ id: 'poi-1', label: 'Les deux', pos: { x: 1, y: 1 }, sceneId: 'A', serviceKind: 'auberge' }]));
    expect(msgs(w).some((m) => /cible EXCLUSIVE/.test(m))).toBe(true);
  });

  it('sceneId inexistant → erreur', () => {
    const w = validateScene([base()], wm([{ id: 'poi-1', label: 'Fantôme', pos: { x: 1, y: 1 }, sceneId: 'nope' }]));
    expect(msgs(w).some((m) => /scène inexistante/.test(m))).toBe(true);
  });

  it('serviceKind inconnu du catalogue → erreur', () => {
    const w = validateScene([base()], wm([{ id: 'poi-1', label: 'Faux', pos: { x: 1, y: 1 }, serviceKind: 'nawak' }]));
    expect(msgs(w).some((m) => /service inconnu/.test(m))).toBe(true);
  });
});
