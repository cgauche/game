// @vitest-environment jsdom
/** #766 lot C : la bibliothèque de campagnes (menu principal) — liste les campagnes du jeu + la
 *  bibliothèque locale, importe un projet portable (JSON → `SavedProject` publié), en supprime un
 *  (local seulement). Contrats POSITIFS. */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CampaignLibraryScreen, buildImportedProject, importDecision } from './CampaignLibraryScreen';
import { allBuiltinCampaigns } from '../scenes/campaign';
import {
  projectSave,
  projectsLoad,
  publishedProjects,
  __resetLibraryForTest,
} from '../state/projectLibrary';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(async () => {
  await __resetLibraryForTest();
});

/** Document de projet PORTABLE valide, construit depuis une campagne du jeu (round-trip
 *  `parseProject`). */
function builtinDocJson(idx = 0): string {
  const bc = allBuiltinCampaigns[idx];
  return JSON.stringify({
    schema: 3,
    scenes: bc.scenes,
    ...(bc.worldMap ? { worldMap: bc.worldMap } : {}),
    narratif: bc.narratif,
  });
}

describe('buildImportedProject — import portable (#766)', () => {
  it('construit un SavedProject publié à partir d’un document de projet valide', () => {
    const entry = buildImportedProject(builtinDocJson(0), 'depuis-fichier');
    expect(entry.published).toBe(true);
    expect(entry.project.schema).toBe(3);
    expect(entry.project.scenes.length).toBe(allBuiltinCampaigns[0].scenes.length);
    expect(entry.startSceneId).toBe(entry.project.scenes[0].id);
    expect(entry.id).toBeTruthy();
    expect(entry.label).toBeTruthy();
  });

  it('utilise le nom de fichier en repli quand aucune méta/scène nommée', () => {
    // Un doc sans meta : le label retombe sur le nom de la 1re scène, sinon le fallback fourni.
    const entry = buildImportedProject(builtinDocJson(0), 'depuis-fichier');
    expect(entry.label).toBe(allBuiltinCampaigns[0].scenes[0].nom ?? 'depuis-fichier');
  });

  it('lève un message clair (pas de crash) sur JSON illisible', () => {
    expect(() => buildImportedProject('{ pas du json', 'x')).toThrow(/JSON/i);
  });

  it('lève sur un projet structurellement invalide (validation parseProject)', () => {
    expect(() => buildImportedProject(JSON.stringify({ schema: 999 }), 'x')).toThrow();
  });

  it('un import enregistré alimente la bibliothèque ET les projets publiés', () => {
    const entry = buildImportedProject(builtinDocJson(0), 'x');
    projectSave(entry);
    expect(projectsLoad().some((p) => p.id === entry.id)).toBe(true);
    expect(publishedProjects().some((p) => p.id === entry.id)).toBe(true);
  });
});

describe('importDecision — remplacement PROPOSÉ jamais silencieux (#766 lot C)', () => {
  function withVersion(entry: ReturnType<typeof buildImportedProject>, version: number) {
    return { ...entry, project: { ...entry.project, meta: { ...entry.project.meta, id: entry.id, label: entry.label, version } } };
  }

  it('aucun existant de même id → \'new\' (import direct)', () => {
    const entry = buildImportedProject(builtinDocJson(0), 'x');
    expect(importDecision(entry, undefined)).toBe('new');
  });

  it('même id, version importée SUPÉRIEURE → \'replace-newer\'', () => {
    const base = buildImportedProject(builtinDocJson(0), 'x');
    const existing = withVersion(base, 1);
    const incoming = withVersion(base, 2);
    expect(importDecision(incoming, existing)).toBe('replace-newer');
  });

  it('même id, version importée ÉGALE → \'replace-older-or-equal\'', () => {
    const base = buildImportedProject(builtinDocJson(0), 'x');
    const existing = withVersion(base, 3);
    const incoming = withVersion(base, 3);
    expect(importDecision(incoming, existing)).toBe('replace-older-or-equal');
  });

  it('même id, version importée INFÉRIEURE → \'replace-older-or-equal\'', () => {
    const base = buildImportedProject(builtinDocJson(0), 'x');
    const existing = withVersion(base, 5);
    const incoming = withVersion(base, 1);
    expect(importDecision(incoming, existing)).toBe('replace-older-or-equal');
  });
});

describe('CampaignLibraryScreen — rendu (#766)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  async function mount() {
    await act(async () => {
      root.render(<CampaignLibraryScreen onClose={() => {}} />);
    });
  }
  async function unmount() {
    await act(async () => root.unmount());
    container.remove();
  }

  it('liste les campagnes du jeu et les entrées de la bibliothèque locale', async () => {
    const entry = buildImportedProject(builtinDocJson(0), 'Ma copie de test');
    entry.label = 'Ma copie de test';
    entry.id = 'lib-fixture-1';
    projectSave(entry);

    await mount();
    const txt = container.textContent ?? '';
    for (const bc of allBuiltinCampaigns) expect(txt).toContain(bc.label);
    expect(txt).toContain('Ma copie de test');
    await unmount();
  });

  it('« Supprimer » retire l’entrée locale de la bibliothèque (jamais une campagne du jeu)', async () => {
    const entry = buildImportedProject(builtinDocJson(0), 'À supprimer');
    entry.label = 'À supprimer';
    entry.id = 'lib-fixture-del';
    projectSave(entry);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await mount();
    // Sélectionne l’entrée locale.
    const rows = Array.from(container.querySelectorAll('button.listrow'));
    const row = rows.find((el) => el.textContent?.includes('À supprimer')) as HTMLButtonElement;
    expect(row).toBeTruthy();
    await act(async () => row.click());
    // Le bouton Supprimer du détail.
    const del = Array.from(container.querySelectorAll('button.danger')).find(
      (el) => el.textContent?.includes('Supprimer'),
    ) as HTMLButtonElement;
    expect(del).toBeTruthy();
    await act(async () => del.click());

    expect(projectsLoad().some((p) => p.id === 'lib-fixture-del')).toBe(false);
    await unmount();
  });

  it('ré-importer un même meta.id PROPOSE le remplacement (window.confirm) au lieu d’écraser silencieusement (#766)', async () => {
    const bc = allBuiltinCampaigns[0];
    const docFor = (version: number) => JSON.stringify({
      schema: 3,
      scenes: bc.scenes,
      ...(bc.worldMap ? { worldMap: bc.worldMap } : {}),
      narratif: bc.narratif,
      meta: { id: 'dup-fixture', label: 'Doublon', version },
    });
    const v1 = buildImportedProject(docFor(1), 'x');
    projectSave(v1);
    expect(projectsLoad().find((p) => p.id === 'dup-fixture')?.project.meta?.version).toBe(1);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await mount();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File([docFor(2)], 'dup.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {}); // laisse le .then(file.text()) se résoudre

    expect(confirmSpy).toHaveBeenCalled();
    // Confirmation REFUSÉE → la version en bibliothèque reste inchangée (jamais un écrasement silencieux).
    expect(projectsLoad().find((p) => p.id === 'dup-fixture')?.project.meta?.version).toBe(1);
    await unmount();
  });
});
