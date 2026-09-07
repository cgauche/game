/**
 * Tests du chargeur de chapitre du NAVIGATEUR (`chapitres.ts`) : une requête par chapitre, et un
 * échec NOMMÉ. `fetch` est remplacé par une sonde — l'invariant est le câblage (adresse-URL, cache,
 * message d'erreur), pas le réseau.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { chargerChapitre, chargerManifeste } from './chapitres.ts';

const CHAPITRE = '# Terreur\n\nUn texte de chapitre servi par le plugin.\n';

function sonde(reponses: () => Response): { appels: string[] } {
  const appels: string[] = [];
  vi.stubGlobal('fetch', (url: string) => { appels.push(String(url)); return Promise.resolve(reponses()); });
  return { appels };
}
const ok = () => new Response(CHAPITRE, { status: 200 });

afterEach(() => { vi.unstubAllGlobals(); });

describe('`chargerChapitre` — un chapitre par son adresse-URL', () => {
  it('parse le markdown servi et ne le redemande JAMAIS (cache dédupliqué)', async () => {
    const { appels } = sonde(ok);
    const a = await chargerChapitre('livre-de-base', '21');
    const b = await chargerChapitre('livre-de-base', '21');
    expect(appels).toHaveLength(1);
    expect(appels[0]).toContain('source/livre-de-base/21.md');
    expect(a.sections.some((s) => s.title === 'Terreur')).toBe(true);
    expect(b).toBe(a);
  });

  it('un chapitre absent LÈVE une erreur nommée, et la clé est libérée pour un nouvel essai', async () => {
    const { appels } = sonde(() => new Response('', { status: 404 }));
    await expect(chargerChapitre('mer-des-griffes', '99')).rejects.toThrow(
      'chapitre-introuvable : mer-des-griffes ch.99 (HTTP 404)',
    );
    await expect(chargerChapitre('mer-des-griffes', '99')).rejects.toThrow('chapitre-introuvable');
    expect(appels).toHaveLength(2);
  });
});

describe('`chargerManifeste` — l’index des chapitres servis, même contrat d’échec', () => {
  const INDEX = { 'livre-de-base': { abbr: 'LDB', chapitres: [{ ch: '21', fichier: '21 - Psychologie.md', titre: 'Psychologie', octets: 42 }] } };

  it('un REFUS n’est pas mémorisé : l’appel suivant retente et peut réussir', async () => {
    let reponse = () => new Response('', { status: 404 });
    const { appels } = sonde(() => reponse());
    await expect(chargerManifeste()).rejects.toThrow('manifeste-introuvable : 404');

    reponse = () => new Response(JSON.stringify(INDEX), { status: 200 });
    const index = await chargerManifeste();
    expect(appels).toHaveLength(2);
    expect(appels[0]).toContain('source/manifest.json');
    expect(index['livre-de-base'].chapitres[0].titre).toBe('Psychologie');

    // La RÉUSSITE, elle, est mémorisée : une seule requête pour toute la session.
    expect(await chargerManifeste()).toBe(index);
    expect(appels).toHaveLength(2);
  });
});
