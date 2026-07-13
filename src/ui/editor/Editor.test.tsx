// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { Editor } from './Editor';
import { allBuiltinCampaigns } from '../../scenes/campaign';

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
    const row = Array.from(container.querySelectorAll('.listrow')).find((el) => el.textContent?.includes(first.name))!;
    const openBuiltinBtn = row.querySelector('button.btn-primary') as HTMLButtonElement;
    await act(async () => {
      openBuiltinBtn.click();
    });

    const h2 = container.querySelector('h2')!;
    expect(h2.getAttribute('title')).toBe(`Copie de ${first.name}`);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
