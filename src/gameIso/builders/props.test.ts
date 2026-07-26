import { describe, it, expect } from 'vitest';
import { emptyScene, type SceneEntity, type WallSeg } from '../../state/scene';
import { buildProps } from './props';

/** BUILDER de props : clés stables, overlays de terrain, géométrie d'empreinte, vérités de scène. */
describe('buildProps — éléments prop du pivot', () => {
  const scene = () => {
    const s = emptyScene(6, 6);
    s.layers[0].tiles[1 * 6 + 2] = 'mur'; // (2,1) : BLOC PLEIN — géré par le relief (solidHeightM), PAS un prop
    s.layers[0].tiles[3 * 6 + 4] = 'bois'; // (4,3) : overlay à DÉCOR (overlayProp → 'arbre')
    s.entities = [
      { id: 'p1', kind: 'prop', pos: { x: 1, y: 1 } }, // ref absente → normalisée 'tonneau'
      { id: 'p2', kind: 'prop', pos: { x: 3, y: 2 }, ref: 'tente', foot: { w: 2, h: 2 }, facing: 'SE', anim: 'flottement', interact: { flow: { kind: 'seq', steps: [] } } },
      { id: 'npc', kind: 'personnage', pos: { x: 5, y: 5 } }, // pas un prop → ignoré
    ] as SceneEntity[];
    return s;
  };

  it('émet un billboard de DÉCOR pour un terrain à overlayProp (bois→arbre) ; le mur PLEIN est un bloc de relief, pas un prop', () => {
    const els = buildProps(scene());
    const terrain = els.filter((e) => e.source === 'terrain');
    expect(terrain.map((e) => e.key)).toEqual(['ov:4,3,0']); // seul `bois` a un overlayProp
    expect(terrain.map((e) => e.ref)).toEqual(['arbre']);  // rendu comme un prop d'entité (billboard partagé)
    expect(terrain[0].foot).toEqual({ offX: 0, offY: 0, scale: 1 });
    expect(terrain[0].interact).toBe(false);
    for (const t of terrain) expect(t.states.visible).toBe(true); // `visible` absent (éditeur/QC) → tout visible
    const props = els.filter((e) => e.source === 'entity');
    expect(props.map((e) => e.key)).toEqual(['prop:p1', 'prop:p2']);
  });

  it('un overlay de terrain suit le brouillard comme un prop (en vue → au-dessus du voile, cull LdV en POV sinon)', () => {
    const seen = buildProps(scene(), new Set(['4,3,0'])).find((e) => e.key === 'ov:4,3,0')!;
    expect(seen.states.visible).toBe(true); // sa tuile est en vue
    const hidden = buildProps(scene(), new Set(['0,0,0'])).find((e) => e.key === 'ov:4,3,0')!;
    expect(hidden.states.visible).toBe(false); // mémorisé → sous le voile / culé en POV
  });

  it('normalise la ref (défaut tonneau) et porte facing/empreinte/fx/interact', () => {
    const [p1, p2] = buildProps(scene()).filter((e) => e.source === 'entity');
    expect(p1.ref).toBe('tonneau');
    expect(p1.foot).toEqual({ offX: 0, offY: 0, scale: 1 });
    expect(p1.interact).toBe(false);
    expect(p2.ref).toBe('tente');
    expect(p2.facing).toBe('SE');
    expect(p2.foot).toEqual({ offX: 0.5, offY: 0.5, scale: 2 }); // décalage vers le centre + côté max
    expect(p2.span).toEqual({ w: 2, h: 2 });
    expect(p2.fx).toBe('flottement');
    expect(p2.interact).toBe(true);
    expect(p2.entId).toBe('p2');
  });

  it('tague `visible` un prop en vue, mémorisé sinon', () => {
    const els = buildProps(scene(), new Set(['1,1,0']));
    const p1 = els.find((e) => e.key === 'prop:p1')!;
    const p2 = els.find((e) => e.key === 'prop:p2')!;
    expect(p1.states.visible).toBe(true);
    expect(p2.states.visible).toBe(false);
  });

  it('filtre les étages avec `view` (z > activeZ coupé, viewZ isole) et émet tout sans `view`', () => {
    const s = scene();
    s.layers.push({ z: 1, tiles: new Array(36).fill('vide') });
    (s.entities[1] as SceneEntity).z = 1; // p2 à l'étage
    expect(buildProps(s).filter((e) => e.source === 'entity')).toHaveLength(2); // POV/éditeur : tout
    const game = buildProps(s, undefined, { activeZ: 0, viewZ: null });
    expect(game.filter((e) => e.source === 'entity').map((e) => e.key)).toEqual(['prop:p1']); // au-dessus → coupé
    const iso = buildProps(s, undefined, { activeZ: 0, viewZ: 1 });
    expect(iso.filter((e) => e.source === 'entity').map((e) => e.key)).toEqual(['prop:p2']); // isolement debug
  });

  it('overlay de terrain à l’étage : “bois” sur z1 émet un `ov:x,y,1` à SA hauteur, cullé quand l’étage actif est 0', () => {
    const s = scene();
    s.layers.push({ z: 1, tiles: new Array(36).fill('vide') });
    s.layers[1].tiles[3 * 6 + 4] = 'bois'; // (4,3) à l'étage 1
    const allZ = buildProps(s).filter((e) => e.source === 'terrain');
    expect(allZ.map((e) => e.key)).toEqual(['ov:4,3,0', 'ov:4,3,1']); // sans `view` : toutes les couches
    const activeZ0 = buildProps(s, undefined, { activeZ: 0, viewZ: null }).filter((e) => e.source === 'terrain');
    expect(activeZ0.map((e) => e.key)).toEqual(['ov:4,3,0']); // étage 1 coupé (au-dessus de la zone active)
    const activeZ1 = buildProps(s, undefined, { activeZ: 1, viewZ: null }).filter((e) => e.source === 'terrain');
    const ov1 = activeZ1.find((e) => e.key === 'ov:4,3,1')!;
    expect(ov1.cell).toEqual({ x: 4, y: 3, z: 1 });
  });
});

/** ORNEMENTS d'identité par TYPE de bâtiment : dérivés de `buildingFeatures(body.style)`, posés en
 *  billboard sur/devant le bâtiment (ancres ridge/facade/front). 100 % donnée, aucun cas en dur. */
describe('buildProps — ornements de bâtiment (data-driven par ArchitectureBody.style)', () => {
  const withRoof = (style: string, foot: { x: number; y: number; w: number; h: number }, walls: WallSeg[] = []) => {
    const s = emptyScene(10, 10);
    s.architecture = [{
      id: `body-${style}`,
      style,
      storeys: [{ id: 'z0', z: 0, parts: [], roomZoneIds: [] }],
      facades: [],
      masses: [{ id: 'mass-0', z: 0, footprint: [foot], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 30, material: 'tuile' }],
    }];
    s.walls = walls;
    return s;
  };
  const orns = (s: ReturnType<typeof withRoof>, visible?: Set<string>) =>
    buildProps(s, visible).filter((e) => e.source === 'ornament');

  it("chapelle → clocheton au FAÎTE : partage l'empreinte/profondeur du toit, billboard centré, surélevé", () => {
    const [o] = orns(withRoof('chapelle', { x: 1, y: 1, w: 4, h: 5 }));
    expect(o.ref).toBe('clocheton');
    expect(o.key).toBe('orn:body-chapelle:mass-0:0');
    expect(o.cell).toEqual({ x: 1, y: 1, z: 0 }); // origine → même coin caméra-proche que le toit
    expect(o.span).toEqual({ w: 4, h: 5 }); // → propDepth == roofDepth (se peint PAR-DESSUS)
    expect(o.foot).toEqual({ offX: 1.5, offY: 2, scale: 1 }); // recentré sur l'empreinte
    expect(o.liftM!).toBeGreaterThan(2); // posé haut sur la pente (≈ égout + 0.6·flèche), pas au sol
    expect(o.facing).toBeUndefined();
    expect(o.interact).toBe(false);
    expect(o.states.visible).toBe(true); // `visible` absent (éditeur/QC) → visible
  });

  it("forge → cheminée au faîte, fx 'warm' (lueur de forge) porté par la feature", () => {
    const [o] = orns(withRoof('forge', { x: 0, y: 0, w: 3, h: 2 }));
    expect(o.ref).toBe('cheminee');
    expect(o.fx).toBe('warm');
    expect(o.liftM!).toBeGreaterThan(0);
  });

  it("taverne → enseigne en FAÇADE : JUSTE devant la porte (hors mur), surélevée, tournée vers l'extérieur", () => {
    // Porte côté S de la rangée basse (y=3) → arête canonisée (2,4,N) ; case sortante (2,4).
    const s = withRoof('taverne', { x: 1, y: 1, w: 3, h: 3 }, [{ x: 2, y: 4, side: 'N', door: true }]);
    const [o] = orns(s);
    expect(o.ref).toBe('enseigne');
    expect(o.cell).toEqual({ x: 2, y: 4, z: 0 }); // case JUSTE À L'EXTÉRIEUR (le mur plein masquerait l'intérieur)
    expect(o.facing).toBe('S'); // normale sortante
    expect(o.liftM!).toBeGreaterThan(0); // en haut du mur (potence saillante)
    expect(o.span).toBeUndefined(); // billboard 1×1 (pas la profondeur du toit)
    expect(o.foot).toEqual({ offX: 0, offY: 0.5, scale: 1 }); // saillie de ½ case vers l'extérieur (dégage la face du mur)
  });

  it("échoppe → étal au SOL DEVANT la porte (case sortante), non surélevé, tourné vers l'extérieur", () => {
    const s = withRoof('echoppe', { x: 1, y: 1, w: 2, h: 2 }, [{ x: 1, y: 3, side: 'N', door: true }]);
    const [o] = orns(s);
    expect(o.ref).toBe('etal-marche');
    expect(o.cell).toEqual({ x: 1, y: 3, z: 0 }); // case JUSTE À L'EXTÉRIEUR de la porte S
    expect(o.facing).toBe('S');
    expect(o.liftM ?? 0).toBe(0); // au sol
  });

  it('repli sans porte : façade SUD sous le centre bas de l’empreinte', () => {
    const s = withRoof('taverne', { x: 2, y: 2, w: 4, h: 2 }); // aucun mur → repli
    const [o] = orns(s);
    expect(o.cell).toEqual({ x: 4, y: 4, z: 0 }); // x = 2+floor(4/2)=4, y = case sortante sous le bas (y1+1=4)
    expect(o.facing).toBe('S');
  });

  it('maison/tour (sans features) : AUCUN ornement', () => {
    expect(orns(withRoof('maison', { x: 1, y: 1, w: 3, h: 3 }))).toHaveLength(0);
    expect(orns(withRoof('tour', { x: 1, y: 1, w: 2, h: 2 }))).toHaveLength(0);
  });

  it('visibilité IDENTIQUE au toit : visible dès qu’une case de l’empreinte élargie d’1 est en vue', () => {
    const foot = { x: 3, y: 3, w: 2, h: 2 };
    const seen = orns(withRoof('chapelle', foot), new Set(['2,3,0']))[0]; // (2,3) = bord élargi
    expect(seen.states.visible).toBe(true);
    const hidden = orns(withRoof('chapelle', foot), new Set(['0,0,0']))[0]; // loin de l'empreinte
    expect(hidden.states.visible).toBe(false);
  });

  it("cutaway : un allié sous l’empreinte MASQUE le faîteau (toit levé), pas la façade/l’étal au sol", () => {
    const foot = { x: 1, y: 1, w: 4, h: 4 }; // allié (2,2) DANS l'empreinte → roofHidden
    const ally = [{ x: 2, y: 2 }];
    // Faîte : sauté avec le toit en cutaway ; présent sans allié.
    expect(buildProps(withRoof('chapelle', foot), undefined, { allies: ally }).filter((e) => e.source === 'ornament')).toHaveLength(0);
    expect(orns(withRoof('chapelle', foot))).toHaveLength(1);
    // Façade (au sol devant la porte) : le toit levé ne l'occulte pas → reste.
    const tav = buildProps(withRoof('taverne', foot, [{ x: 2, y: 5, side: 'N', door: true }]), undefined, { allies: ally }).filter((e) => e.source === 'ornament');
    expect(tav.map((e) => e.ref)).toEqual(['enseigne']);
  });
});

describe('buildProps — features de façade authorées', () => {
  const hasFeatureId = <T extends { architectureFeatureId?: string }>(prop: T): prop is T & { architectureFeatureId: string } =>
    prop.architectureFeatureId !== undefined;
  const authoredFacade = () => {
    const s = emptyScene(10, 10);
    s.walls = [
      { x: 2, y: 5, side: 'N', door: true },
      { x: 3, y: 5, side: 'N' },
      { x: 4, y: 5, side: 'N' },
      { x: 5, y: 5, side: 'N' },
    ];
    s.architecture = [{
      id: 'corps-auberge',
      style: 'auberge',
      storeys: [],
      facades: [{
        id: 'facade-rue',
        z: 0,
        edges: s.walls.map(({ x, y, side }) => ({ x, y, side })),
        appearance: 'auberge-relais-imperiale',
        roomZoneIds: ['salle'],
        features: [
          { id: 'entree-centrale', kind: 'stone-entry', edge: { x: 2, y: 5, side: 'N' } },
          { id: 'pignon-central', kind: 'gable', edge: { x: 3, y: 5, side: 'N' }, offset: 0.5, width: 2 },
          { id: 'cheminee-ouest', kind: 'chimney', edge: { x: 4, y: 5, side: 'N' }, offset: 0.25 },
          { id: 'cheminee-est', kind: 'chimney', edge: { x: 5, y: 5, side: 'N' }, offset: 0.75 },
        ],
      }],
      masses: [],
    }];
    return s;
  };

  it('émet chaque feature exactement une fois, dans l’ordre d’auteur', () => {
    const out = buildProps(authoredFacade()).filter((prop) => prop.architectureFeatureId);
    expect(out.map((prop) => prop.architectureFeatureId)).toEqual([
      'corps-auberge:facade-rue:cheminee-ouest',
      'corps-auberge:facade-rue:cheminee-est',
    ]);
    expect(new Set(out.map((prop) => prop.key)).size).toBe(2);
    expect(out.every((prop) => prop.source === 'architecture')).toBe(true);
  });

  it('n’émet pas une feature dont l’arête ne porte aucun mur physique', () => {
    const scene = authoredFacade();
    scene.architecture![0].facades[0].features!.push({
      id: 'enseigne-sans-mur',
      kind: 'sign',
      edge: { x: 8, y: 8, side: 'N' },
    });
    expect(buildProps(scene).filter(hasFeatureId).some((prop) => prop.architectureFeatureId.endsWith(':enseigne-sans-mur'))).toBe(false);
  });

  it('respecte z, offset, visibilité et filtrage d’étage sans dupliquer les ancres', () => {
    const scene = authoredFacade();
    const visible = new Set(['4,5,0']);
    const all = buildProps(scene, visible);
    const chimney = all.filter(hasFeatureId).find((prop) => prop.architectureFeatureId.endsWith(':cheminee-ouest'))!;
    expect(chimney.cell).toEqual({ x: 4, y: 5, z: 0 });
    expect(chimney.foot.offX).not.toBe(0);
    expect(chimney.states.visible).toBe(true);
    expect(buildProps(scene, undefined, { activeZ: -1, viewZ: null })
      .some((prop) => prop.architectureFeatureId)).toBe(false);
  });

  it('qualifie les ids homonymes par corps et section', () => {
    const scene = authoredFacade();
    scene.walls!.push({ x: 6, y: 5, side: 'N' });
    scene.architecture![0].facades.push({
      id: 'facade-cour',
      z: 0,
      edges: [{ x: 6, y: 5, side: 'N' }],
      appearance: 'auberge-relais-imperiale',
      features: [{ id: 'cheminee-ouest', kind: 'chimney', edge: { x: 6, y: 5, side: 'N' } }],
    });
    expect(buildProps(scene).filter((prop) => prop.architectureFeatureId)
      .map((prop) => prop.architectureFeatureId)).toEqual([
      'corps-auberge:facade-rue:cheminee-ouest',
      'corps-auberge:facade-rue:cheminee-est',
      'corps-auberge:facade-cour:cheminee-ouest',
    ]);
  });
});
