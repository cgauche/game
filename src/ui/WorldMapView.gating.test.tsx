// @vitest-environment jsdom
/**
 * RENDU du gating narratif de la carte du monde (#684 L2) — contrats POSITIFS.
 *
 * Deux axes, deux rendus opposés (design jugé, 2026-08-31) :
 *  - LIEU non révélé (`MapPlace.when`) = ABSENT (anti-spoiler) — ni du DOM, ni du CADRAGE : le
 *    `viewBox`/`transform` de cadrage ne doit pas trahir un lieu que la carte ne montre pas ;
 *  - ROUTE fermée (`MapRoute.when`) = VISIBLE mais REFUSÉE — le joueur voit qu'il ne peut plus y
 *    aller, et la raison (`MapRoute.refus`) est ATTEIGNABLE (`GatedAction` : `aria-disabled`,
 *    jamais `disabled`, raison liée par `aria-describedby`).
 *
 * Non-régression : une carte SANS gating (paquet RÉEL committé) rend exactement comme avant.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorldMapView } from './WorldMapView';
import { useGame } from '../state/store';
import { parseProject, type WorldMap } from '../state/worldMap';
import { buildApi } from '../state/devtools';
import { emptyScene, type Scene } from '../state/scene';
import bargeDuSelProjet from '../scenes/barge-du-sel/barge-du-sel-projet.json';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Le lieu caché est posé LOIN des autres : s'il entrait dans le cadrage, le viewport en porterait la trace. */
const carte: WorldMap = {
  id: 'ch1',
  label: 'Chapitre 1',
  places: [
    { id: 'auberge', label: 'La Diligence', pos: { x: 10, y: 30 }, scene: 's-auberge' },
    { id: 'altdorf', label: 'Altdorf', pos: { x: 20, y: 30 }, scene: 's-altdorf' },
    {
      id: 'bogenhafen',
      label: 'Bögenhafen',
      pos: { x: 96, y: 62 },
      scene: 's-bogenhafen',
      when: { kind: 'flag', expr: 'edo-ch1-bogenhafen-revelee' },
    },
  ],
  routes: [
    { id: 'auberge-altdorf', a: 'auberge', b: 'altdorf', km: 30, modes: ['pied'] },
    { id: 'auberge-bogenhafen', a: 'auberge', b: 'bogenhafen', km: 90, modes: ['pied'] },
    {
      id: 'auberge-ferme',
      a: 'auberge',
      b: 'altdorf',
      from: 'auberge',
      km: 42,
      modes: ['pied'],
      when: { kind: 'not', of: { kind: 'flag', expr: 'edo-ch1-clos' } },
      refus: 'Les gardes ont barré le pont de Bögen.',
    },
  ],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  useGame.setState({ worldMap: null, flags: {} });
});

const scenePlate = (id: string): Scene => {
  const s = emptyScene(6, 6);
  s.id = id;
  s.label = id;
  return s;
};

async function monter(props: { hereSceneId?: string; initialRouteId?: string } = {}) {
  await act(async () => {
    root.render(<WorldMapView {...props} />);
  });
}

/** Transform de cadrage du groupe zoomable de `MapCanvas` — la trace mesurable du fit initial. */
function cadrage(): string {
  const g = container.querySelector('svg g[transform^="translate("]');
  return g?.getAttribute('transform') ?? '';
}

describe('axe NŒUD — le lieu non révélé est ABSENT du rendu ET du cadrage', () => {
  it('flag absent : ni médaillon, ni cartouche, ni route vers Bögenhafen', async () => {
    useGame.setState({ worldMap: carte, flags: {} });
    await monter({ hereSceneId: 's-auberge' });
    expect(container.textContent).toContain('La Diligence');
    expect(container.textContent).toContain('Altdorf');
    expect(container.textContent).not.toContain('Bögenhafen');
    // Le tronçon qui y mène disparaît avec lui (sinon un trait vers le vide le trahit) : deux routes
    // dessinées depuis l'auberge (vers Altdorf, ouverte et fermée), jamais celle de Bögenhafen.
    expect(container.querySelectorAll('path[pointer-events="stroke"]')).toHaveLength(2);
    // ATTRIBUTAIRE : aucun NOM ACCESSIBLE ne trahit le lieu caché. Un médaillon cliquable porte
    // `aria-label={label}` (`MapCanvas.tsx`) — un lecteur d'écran, un test e2e ou une manette le
    // liraient même si le texte visible, lui, restait muet.
    const noms = Array.from(container.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label') ?? '');
    expect(noms.filter((n) => n.includes('Bögenhafen'))).toEqual([]);
  });

  it('flag posé : le lieu apparaît — le rendu n’a pas changé de nature, seule la donnée a bougé', async () => {
    useGame.setState({ worldMap: carte, flags: { 'edo-ch1-bogenhafen-revelee': true } });
    await monter({ hereSceneId: 's-auberge' });
    expect(container.textContent).toContain('Bögenhafen');
    expect(container.querySelectorAll('path[pointer-events="stroke"]')).toHaveLength(3);
  });

  it('CADRAGE : le lieu caché ne tire pas le viewport — révélé, il le tire (mesure du fit)', async () => {
    useGame.setState({ worldMap: carte, flags: {} });
    await monter({ hereSceneId: 's-auberge' });
    const sansLuiI = cadrage();
    expect(sansLuiI, 'le groupe de cadrage existe').not.toBe('');

    await act(async () => root.unmount());
    root = createRoot(container);
    useGame.setState({ worldMap: carte, flags: { 'edo-ch1-bogenhafen-revelee': true } });
    await monter({ hereSceneId: 's-auberge' });
    const avecLui = cadrage();

    // Un lieu à (96, 62) est hors du cadrage serré des deux lieux de gauche : s'il y entrait, le
    // fit (zoom/pan) changerait. Il ne doit changer QU'UNE FOIS le lieu révélé.
    expect(avecLui).not.toBe(sansLuiI);
  });
});

describe('axe ARÊTE — le trajet fermé reste VISIBLE, son départ est REFUSÉ avec sa raison', () => {
  it('chapitre clos : la route est rendue et sélectionnable, le départ porte `refus` (aria-disabled)', async () => {
    useGame.setState({ worldMap: carte, flags: { 'edo-ch1-clos': true } });
    await monter({ hereSceneId: 's-auberge', initialRouteId: 'auberge-ferme' });

    const bouton = container.querySelector('#wm-route-fermee-auberge-ferme-reason')
      ? container.querySelector('button[aria-describedby="wm-route-fermee-auberge-ferme-reason"]')
      : null;
    expect(bouton, 'le bouton de départ existe et se lie à sa raison').toBeTruthy();
    // Atteignable au clavier/manette/tap : `aria-disabled`, JAMAIS l'attribut HTML `disabled`.
    expect(bouton!.getAttribute('aria-disabled')).toBe('true');
    expect((bouton as HTMLButtonElement).disabled).toBe(false);

    const raison = container.querySelector('#wm-route-fermee-auberge-ferme-reason');
    expect(raison!.textContent).toBe('Les gardes ont barré le pont de Bögen.');
    // Le trajet reste lisible : on voit OÙ l'on ne peut plus aller.
    expect(container.textContent).toContain('Altdorf');
  });

  it('chapitre ouvert : la même route est un départ NORMAL (aucune affordance refusée)', async () => {
    useGame.setState({ worldMap: carte, flags: {} });
    await monter({ hereSceneId: 's-auberge', initialRouteId: 'auberge-ferme' });
    expect(container.querySelector('#wm-route-fermee-auberge-ferme-reason')).toBeNull();
    expect(container.textContent).toContain('Partir');
    expect(container.textContent).toContain('Marche forcée');
  });
});

describe('recette — `__wfrp.routes()` décrit EXACTEMENT les tracés cliquables du DOM, dans le MÊME ordre', () => {
  it('un lieu caché ne décale plus l’index : `routes()[i]` est bien la route du iᵉ tracé', async () => {
    useGame.setState({ worldMap: carte, flags: { 'edo-ch1-clos': true }, scene: scenePlate('s-auberge') });
    await monter({ hereSceneId: 's-auberge' });

    const annonce = buildApi().routes() as { id: string; etat: string }[];
    expect(annonce.map((r) => r.id)).toEqual(['auberge-altdorf', 'auberge-ferme']);
    expect(annonce.map((r) => r.etat)).toEqual(['ouverte', 'fermee-consultable']);

    const traces = Array.from(container.querySelectorAll<SVGPathElement>('path[pointer-events="stroke"]'));
    expect(traces).toHaveLength(annonce.length);

    // `clickRoute(id)` clique le iᵉ tracé : le prouver, c'est cliquer ce tracé-là et lire QUELLE route
    // s'ouvre. L'index 1 doit être celui que l'annonce nomme — la route FERMÉE, qui dit sa raison.
    await act(async () => {
      traces[1].parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector(`#wm-route-fermee-${annonce[1].id}-reason`)).toBeTruthy();
  });
});

describe('non-régression — un paquet RÉEL sans `when` rend à l’identique avec et sans gating', () => {
  it('barge-du-sel : le rendu est le même que le flag narratif soit posé ou non', async () => {
    const map = parseProject(bargeDuSelProjet as unknown).worldMap!;
    const premier = map.places[0];

    useGame.setState({ worldMap: map, flags: {} });
    await monter({ hereSceneId: premier.scene });
    const nu = container.innerHTML;

    await act(async () => root.unmount());
    root = createRoot(container);
    useGame.setState({ worldMap: map, flags: { 'un-flag-quelconque': true } });
    await monter({ hereSceneId: premier.scene });

    expect(container.innerHTML).toBe(nu);
    for (const p of map.places) expect(container.textContent).toContain(p.label);
  });
});
