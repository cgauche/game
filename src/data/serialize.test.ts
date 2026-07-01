/**
 * Garde-fou de FIDÉLITÉ : l'éditeur de données réécrit les `src/data/*.json` via FS Access ; un
 * round-trip (lire → parser → `serializeDataset`) doit reproduire le fichier à l'octet près, sinon
 * la moindre sauvegarde produirait un diff de reformatage géant. Couvre TOUS les datasets réels.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from './serialize';

const DIR = join(fileURLToPath(new URL('.', import.meta.url)));
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));

describe('serializeDataset — round-trip byte-fidèle des datasets app-owned', () => {
  for (const f of files) {
    it(`${f} : lire → parser → sérialiser == original`, () => {
      const raw = readFileSync(join(DIR, f), 'utf8');
      expect(serializeDataset(JSON.parse(raw))).toBe(raw);
    });
  }
});
