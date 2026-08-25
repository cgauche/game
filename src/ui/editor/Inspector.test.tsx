// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Inspector } from './Inspector';
import { emptyScene, type Scene, type SceneEntity } from '../../state/scene';
import { lightTones } from '../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Harnais minimal : monte l'`Inspector` sur une scène à UNE entité sélectionnée, capture chaque
 *  `setScene` dans `latest` — assez pour vérifier qu'une saisie ATTERRIT dans la Scène, et qu'elle
 *  SURVIT à un aller-retour JSON (le Schéma de Scène est de la donnée pure, aucune sérialisation
 *  dédiée — `JSON.parse(JSON.stringify(...))` EST le round-trip sauvegarde/chargement, #841). */
function mount(entity: SceneEntity) {
  const scene: Scene = { ...emptyScene(4, 4), entities: [entity] };
  let latest = scene;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const render = (s: Scene) => {
    root.render(
      <Inspector
        scene={s}
        otherScenes={[]}
        worldMap={null}
        setScene={(next) => {
          latest = next;
          render(next);
        }}
        sel={{ type: 'entity', id: entity.id }}
        setSel={() => undefined}
        enemyCreatures={[{ id: 'humain', label: 'Humain' }]}
        openLogic={() => undefined}
        resizeScene={() => undefined}
        narratif={{ affaires: [], indices: [], presetsPnj: [{ id: 'preset-tavernier', profil: { label: 'Le Tavernier' } }], objets: [] }}
        tool={{ mode: 'select' }}
        armZoneTiles={() => undefined}
        zoneFocusKey={null}
      />,
    );
  };
  return {
    container,
    root,
    mount: () => act(() => render(scene)),
    entOf: () => latest.entities[0],
    sceneOf: () => latest,
  };
}

function roundTrip(scene: Scene): Scene {
  return JSON.parse(JSON.stringify(scene)) as Scene;
}

describe('Inspector — apparence visuelle des murs', () => {
  it('conserve la structure mécanique quand une apparence est choisie et sérialisée', async () => {
    const scene: Scene = {
      ...emptyScene(4, 4),
      walls: [{ x: 1, y: 1, side: 'E', structure: 'mur-a-ossature-en-bois' }],
    };
    let latest = scene;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const render = (next: Scene) => root.render(
      <Inspector
        scene={next}
        otherScenes={[]}
        worldMap={null}
        setScene={(updated) => {
          latest = updated;
          render(updated);
        }}
        sel={{ type: 'wall', x: 1, y: 1, side: 'E', z: 0 }}
        setSel={() => undefined}
        enemyCreatures={[]}
        openLogic={() => undefined}
        resizeScene={() => undefined}
        narratif={{ affaires: [], indices: [], presetsPnj: [], objets: [] }}
        tool={{ mode: 'select' }}
        armZoneTiles={() => undefined}
        zoneFocusKey={null}
      />,
    );
    await act(() => render(scene));

    const appearance = Array.from(container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.textContent?.includes('Apparence visuelle')) as HTMLSelectElement;
    expect(appearance).toBeTruthy();
    await act(async () => {
      appearance.value = 'cloison-basse-a-ossature-en-bois';
      appearance.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(latest.walls?.[0]).toEqual({
      x: 1,
      y: 1,
      side: 'E',
      structure: 'mur-a-ossature-en-bois',
      appearance: 'cloison-basse-a-ossature-en-bois',
    });
    expect(roundTrip(latest).walls?.[0]).toEqual(latest.walls?.[0]);

    await act(async () => root.unmount());
    container.remove();
  });
});

describe('Inspector — l’empreinte d’un décor n’est plus une propriété d’instance', () => {
  it('aucun contrôle d’empreinte n’est rendu ; changer de ref ne pose rien sur l’entité', async () => {
    const h = mount({ id: 'p', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'tonneau' });
    await h.mount();

    expect(h.container.textContent).not.toContain('Empreinte');

    const select = Array.from(h.container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.textContent?.includes('Décor')) as HTMLSelectElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'tribune');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(h.entOf().ref).toBe('tribune');
    expect(h.entOf()).not.toHaveProperty('foot');

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });
});

describe('Inspector — champs FU-E de l’instance d’entité (#841)', () => {
  it('light.radiusTiles : la case + le rayon atterrissent dans la Scène et survivent au round-trip', async () => {
    const h = mount({ id: 'lanterne', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'tonneau' });
    await h.mount();

    const checkbox = Array.from(h.container.querySelectorAll('input[type="checkbox"]'))
      .find((el) => el.closest('label')?.textContent?.includes('Source de lumière')) as HTMLInputElement;
    await act(async () => {
      checkbox.click();
    });
    expect(h.entOf().light).toEqual({ radiusTiles: 3 });

    const radiusInput = Array.from(h.container.querySelectorAll('input[type="number"]'))
      .find((el) => el.closest('label')?.textContent?.includes("Rayon d'éclairage")) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(radiusInput, '6');
      radiusInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(h.entOf().light).toEqual({ radiusTiles: 6 });
    expect(roundTrip(h.sceneOf()).entities[0].light).toEqual({ radiusTiles: 6 });

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });

  it('light.tone : le ton d’instance SURVIT au rayon, s’élit/se retire, et survit au round-trip', async () => {
    const h = mount({ id: 'brasero', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'tonneau', light: { radiusTiles: 4, tone: 'lanterne' } });
    await h.mount();

    // (1) régler le rayon ne DÉTRUIT pas le ton posé (l’objet `light` se patche, il ne se remplace pas).
    const radiusInput = Array.from(h.container.querySelectorAll('input[type="number"]'))
      .find((el) => el.closest('label')?.textContent?.includes("Rayon d'éclairage")) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(radiusInput, '6');
      radiusInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(h.entOf().light).toEqual({ radiusTiles: 6, tone: 'lanterne' });

    // (2) le ton est ÉLISABLE dans le catalogue, et retirable (hérité du type de décor).
    const toneSelect = Array.from(h.container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.textContent?.includes('Ton de la lumière')) as HTMLSelectElement;
    expect(toneSelect.value).toBe('lanterne');
    expect(Array.from(toneSelect.options).map((o) => o.value)).toEqual(['', ...lightTones.map((t) => t.id)]);

    await act(async () => {
      toneSelect.value = 'chandelle';
      toneSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(h.entOf().light).toEqual({ radiusTiles: 6, tone: 'chandelle' });
    expect(roundTrip(h.sceneOf()).entities[0].light).toEqual({ radiusTiles: 6, tone: 'chandelle' });

    await act(async () => {
      toneSelect.value = '';
      toneSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(h.entOf().light).toEqual({ radiusTiles: 6 });
    expect(roundTrip(h.sceneOf()).entities[0].light).toEqual({ radiusTiles: 6 });

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });

  it('combat.skills[] : une compétence ajoutée atterrit dans la Scène et survit au round-trip', async () => {
    const h = mount({ id: 'brigand', kind: 'personnage', pos: { x: 0, y: 0 }, ref: 'humain' });
    await h.mount();

    const addSkill = Array.from(h.container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('+ Ajouter') && b.closest('.ed-field')?.textContent?.includes('Compétences ajoutées')) as HTMLButtonElement;
    await act(async () => {
      addSkill.click();
    });
    expect(h.entOf().combat?.skills).toHaveLength(1);
    expect(h.entOf().combat!.skills![0].id).toBe(''); // réf NON élue à la création — l'auteur choisit
    expect(roundTrip(h.sceneOf()).entities[0].combat?.skills).toEqual(h.entOf().combat!.skills);

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });

  it('presetId : le choix atterrit dans la Scène et survit au round-trip (picker BORNÉ, jamais un texte libre — #834 audit-2 défaut 7)', async () => {
    const h = mount({ id: 'pnj', kind: 'personnage', pos: { x: 0, y: 0 } });
    await h.mount();

    const select = Array.from(h.container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.textContent?.includes('Preset PNJ')) as HTMLSelectElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'preset-tavernier');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(h.entOf().presetId).toBe('preset-tavernier');
    expect(roundTrip(h.sceneOf()).entities[0].presetId).toBe('preset-tavernier');

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });

  it('upgrades[] : une amélioration navale ajoutée atterrit dans la Scène et survit au round-trip', async () => {
    const h = mount({ id: 'coque', kind: 'prop', pos: { x: 0, y: 0 }, postes: [{ trappingId: 'canon' }] });
    await h.mount();

    const addUpgrade = Array.from(h.container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('+ Ajouter') && b.closest('.ed-field')?.textContent?.includes("Améliorations d'instance")) as HTMLButtonElement;
    await act(async () => {
      addUpgrade.click();
    });
    expect(h.entOf().upgrades).toHaveLength(1);
    expect(h.entOf().upgrades![0].id).toBe(''); // réf NON élue à la création — l'auteur choisit
    expect(roundTrip(h.sceneOf()).entities[0].upgrades).toEqual(h.entOf().upgrades);

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });

  it('upgrades[] : authorable sur une coque SANS emplacement d’artillerie (Blindage/Lissage seuls, MDG 12 — #834 audit-2 défaut 8)', async () => {
    const h = mount({ id: 'coque-nue', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'cogue' }); // pas de `postes`
    await h.mount();

    expect(h.container.textContent).toContain('Emplacement de siège');
    const addUpgrade = Array.from(h.container.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('+ Ajouter') && b.closest('.ed-field')?.textContent?.includes("Améliorations d'instance")) as HTMLButtonElement;
    await act(async () => {
      addUpgrade.click();
    });
    expect(h.entOf().upgrades).toHaveLength(1);
    expect(roundTrip(h.sceneOf()).entities[0].upgrades).toEqual(h.entOf().upgrades);

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });
});

describe('Inspector — l’identifiant affiché est celui de la zone SÉLECTIONNÉE', () => {
  /** Deux zones d'effet et une sélection PILOTÉE : rejouer le geste « je clique l'une, puis l'autre ». */
  function mountZones() {
    const scene: Scene = {
      ...emptyScene(8, 8),
      effectZones: [
        { id: 'zone-V-z0', label: 'Passage couvert', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 }, z: 0 },
        { id: 'zone-X-z1', label: 'Galerie', presentation: 'interior', area: { kind: 'rect', x: 4, y: 4, w: 2, h: 2 }, z: 0 },
      ],
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const render = (idx: number, zoneFocusKey: string | null = null) =>
      root.render(
        <Inspector
          scene={scene}
          otherScenes={[]}
          worldMap={null}
          setScene={() => undefined}
          sel={{ type: 'effectZone', idx }}
          setSel={() => undefined}
          enemyCreatures={[]}
          openLogic={() => undefined}
          resizeScene={() => undefined}
          narratif={{ affaires: [], indices: [], presetsPnj: [], objets: [] }}
          tool={{ mode: 'select' }}
          armZoneTiles={() => undefined}
          zoneFocusKey={zoneFocusKey}
        />,
      );
    const champ = (libelle: string) =>
      (Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.includes(libelle))?.querySelector('input') as HTMLInputElement | null);
    return {
      container,
      root,
      select: (idx: number, zoneFocusKey: string | null = null) => act(() => render(idx, zoneFocusKey)),
      champ,
    };
  }

  it('après un changement de sélection, Identifiant et Nom affichent la NOUVELLE zone', async () => {
    const h = mountZones();
    await h.select(0);
    expect(h.champ('Identifiant')?.value).toBe('zone-V-z0');
    expect(h.champ('Nom')?.value).toBe('Passage couvert');

    await h.select(1);
    expect(h.champ('Identifiant')?.value).toBe('zone-X-z1');
    expect(h.champ('Nom')?.value).toBe('Galerie');

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });

  it('la saisie en cours sur la MÊME zone n’est pas écrasée (le pilote est l’id affiché, pas le rendu)', async () => {
    const h = mountZones();
    await h.select(0);
    const input = h.champ('Identifiant')!;
    await act(async () => {
      // Frappe au clavier : React ignore une affectation directe de `.value` (son traqueur la voit
      // passer) — le setter natif du prototype est le seul chemin qui déclenche `onChange`.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'zone-V-z0-renommee');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await h.select(0); // re-rendu sur la même sélection (un simple mouvement de souris en produit)
    expect(h.champ('Identifiant')?.value).toBe('zone-V-z0-renommee');

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });

  it('un défaut de ZONE mis en évidence AMÈNE le pinceau d’emprise dans le champ du panneau', async () => {
    const h = mountZones();
    await h.select(1);

    // jsdom ne calcule aucun layout : on pose une géométrie de panneau DÉFILABLE et un bloc d'emprise
    // situé bien plus bas que la ligne de flottaison.
    const panneau = h.container.querySelector('aside.editor-inspector') as HTMLElement;
    const bloc = Array.from(h.container.querySelectorAll('div.ed-field')).find((el) =>
      el.textContent?.includes('Emprise'),
    ) as HTMLElement;
    expect(bloc).toBeTruthy();
    Object.defineProperties(panneau, {
      clientWidth: { value: 320 },
      clientHeight: { value: 400 },
      scrollWidth: { value: 320 },
      scrollHeight: { value: 2000 },
    });
    const rect = (top: number, height: number) =>
      () => ({ width: 320, height, top, left: 0, right: 320, bottom: top + height, x: 0, y: top, toJSON() {} }) as DOMRect;
    panneau.getBoundingClientRect = rect(0, 400);
    bloc.getBoundingClientRect = rect(900, 60); // sous la ligne de flottaison

    expect(panneau.scrollTop).toBe(0);
    await h.select(1, 'zone-debordante:zone-X-z1');
    const amene = panneau.scrollTop;
    expect(amene).toBeGreaterThan(0);
    expect(900 - amene).toBeLessThan(400); // le bloc tient dans la hauteur visible du panneau

    // Discipline : un re-rendu sur le MÊME défaut ne redéplace rien sous les doigts de l'auteur.
    panneau.scrollTop = 42;
    await h.select(1, 'zone-debordante:zone-X-z1');
    expect(panneau.scrollTop).toBe(42);

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });
});

describe('Inspector — l’appareil mécanique d’une zone suit ce que la zone EST', () => {
  /** Une pièce nue (le cas de La Diligence : 37 zones sur 37) et une zone ARMÉE, côte à côte. */
  function mountZones() {
    const scene: Scene = {
      ...emptyScene(8, 8),
      effectZones: [
        { id: 'zone-K-z0', label: 'Cuisine', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 }, z: 0 },
        {
          id: 'fosse',
          label: 'Fosse à pieux',
          area: { kind: 'rect', x: 4, y: 4, w: 2, h: 2 },
          onCross: [{ op: 'wounds', amount: 5, ignoreTB: false, ignoreAP: true }],
        },
      ],
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const render = (idx: number) =>
      root.render(
        <Inspector
          scene={scene}
          otherScenes={[]}
          worldMap={null}
          setScene={() => undefined}
          sel={{ type: 'effectZone', idx }}
          setSel={() => undefined}
          enemyCreatures={[]}
          openLogic={() => undefined}
          resizeScene={() => undefined}
          narratif={{ affaires: [], indices: [], presetsPnj: [], objets: [] }}
          tool={{ mode: 'select' }}
          armZoneTiles={() => undefined}
          zoneFocusKey={null}
        />,
      );
    /** La section repliable dont le résumé porte `titre`. */
    const section = (titre: string) =>
      Array.from(container.querySelectorAll('details.insp-fold')).find((d) =>
        d.querySelector('summary')?.textContent?.includes(titre),
      ) as HTMLDetailsElement | undefined;
    return { container, root, select: (idx: number) => act(() => render(idx)), section };
  }

  it('une PIÈCE présente sa section mécanique REPLIÉE — armable en un clic, jamais déployée d’office', async () => {
    const h = mountZones();
    await h.select(0);
    expect(h.section('Pièce')?.open).toBe(true);
    const mecanique = h.section('Piège / zone d’effet') ?? h.section("Piège / zone d'effet");
    expect(mecanique).toBeTruthy();
    expect(mecanique!.open).toBe(false);

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });

  it('une zone qui PORTE un effet présente sa section mécanique DÉPLOYÉE', async () => {
    const h = mountZones();
    await h.select(1);
    const mecanique = h.section('Piège / zone d’effet') ?? h.section("Piège / zone d'effet");
    expect(mecanique).toBeTruthy();
    expect(mecanique!.open).toBe(true);

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });
});
