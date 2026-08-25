import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { props, findPropById } from './index';
import { normalizeScene, emptyScene, type Scene, type SceneEntity } from '../state/scene';
import { entityBlockedAt } from '../state/sceneRules';
import { parseProject } from '../state/worldMap';
import { scenarioEntities } from '../scenes/opera/furnished';

/**
 * Empreintes de TYPE portées par le catalogue de décor (`props.json` `foot`), figées à la valeur
 * qu'elles avaient dans les defs de vignette avant leur migration — plus les trois variantes longues
 * de mobilier d'Opéra créées par cette même migration.
 */
const LEGACY_PROP_FOOT_TABLE: [string, number, number][] = [
  ['abreuvoir', 2, 1],
  ['balustrade-bois', 3, 1],
  ['balustrade-loge', 3, 1],
  ['barque', 2, 1],
  ['bureau-2x1', 2, 1],
  ['canon-de-pont', 1, 1],
  ['charrette', 2, 1],
  ['cheval-mort', 2, 1],
  ['cuve-brasserie', 1, 1],
  ['ecoutille', 1, 1],
  ['enclume', 1, 1],
  ['epave-carrosse', 2, 2],
  ['escalier-bois', 1, 1],
  ['escalier-loge', 1, 1],
  ['etabli-2x1', 2, 1],
  ['foyer-de-forge', 1, 1],
  ['idole-chaos', 2, 2],
  ['lit', 2, 1],
  ['passerelle-d-embarquement', 2, 1],
  ['rangee-sieges', 3, 1],
  ['rideau-scene', 3, 1],
  ['rouleau-de-cordage', 1, 1],
  ['stalle-ecurie', 1, 1],
  ['table-2x1', 2, 1],
  ['tente', 2, 2],
  ['tribune', 3, 1],
];

const propFootTable = (): [string, number, number][] =>
  props.filter((p) => p.foot).map((p): [string, number, number] => [p.id, p.foot!.w, p.foot!.h])
    .sort((a, b) => a[0].localeCompare(b[0], 'fr'));

const areneDoc = parseProject(JSON.parse(readFileSync(join(__dirname, '../scenes/arene/arene-projet.json'), 'utf8')));
const OPERA = 'opera/furnished';
const entitiesOf = (scene: string): SceneEntity[] =>
  scene === OPERA ? scenarioEntities : areneDoc.scenes.find((s) => s.id === scene)!.entities;

/** Les vingt-quatre instances qui portaient une empreinte D'INSTANCE avant la migration. */
const LEGACY_AUTHORED_FOOT_SITES: [string, string][] = [
  ['arene-hub', 'p8'],
  ['arene-zone5', 'p9'],
  ['arene-zone6', 'p16'],
  ['arene-zone6', 'p17'],
  ['arene-zone11', 'p0'],
  ['arene-exp-foret', 'p13'],
  ['arene-exp-foret', 'p16'],
  ['arene-exp-marais', 'p12'],
  ['arene-exp-village', 'p1'],
  ['arene-exp-village', 'p2'],
  ['arene-route-embuscade', 'p0'],
  [OPERA, 'rideau-0'],
  [OPERA, 'rideau-1'],
  [OPERA, 'rideau-2'],
  [OPERA, 'rideau-3'],
  [OPERA, 'rideau-4'],
  [OPERA, 'rideau-5'],
  [OPERA, 'sv-table'],
  [OPERA, 'reg15-bureau'],
  [OPERA, 'b22-bureau'],
  [OPERA, 'b23-bureau'],
  [OPERA, 'c25-table-1'],
  [OPERA, 'c25-table-2'],
  [OPERA, 'c26-etabli'],
];

/** Empreinte EFFECTIVE d'une instance authorée : sa ref courante et l'empreinte que lui donne le catalogue. */
function authoredPropFoot(scene: string, id: string): [string, number, number] {
  const ent = entitiesOf(scene).find((e) => e.id === id)!;
  const foot = findPropById(ent.ref ?? '')?.foot ?? { w: 1, h: 1 };
  return [ent.ref!, foot.w, foot.h];
}

const authoredPropFootTable = (): [string, string, string, number, number][] =>
  LEGACY_AUTHORED_FOOT_SITES.map(([scene, id]) => [scene, id, ...authoredPropFoot(scene, id)] as [string, string, string, number, number]);

const sceneWithEntity = (ent: SceneEntity): Scene => ({ ...emptyScene(8, 8), entities: [ent] });

describe('migration de l’empreinte : du legacy d’instance au catalogue de type', () => {
  it('migre sans dérive les empreintes de type et purge le legacy d’instance', () => {
    expect(propFootTable()).toEqual(LEGACY_PROP_FOOT_TABLE);
    const legacy = normalizeScene(sceneWithEntity({ id: 'c', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'charrette', foot: { w: 9, h: 9 } } as never));
    expect(legacy.entities[0]).not.toHaveProperty('foot');
    expect(entityBlockedAt(legacy, legacy.entities[0].pos.x + 1, legacy.entities[0].pos.y, 0)).toBe(true);
    expect(entityBlockedAt(legacy, legacy.entities[0].pos.x + 2, legacy.entities[0].pos.y, 0)).toBe(false);
  });

  it('conserve l’empreinte effective de chaque instance authorée', () => {
    expect(authoredPropFootTable()).toEqual([
      ['arene-hub', 'p8', 'tente', 2, 2],
      ['arene-zone5', 'p9', 'abreuvoir', 2, 1],
      ['arene-zone6', 'p16', 'cheval-mort', 2, 1],
      ['arene-zone6', 'p17', 'barque', 2, 1],
      ['arene-zone11', 'p0', 'idole-chaos', 2, 2],
      ['arene-exp-foret', 'p13', 'tente', 2, 2],
      ['arene-exp-foret', 'p16', 'charrette', 2, 1],
      ['arene-exp-marais', 'p12', 'barque', 2, 1],
      ['arene-exp-village', 'p1', 'abreuvoir', 2, 1],
      ['arene-exp-village', 'p2', 'charrette', 2, 1],
      ['arene-route-embuscade', 'p0', 'epave-carrosse', 2, 2],
      [OPERA, 'rideau-0', 'rideau-scene', 3, 1],
      [OPERA, 'rideau-1', 'rideau-scene', 3, 1],
      [OPERA, 'rideau-2', 'rideau-scene', 3, 1],
      [OPERA, 'rideau-3', 'rideau-scene', 3, 1],
      [OPERA, 'rideau-4', 'rideau-scene', 3, 1],
      [OPERA, 'rideau-5', 'rideau-scene', 3, 1],
      [OPERA, 'sv-table', 'table-2x1', 2, 1],
      [OPERA, 'reg15-bureau', 'bureau-2x1', 2, 1],
      [OPERA, 'b22-bureau', 'bureau-2x1', 2, 1],
      [OPERA, 'b23-bureau', 'bureau-2x1', 2, 1],
      [OPERA, 'c25-table-1', 'table-2x1', 2, 1],
      [OPERA, 'c25-table-2', 'table-2x1', 2, 1],
      [OPERA, 'c26-etabli', 'etabli-2x1', 2, 1],
    ]);
    expect(authoredPropFoot(OPERA, 'salon-d-table')).toEqual(['table', 1, 1]);
    expect(authoredPropFoot(OPERA, 'salon-s-table')).toEqual(['table', 1, 1]);
  });

  it('plus AUCUNE instance authorée ne porte d’empreinte propre', () => {
    const porteuses = [...areneDoc.scenes.flatMap((s) => s.entities.map((e) => `${s.id}/${e.id}`).filter((_, i) => 'foot' in s.entities[i])),
      ...scenarioEntities.filter((e) => 'foot' in e).map((e) => `${OPERA}/${e.id}`)];
    expect(porteuses).toEqual([]);
  });
});
