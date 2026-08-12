import { describe, it, expect } from 'vitest';
import { AMBIANCE, lowerFloorDimCss, editorLowerLayerFilterCss, sceneWeatherFx } from './ambiance';

describe('voile de couche inférieure — jeu vs éditeur', () => {
  it('le voile ÉDITEUR porte une opacité réelle distincte du voile de JEU (opaque)', () => {
    const gameCss = lowerFloorDimCss();
    const editorCss = editorLowerLayerFilterCss(0.22);
    expect(editorCss).not.toBe(gameCss);
    expect(editorCss).toContain('opacity(0.22)');
    expect(gameCss).not.toMatch(/opacity\(/);
  });

  it("le voile de JEU ne varie JAMAIS avec le réglage de l'éditeur (fonctions indépendantes)", () => {
    const before = lowerFloorDimCss();
    editorLowerLayerFilterCss(0.05);
    editorLowerLayerFilterCss(1);
    expect(lowerFloorDimCss()).toBe(before);
  });

  it('reste basé sur les MÊMES valeurs catalogue (saturate/brightness) que le jeu', () => {
    const gameCss = lowerFloorDimCss();
    const editorCss = editorLowerLayerFilterCss(0.5);
    const [saturateBrightness] = editorCss.split(' opacity(');
    expect(saturateBrightness).toBe(gameCss);
  });
});

describe('porte de la météo — le REGISTRE décide', () => {
  it('un type PRÉSENT au catalogue rend SON entrée, telle quelle', () => {
    expect(sceneWeatherFx({ weather: 'pluie' })).toBe(AMBIANCE.iso.weather.pluie);
    expect(sceneWeatherFx({ weather: 'brouillard' })).toBe(AMBIANCE.iso.weather.brouillard);
  });

  it("un type SANS entrée au catalogue ne montre rien — `clair` n'y est qu'un id de plus", () => {
    expect(AMBIANCE.iso.weather).not.toHaveProperty('clair');
    expect(sceneWeatherFx({ weather: 'clair' })).toBeNull();
    expect(sceneWeatherFx({ weather: undefined })).toBeNull();
    // même sans entrée, la porte reste la MÊME fonction : aucun id n'est nommé dans le code.
    expect(sceneWeatherFx({ weather: 'forge-de-neant' as unknown as 'pluie' })).toBeNull();
  });

  it("l'INTÉRIEUR ferme la porte avant même le registre", () => {
    expect(sceneWeatherFx({ weather: 'pluie', ambiance: 'interieur' })).toBeNull();
  });
});
