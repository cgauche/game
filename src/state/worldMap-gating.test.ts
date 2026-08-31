/**
 * Gating narratif de la carte du monde (#684 L1) — DEUX axes jamais fusionnés : le NŒUD existe-t-il
 * (`MapPlace.when`, anti-spoiler) et l'ARÊTE est-elle praticable (`MapRoute.when`, anti-backtracking,
 * le lieu déjà visité restant VISIBLE). Lecture PURE : `visiblePlaces` / `routesFrom` évaluent le
 * `ConditionCtx` fabriqué par l'appelant ; sans `ctx`, la carte est intégralement ouverte.
 */
import { describe, it, expect } from 'vitest';
import { parseProject, routesFrom, routesEtat, visiblePlaces, type WorldMap } from './worldMap';
import { emptyNarratif } from './campaignNarratif';
import type { ConditionCtx } from '../engine/flowCore';
import areneProjet from '../scenes/arene/arene-projet.json';
import bargeDuSelProjet from '../scenes/barge-du-sel/barge-du-sel-projet.json';
import loupEtSaumureProjet from '../scenes/loup-et-saumure/loup-et-saumure-projet.json';

const ctx = (flags: Record<string, boolean> = {}): ConditionCtx => ({ flags, gameTime: 0 });

const cartesReelles: [string, WorldMap][] = (
  [
    ['arene-projet.json', areneProjet],
    ['barge-du-sel-projet.json', bargeDuSelProjet],
    ['loup-et-saumure-projet.json', loupEtSaumureProjet],
  ] as [string, unknown][]
).map(([nom, doc]) => {
  const map = parseProject(doc).worldMap;
  if (!map) throw new Error(`${nom} : paquet sans worldMap — la mesure de non-régression perd son sujet.`);
  return [nom, map];
});

describe('cartes RÉELLES committées — aucune n’authore de `when` : l’offre est identique avec et sans ctx', () => {
  it.each(cartesReelles)('%s : lieux et routes inchangés', (_nom, map) => {
    expect(map.places.length).toBeGreaterThan(0);
    expect(map.routes.length).toBeGreaterThan(0);
    expect(map.places.some((p) => p.when)).toBe(false);
    expect(map.routes.some((r) => r.when)).toBe(false);

    expect(visiblePlaces(map, ctx())).toEqual(map.places);
    expect(visiblePlaces(map)).toEqual(map.places);
    for (const p of map.places) {
      expect(routesFrom(map, p.id, ctx())).toEqual(routesFrom(map, p.id));
    }
    // La somme des offres par lieu couvre bien toutes les routes (la mesure porte sur du réel).
    const vues = new Set(map.places.flatMap((p) => routesFrom(map, p.id, ctx()).map((r) => r.id)));
    expect(vues.size).toBe(map.routes.length);
  });
});

const carteGatee: WorldMap = {
  id: 'ch1',
  label: 'Chapitre 1',
  places: [
    { id: 'auberge', label: 'La Diligence', pos: { x: 10, y: 30 }, scene: 's-auberge' },
    { id: 'altdorf', label: 'Altdorf', pos: { x: 60, y: 30 }, scene: 's-altdorf' },
    {
      id: 'bogenhafen',
      label: 'Bögenhafen',
      pos: { x: 20, y: 70 },
      scene: 's-bogenhafen',
      when: { kind: 'flag', expr: 'edo-ch1-bogenhafen-revelee' },
    },
  ],
  routes: [
    { id: 'auberge-altdorf', a: 'auberge', b: 'altdorf', km: 100, modes: ['pied'] },
    {
      id: 'altdorf-auberge-retour',
      a: 'altdorf',
      b: 'auberge',
      from: 'altdorf',
      km: 100,
      modes: ['pied'],
      when: { kind: 'not', of: { kind: 'flag', expr: 'edo-ch1-clos' } },
      refus: 'La route du relais est derrière vous.',
    },
  ],
};

describe('axe NŒUD — `MapPlace.when` retire le lieu tant que le récit ne l’a pas révélé', () => {
  it('flag absent → Bögenhafen n’existe pas ; flag posé → elle apparaît', () => {
    expect(visiblePlaces(carteGatee, ctx()).map((p) => p.id)).toEqual(['auberge', 'altdorf']);
    expect(visiblePlaces(carteGatee, ctx({ 'edo-ch1-bogenhafen-revelee': true })).map((p) => p.id)).toEqual([
      'auberge',
      'altdorf',
      'bogenhafen',
    ]);
  });

  it('sans ctx → carte intégralement ouverte (contrat de non-régression)', () => {
    expect(visiblePlaces(carteGatee)).toEqual(carteGatee.places);
    expect(routesFrom(carteGatee, 'altdorf').map((r) => r.id)).toEqual([
      'auberge-altdorf',
      'altdorf-auberge-retour',
    ]);
  });
});

describe('axe ARÊTE — `MapRoute.when` ferme le trajet SANS effacer le lieu', () => {
  it('chapitre clos → la route de retour disparaît, l’auberge reste visible', () => {
    const clos = ctx({ 'edo-ch1-clos': true });
    expect(routesFrom(carteGatee, 'altdorf', clos).map((r) => r.id)).toEqual(['auberge-altdorf']);
    expect(visiblePlaces(carteGatee, clos).map((p) => p.id)).toContain('auberge');
  });

  it('chapitre ouvert → la route de retour est offerte depuis Altdorf seulement (`from` conservé)', () => {
    const ouvert = ctx();
    expect(routesFrom(carteGatee, 'altdorf', ouvert).map((r) => r.id)).toEqual([
      'auberge-altdorf',
      'altdorf-auberge-retour',
    ]);
    expect(routesFrom(carteGatee, 'auberge', ouvert).map((r) => r.id)).toEqual(['auberge-altdorf']);
  });

  it('les deux axes sont indépendants : un lieu masqué ne ferme pas les routes de ses voisins', () => {
    const c = ctx();
    expect(visiblePlaces(carteGatee, c).map((p) => p.id)).not.toContain('bogenhafen');
    expect(routesFrom(carteGatee, 'auberge', c).map((r) => r.id)).toEqual(['auberge-altdorf']);
  });
});

describe('`routesEtat` — lecteur de la VUE : TOUTES les routes du lieu, chacune avec son verdict (#684 L2)', () => {
  it('chapitre clos → la route de retour est RENDUE, marquée fermée (elle disparaît de `routesFrom`)', () => {
    const clos = ctx({ 'edo-ch1-clos': true });
    expect(routesEtat(carteGatee, 'altdorf', clos).map((e) => [e.route.id, e.ouverte])).toEqual([
      ['auberge-altdorf', true],
      ['altdorf-auberge-retour', false],
    ]);
    // Le VOYAGE ne propose que l'ouverte : les deux lecteurs ne disent pas la même chose.
    expect(routesFrom(carteGatee, 'altdorf', clos).map((r) => r.id)).toEqual(['auberge-altdorf']);
  });

  it('chapitre ouvert → mêmes routes que `routesFrom`, toutes ouvertes', () => {
    const ouvert = ctx();
    expect(routesEtat(carteGatee, 'altdorf', ouvert).map((e) => e.route.id)).toEqual(
      routesFrom(carteGatee, 'altdorf', ouvert).map((r) => r.id),
    );
    expect(routesEtat(carteGatee, 'altdorf', ouvert).every((e) => e.ouverte)).toBe(true);
  });

  it('mêmes prédicats a/b/from que `routesFrom` : la jumelle `from` reste hors du sens inverse', () => {
    const clos = ctx({ 'edo-ch1-clos': true });
    expect(routesEtat(carteGatee, 'auberge', clos).map((e) => e.route.id)).toEqual(['auberge-altdorf']);
  });

  it('sans ctx → tout est ouvert, et l’offre est celle de `routesFrom` (non-régression)', () => {
    expect(routesEtat(carteGatee, 'altdorf').map((e) => [e.route.id, e.ouverte])).toEqual([
      ['auberge-altdorf', true],
      ['altdorf-auberge-retour', true],
    ]);
  });

  it('cartes RÉELLES committées : `routesEtat` rend exactement l’offre de `routesFrom`', () => {
    for (const [, map] of cartesReelles) {
      for (const p of map.places) {
        expect(routesEtat(map, p.id, ctx()).map((e) => e.route)).toEqual(routesFrom(map, p.id, ctx()));
        expect(routesEtat(map, p.id, ctx()).every((e) => e.ouverte)).toBe(true);
      }
    }
  });
});

describe('AUTHORING verrouillé par CONSTRUCTION — le schéma refuse la carte qui mentirait au joueur', () => {
  const projet = (map: WorldMap) => ({
    type: 'projet',
    schema: 7,
    id: 'fixture-gating',
    label: 'Fixture de gating',
    versionContenu: 1,
    maison: 'fixture de test',
    scenes: [{ type: 'scene', id: 's-auberge', label: 's-auberge', dimensions: { w: 3, h: 3 } }],
    worldMap: map,
    narratif: emptyNarratif(),
  }) as unknown;

  it('`when` posé sans `refus` : REFUSÉ — un trajet fermable doit dire au joueur POURQUOI', () => {
    const muette = {
      ...carteGatee,
      routes: carteGatee.routes.map((r) => {
        if (r.id !== 'altdorf-auberge-retour') return r;
        const { refus: _sans, ...reste } = r;
        return reste;
      }),
    };
    expect(() => parseProject(projet(muette))).toThrow(/refus/);
    // La MÊME carte, `refus` en place, passe : c'est bien l'invariant qui mord, pas la forme.
    expect(() => parseProject(projet(carteGatee))).not.toThrow();
  });

  it('`when` dont le kind n’est pas évaluable au contexte de la carte : REFUSÉ (il serait FAUX en silence)', () => {
    const horsPortee = {
      ...carteGatee,
      places: carteGatee.places.map((p) =>
        p.id === 'bogenhafen'
          ? { ...p, when: { kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 1 } }
          : p,
      ),
    };
    expect(() => parseProject(projet(horsPortee as WorldMap))).toThrow(/compare/);
  });

  it('kind hors portée IMBRIQUÉ sous `all`/`not` : refusé aussi (la récursion ne l’oublie pas)', () => {
    const imbrique = {
      ...carteGatee,
      routes: carteGatee.routes.map((r) =>
        r.id === 'altdorf-auberge-retour'
          ? { ...r, when: { kind: 'all', of: [{ kind: 'flag', expr: 'a' }, { kind: 'not', of: { kind: 'foeInLoS' } }] } }
          : r,
      ),
    };
    expect(() => parseProject(projet(imbrique as WorldMap))).toThrow(/foeInLoS/);
  });

  it('l’algèbre ÉVALUABLE passe entière, imbrication comprise (drapeaux, horloge, groupe, bourse)', () => {
    const riche = {
      ...carteGatee,
      places: carteGatee.places.map((p) =>
        p.id === 'bogenhafen'
          ? {
            ...p,
            when: {
              kind: 'all',
              of: [
                { kind: 'flag', expr: 'edo-ch1-bogenhafen-revelee' },
                { kind: 'not', of: { kind: 'money', atLeast: { gold: 1 } } },
                { kind: 'any', of: [{ kind: 'partyDead', who: 'any' }, { kind: 'skill', id: 'charme' }] },
              ],
            },
          }
          : p,
      ),
    };
    expect(() => parseProject(projet(riche as WorldMap))).not.toThrow();
  });
});

describe('`refus` — raison JOUEUR transportée jusqu’au consommateur (rendue par `GatedAction`)', () => {
  it('survit au parse du paquet et est portée par la route offerte', () => {
    const doc = {
      type: 'projet',
      schema: 7,
      id: 'fixture-gating',
      label: 'Fixture de gating',
      versionContenu: 1,
      maison: 'fixture de test',
      scenes: [{ type: 'scene', id: 's-auberge', label: 's-auberge', dimensions: { w: 3, h: 3 } }],
      worldMap: carteGatee,
      narratif: emptyNarratif(),
    };
    const map = parseProject(doc as unknown).worldMap!;
    const route = routesFrom(map, 'altdorf', ctx()).find((r) => r.id === 'altdorf-auberge-retour')!;
    expect(route.refus).toBe('La route du relais est derrière vous.');
    expect(route.when).toEqual({ kind: 'not', of: { kind: 'flag', expr: 'edo-ch1-clos' } });
    expect(map.places.find((p) => p.id === 'bogenhafen')!.when).toEqual({
      kind: 'flag',
      expr: 'edo-ch1-bogenhafen-revelee',
    });
  });
});
