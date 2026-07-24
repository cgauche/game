import { describe, it, expect } from 'vitest';
import { emptyScene, type SceneEffectZone } from '../../state/scene';
import { buildZoneLabels } from './zoneLabels';

/** BUILDER des étiquettes de zone descriptive : gate d'ÉTAGE (#804) — `activeZ`/`viewZ` ABSENTS ⇒
 *  toutes les couches ; fournis ⇒ `viewZ` isole cet étage, sinon SEULE la couche `activeZ` s'affiche
 *  (une étiquette de pièce ne concerne que l'étage courant, jamais empilée avec celles du dessous). */
describe('buildZoneLabels — filtre les étages avec `view`', () => {
  const scene = () => {
    const s = emptyScene(6, 6);
    s.layers.push({ z: 1, tiles: new Array(36).fill('vide') });
    s.effectZones = [
      { id: 'rez', label: 'Salle basse', area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 }, z: 0 },
      { id: 'etage', label: 'Chambre haute', area: { kind: 'rect', x: 3, y: 3, w: 2, h: 2 }, z: 1 },
    ] as SceneEffectZone[];
    return s;
  };

  it('sans opts (rétro-compat) : émet les deux étiquettes, toutes couches confondues', () => {
    const els = buildZoneLabels(scene());
    expect(els.map((e) => e.key).sort()).toEqual(['zoneLabel:etage', 'zoneLabel:rez']);
  });

  it('activeZ=0 (viewZ null) : coupe la couche du dessus, ne garde que le rez', () => {
    const els = buildZoneLabels(scene(), { activeZ: 0, viewZ: null });
    expect(els.map((e) => e.key)).toEqual(['zoneLabel:rez']);
  });

  it('viewZ=1 : isole l\'étage, coupe le rez', () => {
    const els = buildZoneLabels(scene(), { activeZ: 0, viewZ: 1 });
    expect(els.map((e) => e.key)).toEqual(['zoneLabel:etage']);
  });

  it('activeZ=1 (viewZ null) : ne garde QUE l\'étage courant, pas le rez empilé', () => {
    const els = buildZoneLabels(scene(), { activeZ: 1, viewZ: null });
    expect(els.map((e) => e.key)).toEqual(['zoneLabel:etage']);
  });
});
