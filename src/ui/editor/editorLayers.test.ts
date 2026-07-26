/**
 * Préférences de CALQUES de l'éditeur — trois couches qui se superposent : défaut statique
 * (`DEFAULT_LAYERS`), CONTENU de la scène (une carte qui porte des zones descriptives les montre),
 * puis choix EXPLICITE de l'auteur. Contre-épreuve incluse : une scène SANS zone descriptive garde
 * le calque éteint — sinon la préférence ne mesurerait rien.
 */
import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene, type SceneEffectZone } from '../../state/scene';
import { DEFAULT_LAYERS } from './editorState';
import { effectiveLayers, layerChoicesFrom, sceneLayers } from './editorLayers';

/** Zone DESCRIPTIVE : un nom de pièce, sans aucune mécanique (`isDescriptiveZone`). */
const piece: SceneEffectZone = {
  id: 'zn-salle',
  label: 'Salle commune',
  area: { kind: 'rect', x: 1, y: 1, w: 3, h: 3 },
  z: 0,
};

/** Zone MÉCANIQUE : un piège — elle relève du calque `effects`, jamais de `zones`. */
const piege: SceneEffectZone = {
  id: 'zn-piege',
  label: 'Fosse',
  area: { kind: 'rect', x: 5, y: 5, w: 2, h: 2 },
  z: 0,
  onCross: [{ op: 'wounds', amount: 5 }],
};

function withZones(zones: SceneEffectZone[]): Scene {
  return { ...emptyScene(10, 10), effectZones: zones };
}

describe('calques de l’éditeur — le contenu de la scène allume le calque des zones', () => {
  it('une scène PORTANT des zones descriptives ouvre le calque `zones` allumé', () => {
    expect(sceneLayers(withZones([piece])).zones).toBe(true);
  });

  it('contre-épreuve : sans zone descriptive, le calque reste éteint (défaut #826)', () => {
    expect(sceneLayers(emptyScene(10, 10)).zones).toBe(false);
    expect(sceneLayers(withZones([piege])).zones).toBe(false); // une zone MÉCANIQUE n'est pas une pièce
  });

  it('le calque `effects` (voile plein des pièges) reste éteint dans tous les cas', () => {
    expect(DEFAULT_LAYERS.effects).toBe(false);
    expect(sceneLayers(withZones([piece, piege])).effects).toBe(false);
  });
});

describe('calques de l’éditeur — le choix explicite de l’auteur l’emporte', () => {
  it('éteindre le calque sur une scène à zones se retient, rallumer efface le choix', () => {
    const scene = withZones([piece]);
    const éteint = layerChoicesFrom(scene, { ...sceneLayers(scene), zones: false });
    expect(éteint).toEqual({ zones: false });
    expect(effectiveLayers(scene, éteint).zones).toBe(false);

    const rallumé = layerChoicesFrom(scene, { ...sceneLayers(scene), zones: true });
    expect(rallumé).toEqual({}); // revenu à la valeur calculée : plus rien à retenir
    expect(effectiveLayers(scene, rallumé).zones).toBe(true);
  });

  it('allumer `effects` est un choix explicite, qui survit à une scène sans zone', () => {
    const scene = emptyScene(10, 10);
    const choix = layerChoicesFrom(scene, { ...sceneLayers(scene), effects: true });
    expect(choix).toEqual({ effects: true });
    expect(effectiveLayers(scene, choix)).toEqual({ ...DEFAULT_LAYERS, effects: true });
  });
});
