// @vitest-environment jsdom
/** #766 lot C : la bibliothèque de campagnes (menu principal) — liste les campagnes du jeu + la
 *  bibliothèque locale, importe un projet portable (JSON → `SavedProject` publié), en supprime un
 *  (local seulement). Contrats POSITIFS. */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CampaignLibraryScreen, buildImportedProject, importDecision, playerImportError, PlayerFacingImportError } from './CampaignLibraryScreen';
import { allBuiltinCampaigns } from '../scenes/campaign';
import {
  projectSave,
  projectsLoad,
  publishedProjects,
  __resetLibraryForTest,
  __setIdbBackendForTest,
  type IdbBackend,
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

  it('échec réel de sauvegarde (IndexedDB en échec ET projet trop gros pour le miroir) : message visible au joueur (#776)', async () => {
    const bc = allBuiltinCampaigns[0];
    const doc = JSON.stringify({
      schema: 3,
      scenes: bc.scenes,
      ...(bc.worldMap ? { worldMap: bc.worldMap } : {}),
      narratif: bc.narratif,
      // Champ méta hors-schéma volontairement énorme : dépasse la borne PAR PROJET du miroir
      // localStorage (500 000 caractères), pour exercer le chemin de PERTE RÉEL.
      meta: { id: 'big-fixture', label: 'Grosse campagne', version: 1, description: 'x'.repeat(600_000) },
    });
    const idb: IdbBackend = {
      async getAll() { return []; },
      async put(entry) { if (entry.id === 'big-fixture') throw new Error('put refusé'); },
      async delete() { /* non exercé ici */ },
      async clear() { /* non exercé ici */ },
    };
    __setIdbBackendForTest(idb);

    await mount();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([doc], 'big.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {}); // laisse le `.then(file.text())` + l'await de `projectSave` se résoudre
    await act(async () => {});

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    const txt = alert?.textContent ?? '';
    // Langage JOUEUR : aucun nom de clé technique, aucun moteur-speak (IndexedDB/localStorage/quota).
    expect(txt.toLowerCase()).not.toMatch(/indexeddb|localstorage|quota/);
    // Sous-chaîne DISTINCTIVE du message d'échec de `projectSave` (jamais produite par un `throw` de
    // `buildImportedProject`, qui parle de fichier/JSON/scènes, jamais de volume) : prouve qu'on a
    // bien emprunté le chemin d'échec de sauvegarde, pas juste un alert qui ressemble.
    expect(txt.toLowerCase()).toMatch(/volumineuse/);

    __setIdbBackendForTest(null);
    await unmount();
  });

  it('échec réel de suppression (IndexedDB en échec) : message visible au joueur (#776 pt.6)', async () => {
    const entry = buildImportedProject(builtinDocJson(0), 'x');
    entry.id = 'del-fail-fixture';
    entry.label = 'Del fail';
    await projectSave(entry);

    const idb: IdbBackend = {
      async getAll() { return []; },
      async put() { /* non exercé ici */ },
      async delete(id) { if (id === 'del-fail-fixture') throw new Error('delete refusé'); },
      async clear() { /* non exercé ici */ },
    };
    __setIdbBackendForTest(idb);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    // Force aussi l'écriture des TOMBES en échec (sinon `projectRemove` masque l'échec IndexedDB :
    // la tombe seule suffit à empêcher la résurrection, cf. `LibraryWriteOutcome`).
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k) => {
      if (k.includes('tombstones')) throw new Error('setItem refusé');
    });

    await mount();
    const rows = Array.from(container.querySelectorAll('button.listrow'));
    const row = rows.find((el) => el.textContent?.includes('Del fail')) as HTMLButtonElement;
    expect(row).toBeTruthy();
    await act(async () => row.click());
    const del = Array.from(container.querySelectorAll('button.danger')).find(
      (el) => el.textContent?.includes('Supprimer'),
    ) as HTMLButtonElement;
    expect(del).toBeTruthy();
    await act(async () => del.click());
    await act(async () => {}); // laisse l'await de `projectRemove` se résoudre
    await act(async () => {});

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    const txt = alert?.textContent ?? '';
    // Sous-chaîne DISTINCTIVE du message d'échec de `projectRemove` (jamais produite par le chemin
    // d'échec de sauvegarde, qui parle de « volumineuse ») : prouve qu'on a bien emprunté le chemin
    // d'échec de suppression, pas juste un alert qui ressemble.
    expect(txt.toLowerCase()).toMatch(/réapparaître/);

    setItemSpy.mockRestore();
    __setIdbBackendForTest(null);
    await unmount();
  });

  it('import d’un JSON valide mais structurellement invalide : message JOUEUR, jamais le langage de schéma (#780)', async () => {
    // schema=999 : JSON valide, `parseProject` refuse (aucune migration disponible) — ce message
    // parle de `schema=` et de migration, PAS pour l'écran.
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    await mount();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([JSON.stringify({ schema: 999 })], 'incompatible.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {}); // laisse le `.then(file.text())` se résoudre

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    const txt = alert?.textContent ?? '';
    // Message JOUEUR distinctif, en français simple.
    expect(txt).toMatch(/n’est pas une campagne exploitable/);
    // Aucun vocabulaire de schéma/authoring à l'écran (nom de champ, mot « schema », version numérique).
    expect(txt.toLowerCase()).not.toMatch(/schema|meta\.|migration/);
    // Le détail technique reste disponible au diagnostic, jamais perdu.
    expect(consoleErr).toHaveBeenCalled();

    consoleErr.mockRestore();
    await unmount();
  });
});

describe('playerImportError — frontière d’affichage (#780)', () => {
  it('laisse passer un message porté par `PlayerFacingImportError` (tri STRUCTUREL, jamais sur le texte — #776 pt.1)', () => {
    expect(playerImportError(new PlayerFacingImportError('Fichier illisible : ce n’est pas du JSON valide.')))
      .toBe('Fichier illisible : ce n’est pas du JSON valide.');
  });

  it('un `Error` simple portant le même TEXTE n’est PAS traité comme un message joueur (discrimination par classe, pas par texte)', () => {
    const msg = playerImportError(new Error('Fichier illisible : ce n’est pas du JSON valide.'));
    expect(msg).toMatch(/n’est pas une campagne exploitable/);
  });

  it('remplace tout autre message par un langage JOUEUR, sans terme de schéma', () => {
    const msg = playerImportError(new Error('Projet invalide : meta.version doit être un nombre.'));
    expect(msg).toMatch(/n’est pas une campagne exploitable/);
    expect(msg.toLowerCase()).not.toMatch(/meta\.version|schema/);
  });
});
