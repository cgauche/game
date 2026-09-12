// @vitest-environment jsdom
/**
 * Barrière des racines react-dom laissées MONTÉES (#1724) : le compte posé par
 * `src/test-setup.ts` sur le prototype des racines, et le verdict qu'il rend. Ce que la barrière
 * de nœuds (#1619) ne peut pas voir est mesuré ici : une racine montée sur un conteneur DÉTACHÉ de
 * `document.body` ne laisse aucun résidu de nœud et reste pourtant inscrite au planificateur
 * react-dom, partagé par tout le worker sous `test.isolate: false`.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  cleFichierTest,
  fichiersDesRacinesRendues,
  fileActOuverte,
  instrumenterRacines,
  messageActEnVol,
  messageRacineMontee,
} from './test-setup';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const ceFichier = () => cleFichierTest(expect.getState().testPath);

describe('barrière des racines montées — compte réel', () => {
  it('inscrit au fichier qui la rend une racine montée sur un conteneur DÉTACHÉ, et la retire au démontage', async () => {
    await instrumenterRacines();
    const conteneur = document.createElement('div'); // jamais attaché : invisible à la barrière de nœuds
    const racine = createRoot(conteneur);
    act(() => { racine.render(<p>témoin</p>); });
    expect(fichiersDesRacinesRendues()).toContain(ceFichier());
    expect(document.body.children.length).toBe(0);
    act(() => { racine.unmount(); });
    expect(fichiersDesRacinesRendues()).not.toContain(ceFichier());
  });
});

describe('barrière des act() en vol — câblage réel', () => {
  it('voit un act() asynchrone NON attendu, et la file rendue une fois attendu', async () => {
    await instrumenterRacines();
    expect(fileActOuverte(), 'aucun act() en vol au repos').toBe(false);
    const enVol = act(async () => { await Promise.resolve(); });
    expect(fileActOuverte(), "la file s'ouvre dès l'act() non attendu").toBe(true);
    await enVol;
    expect(fileActOuverte(), 'la file est rendue une fois le act() attendu').toBe(false);
  });

  it("l'objet de module `react` REFUSE toute enveloppe : le verdict ne peut nommer que le courant", async () => {
    await instrumenterRacines();
    // Mesure de la portée, pas un goût : vitest sert `react` en espace de noms ESM non redéfinissable,
    // donc aucune enveloppe ne peut retenir le fichier qui OUVRE la file d'act. Si cela change, ce
    // banc rougit et l'ouvreur devient nommable.
    const reactModule = await import('react');
    expect(() => { (reactModule as { act?: unknown }).act = () => undefined; }).toThrow(/act/);
  });
});

describe('barrière des racines montées — verdict', () => {
  it('nomme le fichier qui a rendu la racine, et se tait quand rien ne reste monté', () => {
    const msg = messageRacineMontee(['src/ui/JouetQuiFuit.test.tsx', 'src/ui/JouetQuiFuit.test.tsx']);
    expect(msg).toContain('src/ui/JouetQuiFuit.test.tsx');
    expect(msg?.match(/JouetQuiFuit/g)).toEqual(['JouetQuiFuit']); // le fichier est nommé UNE fois
    expect(messageRacineMontee([])).toBeNull();
  });

  it('nomme le fichier qui laisse un act() en vol, et se tait quand la file d’act est rendue', () => {
    expect(messageActEnVol('src/ui/JouetQuiFuit.test.tsx', true)).toContain('src/ui/JouetQuiFuit.test.tsx');
    expect(messageActEnVol('src/ui/JouetQuiFuit.test.tsx', false)).toBeNull();
  });
});
