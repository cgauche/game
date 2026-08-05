import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
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

/**
 * #1117 (recette 3, bloquant) — les commandes du panneau latéral (« Rythme normal / Forcer +1 M »,
 * `.wm-modes`) étaient INJOIGNABLES : `elementFromPoint` résolvait sur le SVG de la carte à toutes les
 * coordonnées du bouton. `.map-canvas-frame` porte un `aspect-ratio` ; sous une cellule de grille plus
 * plate que ce ratio (empilement ≤900px), il débordait de `.worldmap-canvas` et recouvrait le panneau.
 * jsdom ne fait PAS de layout : on ne peut pas mesurer le recouvrement ici — on verrouille la RÈGLE
 * qui le rend impossible (le calque carte est borné à sa cellule).
 * Vérification NAVIGATEUR complémentaire (docs/recette-navigateur.md) : fenêtre < 901px de large,
 * carte du monde, route de mer sélectionnée → `document.elementFromPoint(cx, cy)` sur le bouton
 * « Forcer +1 M » doit rendre CE bouton, jamais un nœud de `.map-canvas-frame`.
 */
describe('carte du monde — le calque carte ne déborde pas sur le panneau (#1117)', () => {
  const css = readFileSync(new URL('./styles/world-meta.css', import.meta.url), 'utf8');

  it('`.worldmap-canvas` BORNE son contenu (sinon le cadre à ratio recouvre le panneau)', () => {
    const bloc = /\.worldmap-canvas\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(bloc, 'la règle existe').toBeTruthy();
    expect(bloc, 'le calque carte est borné à sa cellule de grille').toMatch(/overflow:\s*hidden/);
  });

  it('les commandes de cadence sont bien RENDUES dans le panneau (pas dans le canevas)', () => {
    const html = renderToStaticMarkup(<WorldMapView hereSceneId="arene-hub" initialRouteId="route-futaie" />);
    const panelStart = html.indexOf('worldmap-panel');
    expect(panelStart, 'le panneau existe').toBeGreaterThan(-1);
    // Le canevas est rendu AVANT le panneau : toute commande `.wm-modes` vit après son ouverture.
    const modes = html.indexOf('wm-modes');
    if (modes > -1) expect(modes).toBeGreaterThan(html.indexOf('worldmap-canvas'));
  });
});

/**
 * #1117 (recette 4) — panneau de route OUVERT, les commandes de zoom (Zoomer/Dézoomer/Recentrer)
 * devenaient incliquables : `elementFromPoint` résolvait l'aside, rendue APRÈS dans le DOM et sans
 * contexte d'empilement local côté carte. jsdom ne fait pas de layout : on verrouille la RÈGLE.
 * Vérification NAVIGATEUR : fenêtre ~850px, carte du monde, SÉLECTIONNER une route (panneau ouvert),
 * puis `document.elementFromPoint` au centre de « Zoomer » → doit rendre le bouton, jamais l'aside.
 */
describe('carte du monde — les commandes de zoom restent atteignables panneau ouvert (#1117)', () => {
  const css = readFileSync(new URL('./styles/world-meta.css', import.meta.url), 'utf8');

  it('le cadre carte ISOLE son empilement et les commandes de zoom y montent', () => {
    const frame = /\.map-canvas-frame\s*\{[^}]*isolation:\s*isolate[^}]*\}/.test(css);
    const zoom = /\.wm-zoom\s*\{[^}]*z-index:\s*\d+[^}]*\}/.test(css);
    expect(frame, '`.map-canvas-frame` crée son contexte d’empilement').toBe(true);
    expect(zoom, '`.wm-zoom` porte un z-index dans ce contexte').toBe(true);
  });
});

/**
 * #1117 — l'empilement ≤900px est une garantie de la PRIMITIVE `.layout-sidebar`, pas de l'écran :
 * l'aside y revient dans le flux (une surface superposée à la carte serait incliquable, quel que
 * soit son `z-index`). L'écran de carte compose la primitive et ne redéclare donc pas la règle.
 * Vérification NAVIGATEUR : fenêtre ~850px ET ~360px, route SÉLECTIONNÉE (panneau ouvert),
 * `document.elementFromPoint` au centre de « Zoomer » → le bouton ; le panneau reste lisible dessous.
 */
describe('carte du monde — l’empilement ≤900px vient de la primitive (#1117)', () => {
  const base = readFileSync(new URL('./styles/base.css', import.meta.url), 'utf8');
  const worldMeta = readFileSync(new URL('./styles/world-meta.css', import.meta.url), 'utf8');

  it('≤900px : la primitive remet son aside dans le FLUX', () => {
    const media = /@media \(max-width: 900px\) \{[\s\S]*?\n\}/.exec(base)?.[0] ?? '';
    expect(media, 'la media query empilée de la primitive existe').toBeTruthy();
    expect(media, 'l’aside y est remis dans le flux').toMatch(/\.layout-sidebar > aside\s*\{[^}]*position:\s*static/);
  });

  it('l’écran de carte ne REDÉCLARE pas la règle de la primitive', () => {
    const media = /@media \(max-width: 900px\) \{[\s\S]*?\n\}/.exec(worldMeta)?.[0] ?? '';
    expect(media).not.toMatch(/aside\.worldmap-side\s*\{[^}]*position:\s*static/);
  });
});
