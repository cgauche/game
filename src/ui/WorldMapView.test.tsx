import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorldMapView } from './WorldMapView';

/**
 * Recette « impossible de cliquer sur la carte » — rendu STATIQUE sur la VRAIE carte de campagne
 * (état initial du store = projet Arène ; en SSR zustand sert le snapshot initial, d'où les seams
 * `hereSceneId`/`initialRouteId`). On verrouille l'AFFORDANCE : destinations reliées cerclées et
 * cliquables (curseur), routes elles-mêmes cliquables (large zone), lieux hors d'atteinte estompés
 * et explicatifs, panneau de départ complet quand une route est choisie.
 */
describe('WorldMapView — carte de campagne cliquable et lisible', () => {
  it('au Bourg : « Vous êtes ici », Futaie/Felsbach cliquables (cerclées), Tourbière estompée (aide)', () => {
    const html = renderToStaticMarkup(<WorldMapView hereSceneId="arene-hub" />);
    expect(html).toContain('Vous êtes ici');
    expect(html).toContain('Cliquez une destination CERCLÉE');
    expect(html).toContain('cursor:pointer'); // destinations reliées (et leurs routes)
    expect(html).toContain('pointer-events="stroke"'); // routes : large zone de clic invisible
    expect(html).toContain('cursor:help'); // la Tourbière (non reliée au Bourg) explique au clic
    expect(html).toContain('opacity="0.55"'); // … et se voit estompée
    expect(html).toContain('La Vieille Futaie');
    expect(html).toContain('Felsbach');
  });

  it('route sélectionnée (Bourg → Futaie) : panneau de départ — itinéraire, 18 km, marche forcée, Partir', () => {
    const html = renderToStaticMarkup(<WorldMapView hereSceneId="arene-hub" initialRouteId="route-futaie" />);
    expect(html).toContain('Le Bourg de l’Arène');
    expect(html).toContain('La Vieille Futaie');
    expect(html).toContain('18 km');
    expect(html).toContain('Marche forcée');
    expect(html).toContain('Partir');
  });
});
