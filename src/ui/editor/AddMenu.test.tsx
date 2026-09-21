// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { AddMenu, placeMenu } from './AddMenu';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** La vue de RÉFÉRENCE des recettes, lue à sa source unique (#1847) : la POSE du menu se juge dans
 *  la fenêtre où l'écran est jugé, jamais dans un viewport inventé au test. Chemin depuis la racine
 *  du dépôt : sous `@vitest-environment jsdom`, `import.meta.url` n'est pas une URL `file:`. */
const VUE = JSON.parse(readFileSync('scripts/recette/vues-recette.json', 'utf8'))
  .find((v: { nom: string }) => v.nom === 'bureau') as { largeur: number; hauteur: number };
const VP = { width: VUE.largeur, height: VUE.hauteur };
/** Le menu tient-il ENTIER dans le viewport, marges comprises ? */
const tientAEcran = (box: { top: number; maxHeight: number }) => box.top >= 0 && box.top + box.maxHeight <= VP.height;

describe('AddMenu — le menu d’ajout se pose TOUJOURS entier à l’écran', () => {
  it('un bouton au BAS du dock Logique ouvre le menu VERS LE HAUT, entièrement visible', () => {
    // Mesure de recette sur La Diligence : le bouton « + Bloc » est au RAS du bas du panneau — ici
    // son HAUT à 48px du bord bas de la vue, donc son bas à 28px, quelle que soit la hauteur de
    // celle-ci : trop près pour qu'un menu de 300px s'ouvre vers le bas.
    const hautDuBouton = VP.height - 48;
    const box = placeMenu({ top: hautDuBouton, bottom: hautDuBouton + 20, left: 322 }, VP);
    expect(box.top + box.maxHeight).toBeLessThanOrEqual(hautDuBouton); // au-dessus du bouton
    expect(box.maxHeight).toBeGreaterThan(300); // toute la place du dessus est prise
    expect(tientAEcran(box)).toBe(true);
  });

  it('un bouton en HAUT de panneau ouvre le menu vers le bas, entièrement visible', () => {
    const box = placeMenu({ top: 120, bottom: 140, left: 322 }, VP);
    expect(box.top).toBeGreaterThanOrEqual(140);
    expect(tientAEcran(box)).toBe(true);
  });

  it('un bouton au MILIEU garde la hauteur bornée par la place réelle du côté choisi', () => {
    const box = placeMenu({ top: 700, bottom: 720, left: 322 }, VP);
    expect(tientAEcran(box)).toBe(true);
    expect(box.maxHeight).toBeLessThanOrEqual(700 - 4 - 8);
  });

  it('un bouton près du bord DROIT rentre le menu dans la largeur (330px + marge)', () => {
    const box = placeMenu({ top: 200, bottom: 220, left: 1500 }, VP);
    expect(box.left + 330).toBeLessThanOrEqual(VP.width);
    expect(box.left).toBeGreaterThanOrEqual(8);
  });
});

const GROUPES = [
  { title: 'Narration', items: [{ key: 'journal', label: 'Journal', onPick: () => undefined }] },
];

describe('AddMenu — le menu ouvert reste SOLIDAIRE de son bouton', () => {
  it('suit son bouton quand le panneau qui le porte défile', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<AddMenu label="+ Effet" groups={GROUPES} />);
    });
    const details = container.querySelector('details.eff-add') as HTMLDetailsElement;
    const summary = details.querySelector('summary')!;
    /** Le bouton vit dans un panneau défilant : sa position à l'écran suit le défilement. */
    let hautDuBouton = 300;
    Object.defineProperty(summary, 'getBoundingClientRect', {
      value: () => ({ top: hautDuBouton, bottom: hautDuBouton + 20, left: 322 }),
    });
    const attendu = (top: number) => {
      const box = placeMenu({ top, bottom: top + 20, left: 322 }, { width: window.innerWidth, height: window.innerHeight });
      return `${box.top}px`;
    };

    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    });
    const menu = container.querySelector('.eff-add-menu') as HTMLElement;
    expect(menu.style.top).toBe(attendu(300));

    hautDuBouton = 120; // le panneau a défilé de 180 px
    await act(async () => {
      container.dispatchEvent(new Event('scroll'));
    });
    expect(menu.style.top).toBe(attendu(120));
    expect(attendu(120)).not.toBe(attendu(300));

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
