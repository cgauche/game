// @vitest-environment jsdom
/**
 * `parseProject` est la porte UNIQUE des documents de projet (JSON committé, bibliothèque locale,
 * import de l'auteur — `src/data/schemas/validate.ts`). Ce que le chemin d'ÉCRITURE de l'éditeur
 * produit doit donc repasser cette porte : un projet que l'application écrit et ne peut plus rouvrir
 * est une perte de travail. Le round-trip est mesuré sur le chemin RÉEL (« Fichier → Enregistrer »
 * de `<Editor>` → `projectSave` → document capturé au dos d'IndexedDB), jamais sur un document forgé.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { __setIdbBackendForTest, __resetLibraryForTest, initLibrary, type IdbBackend, type SavedProject } from '../../state/projectLibrary';
import { parseProject, CURRENT_PROJECT_SCHEMA } from '../../state/worldMap';
import { emptyScene, type Scene } from '../../state/scene';
import { Editor } from './Editor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
  await __resetLibraryForTest();
  __setIdbBackendForTest(null);
  localStorage.clear();
});

/** Joue « Fichier → Enregistrer… → Enregistrer » sur un éditeur fraîchement monté et rend le
 *  document de projet TEL QU'ÉCRIT par l'application. */
async function enregistreEtCapture(): Promise<SavedProject> {
  const ecrits: SavedProject[] = [];
  const idb: IdbBackend = {
    async getAll() { return [] as SavedProject[]; },
    async put(entry) { ecrits.push(entry); },
    async delete() { /* non exercé */ },
    async clear() { /* non exercé */ },
  };
  __setIdbBackendForTest(idb);

  const initialScene: Scene = { ...emptyScene(4, 4), id: 'scene-round-trip', label: 'Round-trip' };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<Editor initialScene={initialScene} />);
  });

  const byText = (label: string) =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
  await act(async () => { byText('Fichier').click(); });
  await act(async () => { byText('Enregistrer…').click(); });
  const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Enregistrer')!;
  await act(async () => { saveBtn.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  await act(async () => { root.unmount(); });
  container.remove();

  expect(ecrits).toHaveLength(1);
  return ecrits[0];
}

describe('Éditeur — un projet ENREGISTRÉ repasse sa propre porte `parseProject`', () => {
  it('un projet JAMAIS nommé se NOMME au geste d’enregistrement, et le document écrit repasse sa porte', async () => {
    const saved = await enregistreEtCapture();

    // La porte unique relit ce que l'application vient d'écrire.
    expect(() => parseProject(saved.project)).not.toThrow();
    const relu = parseProject(saved.project);
    expect(relu.scenes.map((s) => s.id)).toEqual(['scene-round-trip']);

    // Identité REQUISE (#1552 — invariant et verbatim au contrat du schéma,
    // `src/data/schemas/defs-scenes/projet-schema.test.ts` cas (d bis)).
    // L'éditeur démarre SANS identité ; c'est le geste d'enregistrement (le champ
    // pré-rempli de `SaveProjectModal`) qui la pose. Le document écrit s'annonce, se nomme, et dit
    // sa provenance — sans quoi sa propre porte le refuserait à la relecture ci-dessus.
    expect(saved.project).toMatchObject({ type: 'projet', schema: CURRENT_PROJECT_SCHEMA, versionContenu: 1 });
    expect(saved.project.id, 'identité posée par le geste').toBeTruthy();
    expect(saved.project.label, 'le NOM vient du champ de la modale').toBeTruthy();
    expect(saved.project.maison, 'provenance : une campagne d’éditeur ne cite aucun folio').toBeTruthy();
    expect(Object.keys(saved.project).sort()).toEqual(['id', 'label', 'maison', 'narratif', 'scenes', 'schema', 'type', 'versionContenu']);
  });
});

/** Un projet déjà en bibliothèque, écrit AVANT #1552 : son document n'a ni `type`, ni identité à la
 *  racine, et ses scènes ne s'annoncent pas. L'ENTRÉE, elle, porte un id et un nom — la clé et le
 *  libellé de la bibliothèque (`SavedProject`). */
function entreeAncienne(over: Partial<SavedProject> = {}): SavedProject {
  const { type: _muette, ...sceneMuette } = { ...emptyScene(4, 4), id: 'scene-ancienne', label: 'Salle ancienne' };
  return {
    id: 'proj-ancien',
    label: 'Campagne d’avant',
    startSceneId: 'scene-ancienne',
    savedAt: 1,
    published: false,
    project: {
      schema: 6,
      scenes: [sceneMuette as Scene],
      narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
    },
    ...over,
  } as SavedProject;
}

/** Monte l'éditeur sur une bibliothèque donnée, joue « Fichier → Ouvrir… → Ouvrir » sur la 1ʳᵉ entrée,
 *  et rend ce que l'écran montre : le titre de scène chargé et le refus AFFICHÉ s'il y en a un. */
async function ouvreLaPremiereEntree(entrees: SavedProject[]): Promise<{ refus: string | null; texte: string; ecrits: SavedProject[]; enregistre: () => Promise<void> }> {
  const ecrits: SavedProject[] = [];
  const idb: IdbBackend = {
    async getAll() { return entrees; },
    async put(entry) { ecrits.push(entry); },
    async delete() { /* non exercé */ },
    async clear() { /* non exercé */ },
  };
  await __resetLibraryForTest();
  __setIdbBackendForTest(idb);
  await initLibrary();

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<Editor initialScene={{ ...emptyScene(4, 4), id: 'scene-vierge', label: 'Vierge' }} />);
  });
  const byText = (label: string) =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
  await act(async () => { byText('Fichier').click(); });
  await act(async () => { byText('Ouvrir…').click(); });
  // « Mes projets » est la 1ʳᵉ section de la modale : la 1ʳᵉ rangée est l'entrée de bibliothèque — y
  // compris quand elle est ANONYME (aucun libellé à chercher, c'est justement le cas mesuré).
  const ouvrir = container.querySelectorAll('.listrow')[0].querySelector('button')!;
  await act(async () => { ouvrir.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  const refus = container.querySelector('[role="alert"]')?.textContent ?? null;
  const texte = container.textContent ?? '';
  const enregistre = async () => {
    await act(async () => { byText('Fichier').click(); });
    await act(async () => { byText('Enregistrer…').click(); });
    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Enregistrer')!;
    await act(async () => { saveBtn.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    await act(async () => { root.unmount(); });
    container.remove();
  };
  return { refus, texte, ecrits, enregistre };
}

describe('Éditeur — un projet de bibliothèque d’AVANT #1552 se ROUVRE', () => {
  it('sans identité au document : l’identité DE L’ENTRÉE est reconduite, le projet CHARGE et se réenregistre', async () => {
    const { refus, texte, ecrits, enregistre } = await ouvreLaPremiereEntree([entreeAncienne()]);
    expect(refus, 'aucun refus ne doit s’afficher').toBeNull();
    expect(texte, 'la scène du projet ancien est chargée').toContain('Salle ancienne');

    await enregistre();
    expect(ecrits).toHaveLength(1);
    const doc = ecrits[0].project as Record<string, unknown>;
    expect(doc.id, 'l’id de l’entrée est reconduit au document').toBe('proj-ancien');
    expect(doc.label).toBe('Campagne d’avant');
    expect(doc.versionContenu, 'version de contenu inconnue du document → 0').toBe(0);
    expect(doc.type).toBe('projet');
    expect(() => parseProject(doc), 'le document réécrit repasse sa porte').not.toThrow();
  });

  it('avec identité au document : c’est CELLE DU DOCUMENT qui gagne (l’entrée ne l’écrase pas)', async () => {
    const entree = entreeAncienne();
    const projet = { ...(entree.project as Record<string, unknown>), id: 'id-du-document', label: 'Nom du document', versionContenu: 4 };
    const { refus, ecrits, enregistre } = await ouvreLaPremiereEntree([{ ...entree, project: projet } as SavedProject]);
    expect(refus).toBeNull();
    await enregistre();
    const doc = ecrits[0].project as Record<string, unknown>;
    expect(doc.id).toBe('id-du-document');
    expect(doc.label).toBe('Nom du document');
    expect(doc.versionContenu).toBe(4);
  });

  it('IRRÉCUPÉRABLE (entrée sans nom ni id) : refus en mots d’AUTEUR, détail technique dessous — jamais une boîte du navigateur', async () => {
    const anonyme = { ...entreeAncienne(), id: '', label: '' } as SavedProject;
    const { refus, texte } = await ouvreLaPremiereEntree([anonyme]);
    // Ce que l'auteur lit d'abord est en français (règle 4) : le rapport de la porte est un texte
    // technique anglais, il reste consultable mais ne tient plus lieu de message.
    expect(refus, 'le refus doit être RENDU par l’éditeur').toContain('Ce projet n’a pas de nom');
    expect(refus, 'le détail technique reste consultable').toMatch(/id/);
    expect(refus).toMatch(/label/);
    expect(texte, 'la scène ancienne n’est pas chargée').not.toContain('Salle ancienne');
  });

  it('une entrée SANS NOM se rend « (sans nom) » dans « Ouvrir », jamais une rangée muette', async () => {
    const { texte } = await ouvreLaPremiereEntree([{ ...entreeAncienne(), label: '' } as SavedProject]);
    expect(texte).toContain('(sans nom)');
  });
});

/**
 * « Fichier → Importer JSON… » : le document importé PORTE son identité (id, nom, provenance). Le
 * chemin d'import doit la reconduire jusqu'à l'ENTRÉE de bibliothèque que « Enregistrer » écrira —
 * sinon le champ de la modale se pré-remplit du nom de l'éditeur, l'entrée naît sous ce nom-là, et
 * le document garde le sien : entrée et document divergents, le nom du document masqué à l'écran.
 */
async function importePuisEnregistre(docJson: string): Promise<SavedProject[]> {
  const ecrits: SavedProject[] = [];
  const idb: IdbBackend = {
    async getAll() { return [] as SavedProject[]; },
    async put(entry) { ecrits.push(entry); },
    async delete() { /* non exercé */ },
    async clear() { /* non exercé */ },
  };
  await __resetLibraryForTest();
  __setIdbBackendForTest(idb);
  await initLibrary();

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<Editor initialScene={{ ...emptyScene(4, 4), id: 'scene-vierge', label: 'Vierge' }} />);
  });
  const byText = (label: string) =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;

  await act(async () => { byText('Fichier').click(); });
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const fichier = { name: 'projet.json', text: async () => docJson } as unknown as File;
  Object.defineProperty(input, 'files', { value: [fichier], configurable: true });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  await act(async () => { byText('Fichier').click(); });
  await act(async () => { byText('Enregistrer…').click(); });
  // Le champ « Nom » est PRÉ-REMPLI du nom du document importé — l'auteur enregistre sans le ressaisir.
  const champNom = container.querySelector('.field input') as HTMLInputElement;
  expect(champNom.value, 'le nom du document importé pré-remplit la modale').toBe('Campagne importée');
  const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Enregistrer')!;
  await act(async () => { saveBtn.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { root.unmount(); });
  container.remove();
  return ecrits;
}

describe('Éditeur — un projet IMPORTÉ garde son identité jusqu’à la bibliothèque', () => {
  it('import → enregistrement : l’ENTRÉE et le DOCUMENT portent le MÊME id et le MÊME nom', async () => {
    const doc = {
      type: 'projet',
      schema: CURRENT_PROJECT_SCHEMA,
      id: 'proj-importe',
      label: 'Campagne importée',
      versionContenu: 3,
      maison: 'fixture de test — aucun folio à citer',
      scenes: [{ ...emptyScene(4, 4), id: 'scene-importee', label: 'Salle importée' }],
      narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
    };
    const ecrits = await importePuisEnregistre(JSON.stringify(doc));
    expect(ecrits).toHaveLength(1);
    const entree = ecrits[0];
    const ecrit = entree.project as Record<string, unknown>;
    expect(ecrit.id, 'le document garde son id').toBe('proj-importe');
    expect(ecrit.label).toBe('Campagne importée');
    expect(entree.id, 'l’entrée porte l’id DU DOCUMENT').toBe(ecrit.id);
    expect(entree.label, 'l’entrée porte le nom DU DOCUMENT').toBe(ecrit.label);
    expect(() => parseProject(ecrit), 'le document réécrit repasse sa porte').not.toThrow();
  });
});
