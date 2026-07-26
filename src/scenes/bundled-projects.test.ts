import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseProject } from '../state/worldMap';

/**
 * Garde TRANSVERSE (#809) : tout paquet bundlé `src/scenes/*.../*-projet.json` doit se relire dans
 * le modèle COURANT — `parseProject` sans lever, avec un `meta` valide (id/label/version). Couvre
 * TOUT paquet présent OU futur (glob récursif de `src/scenes`, jamais une liste de noms en dur) :
 * `scripts/arene/generate.mjs` était le DERNIER générateur à écrire un littéral `schema: 2` sans
 * `meta` (au lieu de `projectDoc()`, `scripts/campagne/lib.mjs`) — cette garde empêche cette classe
 * de dérive de revenir, pour ce paquet comme pour tout futur paquet de campagne.
 */
const SCENES_DIR = join(__dirname);

function findBundledProjectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findBundledProjectFiles(full));
    else if (entry.isFile() && entry.name.endsWith('-projet.json')) out.push(full);
  }
  return out;
}

const bundledFiles = findBundledProjectFiles(SCENES_DIR);

describe('paquets de campagne bundlés — se relisent tous dans le modèle COURANT (#809)', () => {
  it('au moins un paquet trouvé (la garde couvre réellement quelque chose)', () => {
    expect(bundledFiles.length).toBeGreaterThan(0);
  });

  it.each(bundledFiles.map((f) => [f] as const))('%s : parseProject ne lève pas et porte un meta valide', (file) => {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    const doc = parseProject(raw);
    expect(doc.meta, `${file} : meta absent — régénérer via projectDoc()`).toBeTruthy();
    expect(typeof doc.meta!.id).toBe('string');
    expect(doc.meta!.id.length).toBeGreaterThan(0);
    expect(typeof doc.meta!.label).toBe('string');
    expect(doc.meta!.label.length).toBeGreaterThan(0);
    expect(typeof doc.meta!.version).toBe('number');
  });

  it('CONTRE-PREUVE : un paquet ramené au format PRÉCÉDENT (schema 2, sans meta) échoue la garde ci-dessus', () => {
    const raw = JSON.parse(readFileSync(bundledFiles[0], 'utf8'));
    const regressed = { schema: 2, scenes: raw.scenes, worldMap: raw.worldMap }; // ⚠ copie EN MÉMOIRE — aucun fichier touché
    const doc = parseProject(regressed); // migre 2→3 (narratif vide) mais SANS meta : la migration n'invente pas d'identité
    expect(() => {
      expect(doc.meta, 'meta absent — régression schema 2 détectée').toBeTruthy();
    }).toThrow();
  });
});
