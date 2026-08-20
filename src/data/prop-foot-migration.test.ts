import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { props, findPropById } from './index';
import { normalizeScene, emptyScene, type Scene, type SceneEntity } from '../state/scene';
import { entityBlockedAt } from '../state/sceneRules';
import { parseProject } from '../state/worldMap';
import { scenarioEntities } from '../scenes/opera/furnished';
import type { AreneSceneFactory } from '../../scripts/arene/scenes.d.mts';

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

const SCENES_DIR = join(__dirname, '../scenes');
const ARENE_JSON = join(SCENES_DIR, 'arene/arene-projet.json');

/** Tous les `.json` de `src/scenes` (récursif). */
function sceneJsonFiles(dir = SCENES_DIR, rel = ''): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...sceneJsonFiles(join(dir, ent.name), relPath));
    else if (ent.name.endsWith('.json')) out.push(relPath);
  }
  return out;
}

/** `<fichier>/<scène>/<entité>` pour chaque entité portant un `foot` d'INSTANCE dans un document BRUT. */
function entitesAvecFoot(doc: unknown, fichier: string): string[] {
  const scenes: { id?: string; entities?: { id?: string; foot?: unknown }[] }[] = [];
  (function rec(o: unknown) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(rec); return; }
    const rec_ = o as Record<string, unknown>;
    if (Array.isArray(rec_.entities)) scenes.push(rec_ as never);
    for (const k of Object.keys(rec_)) rec(rec_[k]);
  })(doc);
  return scenes.flatMap((s) => (s.entities ?? []).filter((e) => e && 'foot' in e).map((e) => `${fichier}/${s.id ?? '?'}/${e.id}`));
}

const entitesAvecFootDansLesJson = (): string[] =>
  sceneJsonFiles().flatMap((f) => entitesAvecFoot(JSON.parse(readFileSync(join(SCENES_DIR, f), 'utf8')), f));

const areneDoc = parseProject(JSON.parse(readFileSync(ARENE_JSON, 'utf8')));
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

  /** Le JSON BRUT, jamais `parseProject`/`normalizeScene` : `stripLegacyFoot` dépouille `foot` au
   *  chargement, une assertion posée APRÈS lui serait verte sur un fichier sali. */
  it('plus AUCUNE instance authorée ne porte d’empreinte propre — mesuré sur le JSON BRUT', () => {
    expect(entitesAvecFootDansLesJson()).toEqual([]);
    expect(scenarioEntities.filter((e) => 'foot' in e).map((e) => `${OPERA}/${e.id}`)).toEqual([]);
  });

  it('le verrou MORD : un JSON sali est rapporté (il ne passe pas sous la normalisation)', () => {
    const sali = JSON.parse(readFileSync(ARENE_JSON, 'utf8'));
    const hub = sali.scenes.find((s: { id: string }) => s.id === 'arene-hub');
    hub.entities.find((e: { id: string }) => e.id === 'p8').foot = { w: 9, h: 9 };
    expect(entitesAvecFoot(sali, 'arene-projet.json')).toEqual(['arene-projet.json/arene-hub/p8']);
    // et la normalisation, elle, l'aurait effacé : c'est bien le fichier BRUT que ce verrou juge.
    expect(normalizeScene(hub as Scene).entities.find((e) => e.id === 'p8')).not.toHaveProperty('foot');
  });
});

/**
 * `arene-projet.json` est GÉNÉRÉ (`scripts/arene/generate.mjs`) : purger le JSON sans purger ses
 * call-sites laisserait la prochaine régénération ré-émettre les empreintes d'instance. Ce verrou
 * juge la SOURCE, en appelant les fabriques de scène du générateur.
 */
describe('générateur de l’Arène — aucune fabrique ne pose d’empreinte d’instance', () => {
  it('les 18 scènes produites par les fabriques ne portent AUCUN `foot` d’entité', async () => {
    const [hub, zones1a7, zones8a13, expeditions] = await Promise.all([
      import('../../scripts/arene/hub.mjs'),
      import('../../scripts/arene/zones1-7.mjs'),
      import('../../scripts/arene/zones8-13.mjs'),
      import('../../scripts/arene/expeditions.mjs'),
    ]);
    const fabriques: [string, AreneSceneFactory][] = [hub, zones1a7, zones8a13, expeditions]
      .flatMap((m) => Object.entries(m).filter(([nom]) => nom.startsWith('make')) as [string, AreneSceneFactory][]);
    expect(fabriques).toHaveLength(18); // 1 hub + 13 zones + 4 expéditions = les 18 scènes du projet
    const porteuses: string[] = [];
    for (const [nom, fabrique] of fabriques) {
      for (const e of fabrique().entities ?? []) if ('foot' in e) porteuses.push(`${nom}/${e.id}`);
    }
    expect(porteuses).toEqual([]);
  });
});
