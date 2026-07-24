// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { architectureSelectionForWarning, Editor } from './Editor';
import { Inspector } from './Inspector';
import { allBuiltinCampaigns } from '../../scenes/campaign';
import { emptyScene, type Scene } from '../../state/scene';
import { tileCenter, type Dims } from '../../geometry/iso';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Test de fumée du rendu de l'éditeur v2 (toolbar / rail / canvas / inspecteur / statut / dock). */
describe('Editor v2 (rendu)', () => {
  const html = renderToStaticMarkup(<Editor />);

  it('rend la toolbar (Fichier ▾, undo/redo, sélecteur de scène, Monde, Tester)', () => {
    expect(html).toContain('Fichier ▾');
    expect(html).toContain('↶');
    expect(html).toContain('↷');
    expect(html).toContain('Scène active'); // aria-label du sélecteur de scènes
    expect(html).toContain('Monde'); // bouton « <Icon nav/campaign> Monde » (préfixe 🗺️ migré en icône)
    expect(html).toContain('▶ Tester');
  });

  it('rend le rail d’outils de la palette (sélection par défaut + outils v2)', () => {
    expect(html).toContain('Peindre le terrain');
    expect(html).toContain('Poser un décor');
    expect(html).toContain('Poser un point d’entrée'); // manque du POC comblé
    expect(html).toContain('Dessiner une zone');
    expect(html).toContain('Placer des ennemis');
    expect(html).toContain('Gomme');
    expect(html).toContain('Architecture');
    expect(html).not.toContain('Toit — bâtiment composé');
  });

  it('rend le canvas iso (SVG) et l’inspecteur docké sur les propriétés de la scène', () => {
    expect(html).toContain('editor-iso');
    expect(html).toContain('viewBox');
    expect(html).toContain('Identité');
    expect(html).toContain('Ambiance &amp; météo');
    expect(html).toContain('Points d&#x27;entrée');
  });

  it('rend la barre de statut (calques) et le dock Logique (onglets + compteurs)', () => {
    expect(html).toContain('Calques');
    expect(html).toContain('Triggers'); // onglet « <Icon map-tool/zone> Triggers »
    expect(html).toContain('Dialogues'); // onglet « <Icon merchant/haggle> Dialogues »
    expect(html).toContain('Rencontres'); // onglet « <Icon action/attack> Rencontres » (préfixe ⚔️ migré)
    expect(html).toContain('Validation');
  });

  it('ne rend AUCUNE modale d’édition (l’édition est dockée)', () => {
    expect(html).not.toContain('editor-edit-modal');
    expect(html).not.toContain('modal-overlay');
  });
});

describe('Editor v2 — « Ouvrir » une campagne built-in ouvre une COPIE (#367)', () => {
  it('charge la campagne en projet SANS id (Enregistrer créera un NOUVEAU projet, jamais un écrasement du source)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<Editor />);
    });

    const fileBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Fichier'))!;
    await act(async () => {
      fileBtn.click();
    });
    const openItem = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Ouvrir…'))!;
    await act(async () => {
      openItem.click();
    });

    const first = allBuiltinCampaigns[0];
    const row = Array.from(container.querySelectorAll('.listrow')).find((el) => el.textContent?.includes(first.label))!;
    const openBuiltinBtn = row.querySelector('button.btn-primary') as HTMLButtonElement;
    await act(async () => {
      openBuiltinBtn.click();
    });

    const h2 = container.querySelector('h2')!;
    expect(h2.getAttribute('title')).toBe(`Copie de ${first.label}`);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

describe('Editor v2 — authoring architectural', () => {
  it.each([
    ['partie z0', { type: 'architecturePart', bodyId: 'corps', storeyId: 'z0', id: 'partie-z0' }, 'Salle basse', 'Salle haute'],
    ['partie z1', { type: 'architecturePart', bodyId: 'corps', storeyId: 'z1', id: 'partie-z1' }, 'Salle haute', 'Salle basse'],
    ['façade z0', { type: 'facadeSection', bodyId: 'corps', id: 'facade-z0' }, 'Salle basse', 'Salle haute'],
    ['façade z1', { type: 'facadeSection', bodyId: 'corps', id: 'facade-z1' }, 'Salle haute', 'Salle basse'],
    ['toiture z0', { type: 'roofSection', bodyId: 'corps', id: 'toiture-z0' }, 'Salle basse', 'Salle haute'],
    ['toiture z1', { type: 'roofSection', bodyId: 'corps', id: 'toiture-z1' }, 'Salle haute', 'Salle basse'],
  ] as const)('filtre les pièces révélées sur le z de la %s sélectionnée', (_label, sel, allowed, forbidden) => {
    const scene: Scene = {
      ...emptyScene(8, 8),
      effectZones: [
        { id: 'salle-bas', label: 'Salle basse', presentation: 'interior', z: 0, area: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 } },
        { id: 'salle-haut', label: 'Salle haute', presentation: 'interior', z: 1, area: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 } },
      ],
      architecture: [{
        id: 'corps',
        style: 'maison',
        storeys: [
          { id: 'z0', z: 0, parts: [{ id: 'partie-z0', foot: { x: 0, y: 0, w: 1, h: 1 } }], roomZoneIds: [] },
          { id: 'z1', z: 1, parts: [{ id: 'partie-z1', foot: { x: 0, y: 0, w: 1, h: 1 } }], roomZoneIds: [] },
        ],
        facades: [
          { id: 'facade-z0', z: 0, edges: [{ x: 0, y: 0, side: 'N' }], appearance: 'mur', features: [] },
          { id: 'facade-z1', z: 1, edges: [{ x: 0, y: 0, side: 'N', z: 1 }], appearance: 'mur', features: [] },
        ],
        roofs: [
          { id: 'toiture-z0', z: 0, foot: { x: 0, y: 0, w: 1, h: 1 }, profile: 'gable', ridge: 'x', eaveHeightM: 3, pitch: 0.75, material: 'tuile', roomZoneIds: [] },
          { id: 'toiture-z1', z: 1, foot: { x: 0, y: 0, w: 1, h: 1 }, profile: 'gable', ridge: 'x', eaveHeightM: 3, pitch: 0.75, material: 'tuile', roomZoneIds: [] },
        ],
      }],
    };
    const html = renderToStaticMarkup(
      <Inspector
        scene={scene}
        otherScenes={[]}
        worldMap={null}
        setScene={() => undefined}
        sel={sel}
        setSel={() => undefined}
        enemyCreatures={[]}
        openLogic={() => undefined}
        resizeScene={() => undefined}
      />,
    );
    expect(html).toContain(allowed);
    expect(html).not.toContain(forbidden);
  });

  it('sélectionne une cible architecturale de warning par ids stables', () => {
    expect(architectureSelectionForWarning({
      level: 'error',
      sceneId: 'scene',
      scope: 'architecture',
      refId: 'feature-0',
      message: 'Feature invalide',
      architectureRef: { type: 'facadeSection', bodyId: 'corps-0', id: 'facade-0' },
    })).toEqual({ type: 'facadeSection', bodyId: 'corps-0', id: 'facade-0' });
  });

  it('ouvre dans l’inspecteur la section ciblée par un warning de feature', async () => {
    const initialScene: Scene = {
      ...emptyScene(8, 8),
      architecture: [{
        id: 'corps',
        style: 'maison',
        storeys: [
          { id: 'z0', z: 0, parts: [], roomZoneIds: [] },
          { id: 'grenier', z: 3, parts: [], roomZoneIds: [] },
        ],
        facades: [{
          id: 'facade',
          z: 0,
          edges: [{ x: 2, y: 2, side: 'N' }],
          appearance: 'auberge-relais-imperiale',
          features: [{ id: 'feature', kind: 'gable', edge: { x: 2, y: 2, side: 'N' }, width: 0 }],
        }],
        roofs: [],
      }, {
        id: 'corps',
        style: 'maison',
        storeys: [],
        facades: [],
        roofs: [],
      }],
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<Editor initialScene={initialScene} />);
    });
    const validationTab = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.includes('Validation'),
    )!;
    await act(async () => {
      validationTab.click();
    });
    const warning = Array.from(container.querySelectorAll('.ed-validation li')).find(
      (candidate) => candidate.textContent?.includes('feature'),
    ) as HTMLLIElement;
    await act(async () => {
      warning.click();
    });
    expect(container.querySelector('.insp-title')?.textContent).toContain('facade');
    const storeyWarning = Array.from(container.querySelectorAll('.ed-validation li')).find(
      (candidate) => candidate.textContent?.includes('Étage 3 inexistant'),
    ) as HTMLLIElement;
    await act(async () => {
      storeyWarning.click();
    });
    expect(container.querySelector('.insp-title')?.textContent).toContain('grenier');
    const bodyWarning = Array.from(container.querySelectorAll('.ed-validation li')).find(
      (candidate) => candidate.textContent?.includes('Id dupliqué « corps »'),
    ) as HTMLLIElement;
    await act(async () => {
      bodyWarning.click();
    });
    expect(container.querySelector('.insp-title')?.textContent).toContain('corps');
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('crée un corps, une section de toit et la lie à une pièce', async () => {
    const initialScene: Scene = {
      ...emptyScene(8, 8),
      effectZones: [{
        id: 'salle',
        label: 'Salle commune',
        area: { kind: 'rect', x: 1, y: 1, w: 4, h: 3 },
        presentation: 'interior',
      }],
    };
    let savedScene = initialScene;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<Editor initialScene={initialScene} onSceneChange={(scene) => { savedScene = scene; }} />);
    });
    const button = (label: string) => Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label || candidate.getAttribute('aria-label') === label,
    )!;

    await act(async () => {
      button('Architecture').click();
    });
    await act(async () => {
      button('Nouveau corps').click();
    });
    await act(async () => {
      button('Section de toiture').click();
    });

    const roomSelect = Array.from(container.querySelectorAll('label'))
      .find((label) => label.textContent?.includes('Pièces révélées'))
      ?.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      Array.from(roomSelect.options).forEach((option) => {
        option.selected = option.value === 'salle';
      });
      roomSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(savedScene.architecture?.[0]?.roofs[0]?.roomZoneIds).toEqual(['salle']);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('applique l’étage actif aux parties, façades et toitures puis crée une feature', async () => {
    const initialScene: Scene = {
      ...emptyScene(8, 8),
      layers: [
        emptyScene(8, 8).layers[0],
        { z: 1, tiles: new Array(64).fill('vide') },
      ],
      architecture: [{
        id: 'corps',
        style: 'maison',
        storeys: [
          { id: 'z0', z: 0, parts: [], roomZoneIds: [] },
          { id: 'z1', z: 1, parts: [], roomZoneIds: [] },
        ],
        facades: [],
        roofs: [],
      }],
    };
    let savedScene = initialScene;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const button = (label: string) => Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label || candidate.getAttribute('aria-label') === label,
    )!;

    await act(async () => {
      root.render(<Editor initialScene={initialScene} onSceneChange={(scene) => { savedScene = scene; }} />);
    });
    await act(async () => {
      button('Architecture').click();
    });
    const storeySelect = Array.from(container.querySelectorAll('label'))
      .find((label) => label.textContent?.includes('Étage actif'))
      ?.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      storeySelect.value = 'z1';
      storeySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      button('Nouvelle partie').click();
    });
    await act(async () => {
      button('Section de toiture').click();
    });
    expect(button('Section de façade').getAttribute('aria-pressed')).toBe('false');
    await act(async () => {
      button('Section de façade').click();
    });
    expect(button('Section de façade').getAttribute('aria-pressed')).toBe('true');

    const svg = container.querySelector('svg.editor-iso') as SVGSVGElement;
    const point = { x: 0, y: 0, matrixTransform: () => ({ x: point.x, y: point.y }) };
    Object.defineProperty(svg, 'createSVGPoint', { value: () => point });
    Object.defineProperty(svg, 'getScreenCTM', { value: () => ({ inverse: () => ({}) }) });
    const dims: Dims = { ...initialScene.dimensions, rot: 0, view: 'iso' };
    const here = tileCenter(1, 1, dims, 1);
    const north = tileCenter(1, 0, dims, 1);
    await act(async () => {
      svg.dispatchEvent(new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: (here.cx + north.cx) / 2,
        clientY: (here.cy + north.cy) / 2,
      }));
    });
    await act(async () => {
      button('Nouvelle feature').click();
    });

    const body = savedScene.architecture?.[0];
    expect(body?.storeys.find((storey) => storey.id === 'z1')?.parts).toHaveLength(1);
    expect(body?.facades[0]?.z).toBe(1);
    expect(body?.facades[0]?.features).toHaveLength(1);
    expect(body?.roofs[0]?.z).toBe(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

});
