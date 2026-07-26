// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Inspector } from './Inspector';
import { emptyScene, type Scene, type SceneEntity } from '../../state/scene';

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
