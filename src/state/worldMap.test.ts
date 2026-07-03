/**
 * parseProject — validation de FORME du document de projet (`{ schema: 2, scenes, worldMap? }`).
 * Garde-fou robustesse : un document corrompu / d'un autre schéma doit LEVER proprement (capté en
 * amont : l'éditeur affiche « JSON invalide », pas un crash), jamais être parsé en silence.
 */
import { describe, it, expect } from 'vitest';
import { parseProject, type ProjectDoc } from './worldMap';
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

  it('mauvais schéma (1) → lève (plus de parsing silencieux d’un format incompatible)', () => {
    expect(() => parseProject({ schema: 1, scenes: [scene('s1')] })).toThrow(/Projet invalide/);
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
});
