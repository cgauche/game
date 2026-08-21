import { describe, expect, it } from 'vitest';
import { bakeWorldGeometry, roomZonesByElKey, worldBakeDeps, type BakedWorld } from './sceneMeshes';
import { memoByRefDeps } from '../../../state/sceneMemo';
import { sceneMetresPerTile, type Scene } from '../../../state/scene';
import { scenario } from '../../../scenes/test-scenarios/zones-pieces';

/**
 * GARDE DE SOUS-DÉCLARATION (#1176, P3-3). La cuisson du monde est RETENUE sur un read-set déclaré
 * (`worldBakeDeps`) au lieu de la référence de scène : un hôte qui reforge la scène à chaque geste
 * (l'éditeur : une référence par `pointermove`) ne repaie plus 100 à 634 ms par tick.
 *
 * Le prix de cette rétention est un DANGER SILENCIEUX : un champ oublié dans la liste = un monde
 * PÉRIMÉ à l'écran, que rien ne signale. Cette garde le rend impossible à introduire — elle passe sur
 * CHAQUE champ de `Scene` (le type l'y force : `Record<keyof Scene, …>` ne compile pas si un champ
 * apparaît) et vérifie les deux sens :
 *  - champ DANS le read-set  ⇒ la cuisson retenue change d'identité (le monde se recuit) ;
 *  - champ HORS du read-set  ⇒ elle ne change pas, ET une cuisson FRAÎCHE de la scène mutée est
 *    IDENTIQUE (sommets, groupes de surface, plages de faces) — la preuve que l'omission n'est pas
 *    une sous-déclaration, mais un champ qui ne cuit rien.
 *
 * Fixture `zones-pieces` : petite (10×9) mais complète pour ce qui est en jeu — murs d'arête et
 * portes, un corps d'architecture avec sa masse de toit à deux pans, et quatre zones d'effet
 * INTÉRIEURES (le cas risqué : `buildRoofs` LIT `scene.effectZones`).
 */
const base = scenario.scene;
const mpt = sceneMetresPerTile(base);

/**
 * Empreinte STRUCTURELLE d'une cuisson — tout ce que le rendu en tire, hors identités d'objet.
 * ANGLE MORT DÉCLARÉ : elle ne compare PAS le contenu des `spans[].el` (les éléments de provenance
 * retenus). Un champ d'`el` dérivé d'une donnée hors read-set y périmerait donc sans que cette
 * comparaison bronche — c'est exactement le cas `roomZoneIds` (dérivé de `scene.effectZones`, lu par
 * la loi de dégagement). Il n'est pas gardé ICI, il est rendu IMPOSSIBLE à la source : `elCuit` le
 * retire du monde cuit, et le test « aucune zone de pièce ne survit à la cuisson » plus bas le
 * vérifie. Toute nouvelle donnée d'`el` hors read-set demande le même traitement.
 */
function empreinte(b: BakedWorld) {
  const attr = (nom: string) => Array.from(b.geometry.getAttribute(nom).array as Float32Array);
  return {
    positions: attr('position'),
    uv: attr('uv'),
    groupes: b.geometry.userData.surfaceGroups.map((g) => `${g.key}|${g.kind ?? ''}|${g.variant ?? ''}|${g.color ?? ''}`),
    dessins: b.geometry.groups.map((g) => `${g.start},${g.count},${g.materialIndex}`),
    spans: b.spans.map((s) => `${s.cell.x},${s.cell.y},${s.cell.z}|${s.group}|${s.start}|${s.count}|${s.color}|${s.varFactor}`),
  };
}

const cloneLayers = (s: Scene): Scene['layers'] => s.layers.map((l) => ({ ...l, tiles: [...l.tiles] }));

/** Une mutation RÉELLE par champ (jamais un clone à valeur égale sur un scalaire : il ne prouverait
 *  rien). Le type impose l'exhaustivité — un champ neuf de `Scene` casse la compilation ici. */
const MUTATIONS: Record<keyof Scene, (s: Scene) => Scene> = {
  id: (s) => ({ ...s, id: `${s.id}-bis` }),
  nom: (s) => ({ ...s, nom: 'Autre nom' }),
  description: (s) => ({ ...s, description: 'Autre description' }),
  dimensions: (s) => ({ ...s, dimensions: { ...s.dimensions } }),
  metresPerTile: (s) => ({ ...s, metresPerTile: sceneMetresPerTile(s) + 1 }),
  ambiance: (s) => ({ ...s, ambiance: s.ambiance === 'interieur' ? 'exterieur' : 'interieur' }),
  environment: (s) => ({ ...s, environment: 'urbain' }),
  weather: (s) => ({ ...s, weather: 'tempete' }),
  ambientLight: (s) => ({ ...s, ambientLight: 'nuit' }),
  northDeg: (s) => ({ ...s, northDeg: (s.northDeg ?? 0) + 90 }),
  rest: (s) => ({ ...s, rest: { camp: true } }),
  restZones: (s) => ({ ...s, restZones: [{ rect: { x: 0, y: 0, w: 2, h: 2 }, places: { camp: true } }] }),
  effectZones: (s) => ({
    ...s,
    effectZones: [...(s.effectZones ?? []), { id: 'zone-neuve', label: 'Zone neuve', presentation: 'interior', area: { kind: 'rect', x: 2, y: 2, w: 2, h: 2 } }],
  }),
  music: (s) => ({ ...s, music: { ambient: null } }),
  layers: (s) => ({ ...s, layers: cloneLayers(s) }),
  walls: (s) => ({ ...s, walls: [...(s.walls ?? [])] }),
  entities: (s) => ({ ...s, entities: [...s.entities] }),
  seatAssignments: (s) => ({ ...s, seatAssignments: { 'table-1': { nord: { kind: 'entity', entityId: 'attable' } } } }),
  architecture: (s) => ({ ...s, architecture: [...(s.architecture ?? [])] }),
  dialogues: (s) => ({ ...s, dialogues: [...s.dialogues] }),
  triggers: (s) => ({ ...s, triggers: [...s.triggers] }),
  encounters: (s) => ({ ...s, encounters: [...s.encounters] }),
  stations: (s) => ({ ...s, stations: [{ sceneId: 'ailleurs', pos: { x: 1, y: 1 } }] }),
  flags: (s) => ({ ...s, flags: { ...s.flags, neuf: true } }),
  entryPoints: (s) => ({ ...s, entryPoints: { ...(s.entryPoints ?? {}), porte: { x: 1, y: 1 } } }),
  startMessage: (s) => ({ ...s, startMessage: 'Autre message' }),
};

/** Le read-set DÉCLARÉ, champ par champ — la liste que la garde confronte à la réalité. */
const DANS_LE_READ_SET = new Set<keyof Scene>(['dimensions', 'metresPerTile', 'layers', 'walls', 'architecture']);

const memesDeps = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((d, i) => d === b[i]);

describe('Cuisson du monde — rétention par CONTENU, read-set gardé champ par champ (#1176, P3-3)', () => {
  for (const champ of Object.keys(MUTATIONS) as (keyof Scene)[]) {
    const attendu = DANS_LE_READ_SET.has(champ);
    it(`\`${champ}\` : ${attendu ? 'recuit le monde' : 'ne le recuit pas — et ne le PÉRIME pas'}`, () => {
      const muté = MUTATIONS[champ](base);
      // La rétention TELLE QUE L'ÉCRAN la monte : le patron canonique, sur les deps déclarées.
      const memo = memoByRefDeps<object, BakedWorld>();
      const clé = {};
      const avant = memo(clé, worldBakeDeps(base, mpt), () => bakeWorldGeometry(base, mpt));
      const après = memo(clé, worldBakeDeps(muté, mpt), () => bakeWorldGeometry(muté, mpt));
      expect(memesDeps(worldBakeDeps(base, mpt), worldBakeDeps(muté, mpt))).toBe(!attendu);
      expect(après !== avant).toBe(attendu);
      // Hors read-set : la cuisson FRAÎCHE de la scène mutée doit être identique — sans quoi la
      // rétention laisserait un monde périmé à l'écran, et personne ne le verrait.
      if (!attendu) expect(empreinte(bakeWorldGeometry(muté, mpt))).toEqual(empreinte(avant));
    });
  }

  /** Contrôle : l'empreinte comparée ci-dessus DISTINGUE réellement deux mondes. Sans lui, un
   *  comparateur aveugle rendrait toutes les assertions « identiques » gratuites. */
  it('l’empreinte comparée MORD : une seule case de terrain changée la fait diverger', () => {
    const layers = cloneLayers(base);
    layers[0].tiles[0] = layers[0].tiles[0] === 'eau' ? 'herbe' : 'eau';
    expect(empreinte(bakeWorldGeometry({ ...base, layers }, mpt))).not.toEqual(empreinte(bakeWorldGeometry(base, mpt)));
  });

  /** L'ÉCHELLE est le sixième terme du read-set : elle n'est pas un champ de `Scene`, mais elle cuit. */
  it('l’ÉCHELLE (`mpt`) recuit le monde, elle aussi', () => {
    expect(memesDeps(worldBakeDeps(base, mpt), worldBakeDeps(base, mpt * 2))).toBe(false);
    expect(empreinte(bakeWorldGeometry(base, mpt * 2))).not.toEqual(empreinte(bakeWorldGeometry(base, mpt)));
  });
});

/**
 * LE TROU QUE LA RÉTENTION AURAIT OUVERT (#1176, P3-3) : `applyCutawayMask` interroge la loi de
 * dégagement sur l'élément CUIT (`keepEl(span.el)`), et cette loi lit `roomZoneIds` — pour les nappes
 * de toit ET pour les façades (`frontFacadeCutaway`). Ce champ descend de `scene.effectZones`, HORS
 * read-set : retenu, il aurait figé le cutaway par pièce sur l'état de la scène au moment de la
 * cuisson. Il ne survit donc plus au bake, et la vérité vive se résout par la clé de l'élément.
 */
describe('Zones de pièce — hors du monde CUIT, résolues sur la scène VIVE (#1176, P3-3)', () => {
  it('aucune zone de pièce ne survit à la cuisson (toits ET façades)', () => {
    const cuit = bakeWorldGeometry(base, mpt);
    const porteurs = cuit.spans.filter((s) => s.el.kind === 'roof' || s.el.kind === 'wall');
    expect(porteurs.length).toBeGreaterThan(0); // la fixture porte bien des toits et des murs
    expect(porteurs.filter((s) => 'roomZoneIds' in s.el)).toEqual([]);
  });

  it('…alors que les éléments VIVANTS du builder en portent (c’est bien une donnée réelle)', () => {
    const vives = roomZonesByElKey(base);
    expect([...new Set([...vives.values()].flat())]).toEqual(expect.arrayContaining(['cave', 'chambre']));
  });

  it('la table vive SUIT `effectZones` — l’hôte voit la zone neuve que la cuisson, elle, ignore', () => {
    const muté = MUTATIONS.effectZones(base);
    const avant = [...new Set([...roomZonesByElKey(base).values()].flat())];
    const après = [...new Set([...roomZonesByElKey(muté).values()].flat())];
    expect(après).toContain('zone-neuve');
    expect(avant).not.toContain('zone-neuve');
    // …et la cuisson, elle, n'a pas bougé d'un sommet (c'est tout l'intérêt de l'exclusion).
    expect(empreinte(bakeWorldGeometry(muté, mpt))).toEqual(empreinte(bakeWorldGeometry(base, mpt)));
  });
});
