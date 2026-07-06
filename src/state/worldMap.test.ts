/**
 * parseProject — validation de FORME du document de projet (`{ schema: 2, scenes, worldMap? }`).
 * Garde-fou robustesse : un document corrompu / d'un autre schéma doit LEVER proprement (capté en
 * amont : l'éditeur affiche « JSON invalide », pas un crash), jamais être parsé en silence.
 */
import { describe, it, expect } from 'vitest';
import { parseProject, declutterPositions, type ProjectDoc, type RenderPoint } from './worldMap';
import type { Scene } from './scene';

const scene = (id: string) => ({ id } as Scene);
const wm = { id: 'm', nom: 'Carte', places: [], routes: [] };

describe('parseProject — validation du format projet v2', () => {
  it('document valide { schema: 2, scenes } → scènes restituées', () => {
    const doc: ProjectDoc = { schema: 2, scenes: [scene('s1'), scene('s2')] };
    expect(parseProject(doc).scenes.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('worldMap optionnel : présent → restitué ; absent → undefined', () => {
    expect(parseProject({ schema: 2, scenes: [scene('s1')], worldMap: wm }).worldMap).toEqual(wm);
    expect(parseProject({ schema: 2, scenes: [scene('s1')] }).worldMap).toBeUndefined();
  });

  it('schéma 1 (aucune migration 1→2 définie) → refus EXPLICITE, pas un throw sec muet', () => {
    expect(() => parseProject({ schema: 1, scenes: [scene('s1')] }))
      .toThrow(/Projet invalide ou version non supportée.*schema=1/);
  });

  it('schéma futur inconnu (99) → refus EXPLICITE (on ne devine pas une structure future)', () => {
    expect(() => parseProject({ schema: 99, scenes: [scene('s1')] }))
      .toThrow(/Projet invalide ou version non supportée.*schema=99/);
  });

  it('schéma absent → lève', () => {
    expect(() => parseProject({ scenes: [scene('s1')] })).toThrow(/Projet invalide/);
  });

  it('scenes manquant ou non-tableau → lève', () => {
    expect(() => parseProject({ schema: 2 })).toThrow(/Projet invalide/);
    expect(() => parseProject({ schema: 2, scenes: 'nope' })).toThrow(/Projet invalide/);
  });

  it('formats legacy (tableau de scènes nu, scène unique, null) → lèvent', () => {
    expect(() => parseProject([scene('s1')])).toThrow(/Projet invalide/); // ancien : tableau nu
    expect(() => parseProject(scene('s1'))).toThrow(/Projet invalide/); // ancien : scène unique
    expect(() => parseProject(null)).toThrow(/Projet invalide/);
  });

  it('MapPlace.port (Index des ports, MDG ch.15) survit au round-trip via parseProject', () => {
    // Un Lieu-port complet : taille/richesse/production/surplus/demande/cosmopolite/lighthouse — édité
    // par la section « Port » de WorldMapEditor, préservé tel quel par le round-trip du projet.
    const port = {
      taille: 4, richesse: 5, production: ['commerce', 'produits-de-luxe'],
      surplus: { 'produits-de-luxe': 1 }, demande: { cereales: 2 }, cosmopolite: true, lighthouse: true,
    };
    const mapWithPort = { id: 'm', nom: 'Côte', places: [{ id: 'l1', label: 'Marienburg', pos: { x: 50, y: 50 }, scene: 's1', port }], routes: [] };
    const doc: ProjectDoc = { schema: 2, scenes: [scene('s1')], worldMap: mapWithPort as never };
    const round = parseProject(JSON.parse(JSON.stringify(doc)));
    expect(round.worldMap!.places[0].port).toEqual(port);
  });

  it('WorldMap.background (vraie carte de fond) survit au round-trip via parseProject', () => {
    // Édité par la section « Carte » de WorldMapEditor : image de fond (URL / data URI) préservée telle
    // quelle. Sa présence désactive le déchevauchement (les lieux restent à leurs pos EXACTES).
    const bg = 'data:image/svg+xml;utf8,%3Csvg%2F%3E';
    const mapWithBg = { id: 'm', nom: 'Reikland', background: bg, places: [{ id: 'l1', label: 'Altdorf', pos: { x: 60, y: 30 }, scene: 's1' }], routes: [] };
    const doc: ProjectDoc = { schema: 2, scenes: [scene('s1')], worldMap: mapWithBg as never };
    const round = parseProject(JSON.parse(JSON.stringify(doc)));
    expect(round.worldMap!.background).toBe(bg);
  });
});

/**
 * declutterPositions — écartement déterministe des médaillons trop proches (RENDU seulement).
 * Rend lisibles les grandes cartes où les lieux se chevauchent au centre (ex. le Reik) sans jamais
 * toucher la donnée `pos` d'authoring.
 */
describe('declutterPositions — anti-chevauchement pur & déterministe', () => {
  const minPairDist = (m: Map<string, { x: number; y: number }>) => {
    const arr = [...m.values()];
    let min = Infinity;
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++)
        min = Math.min(min, Math.hypot(arr[j].x - arr[i].x, arr[j].y - arr[i].y));
    return min;
  };

  it('des lieux superposés/trop proches → après la passe, toutes les paires sont ≥ minDist', () => {
    // 6 lieux empilés quasi au même point (le cas « le Reik » : 27+ médaillons au centre).
    const pts: RenderPoint[] = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, x: 50 + i * 0.01, y: 32 }));
    const out = declutterPositions(pts, 6, 200);
    // Tolérance numérique : la relaxation converge vers minDist par le dessous à ε près.
    expect(minPairDist(out)).toBeGreaterThanOrEqual(6 - 1e-3);
  });

  it('deux points EXACTEMENT confondus sont séparés (angle dérivé des id, pas de RNG)', () => {
    const pts: RenderPoint[] = [{ id: 'a', x: 50, y: 32 }, { id: 'b', x: 50, y: 32 }];
    const out = declutterPositions(pts, 8, 100);
    expect(minPairDist(out)).toBeGreaterThanOrEqual(8 - 1e-3);
  });

  it('déterministe : même entrée → même sortie (aucun Math.random)', () => {
    const mk = (): RenderPoint[] => [
      { id: 'a', x: 50, y: 32 }, { id: 'b', x: 50.2, y: 32.1 },
      { id: 'c', x: 49.8, y: 31.9 }, { id: 'd', x: 50, y: 32 },
    ];
    const a = declutterPositions(mk(), 7, 120);
    const b = declutterPositions(mk(), 7, 120);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it('les positions restent DANS le cadre 0..100 × 0..64', () => {
    // Amas collé au coin : le bornage doit empêcher toute fuite hors cadre.
    const pts: RenderPoint[] = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, x: 0.1, y: 0.1 + i * 0.01 }));
    const out = declutterPositions(pts, 10, 200);
    for (const { x, y } of out.values()) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(64);
    }
  });

  it('n\'AMÉLIORE jamais au pire : des lieux déjà espacés ne sont pas rapprochés', () => {
    const pts: RenderPoint[] = [
      { id: 'a', x: 10, y: 10 }, { id: 'b', x: 90, y: 10 }, { id: 'c', x: 50, y: 55 },
    ];
    const before = minPairDist(new Map(pts.map((p) => [p.id, { x: p.x, y: p.y }])));
    const out = declutterPositions(pts, 6, 60);
    // Déjà au-dessus du seuil → convergence immédiate, positions inchangées.
    expect(minPairDist(out)).toBeGreaterThanOrEqual(before - 1e-9);
    expect(out.get('a')).toEqual({ x: 10, y: 10 });
  });

  it('ne mute pas le tableau d\'entrée', () => {
    const pts: RenderPoint[] = [{ id: 'a', x: 50, y: 32 }, { id: 'b', x: 50.1, y: 32 }];
    declutterPositions(pts, 8, 50);
    expect(pts).toEqual([{ id: 'a', x: 50, y: 32 }, { id: 'b', x: 50.1, y: 32 }]);
  });
});
