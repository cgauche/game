/**
 * MORSURE de l'extracteur `labelDArt` (`scripts/guards/lib/propArtLabels.mjs`, #1467 L1b V-P0d).
 *
 * La migration 10a et la garde de parité `props-label-parite.test.ts` n'exercent que le chemin
 * HEUREUX : sur les 78 defs réelles, l'extraction rend toujours 1 label. Une régression du motif
 * (graphie non couverte acceptée en silence, `label:` d'un sous-objet compté) passerait donc les deux.
 * Ce fichier tient les 4 fail-fast, sur des defs FABRIQUÉES — c'est l'instrument qui est mesuré ici,
 * pas la donnée.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { labelDArt, DECOR_DEFS_DIR } from '../../scripts/guards/lib/propArtLabels.mjs';

let racine: string;

beforeAll(() => {
  racine = mkdtempSync(join(tmpdir(), 'prop-art-labels-'));
  const defs = join(racine, DECOR_DEFS_DIR);
  mkdirSync(defs, { recursive: true });
  writeFileSync(join(defs, 'zero.ts'), "export const prop = { id: 'zero', nom: 'x' };");
  writeFileSync(join(defs, 'deux.ts'), 'export const prop = { id: \'deux\', label: \'A\', sub: { label: "B" } };');
  writeFileSync(join(defs, 'gabarit.ts'), 'export const prop = { id: \'g\', label: `Gabarit` };');
  writeFileSync(join(defs, 'sain.ts'), 'export const prop = { id: \'sain\', label: "Décor sain" };');
});
afterAll(() => rmSync(racine, { recursive: true, force: true }));

describe('labelDArt — fail-fast nominatif de l’extracteur de label d’art', () => {
  it('TÉMOIN POSITIF : une def bien formée rend son label (l’instrument sait dire oui)', () => {
    expect(labelDArt(racine, 'sain')).toBe('Décor sain');
  });

  it('def d’art ABSENTE → throw qui NOMME l’id et le chemin attendu', () => {
    expect(() => labelDArt(racine, 'nexiste-pas')).toThrow(/nexiste-pas.*aucune def d'art/s);
  });

  it('ZÉRO `label:` → throw (jamais un label vide rendu en silence)', () => {
    expect(() => labelDArt(racine, 'zero')).toThrow(/zero : 0 déclaration\(s\) `label:`/);
  });

  it('DEUX `label:` (celui d’un sous-objet compte) → throw : le choix serait arbitraire', () => {
    expect(() => labelDArt(racine, 'deux')).toThrow(/deux : 2 déclaration\(s\) `label:`.*"A".*"B"/s);
  });

  it('label en TEMPLATE LITERAL → throw : la graphie sort du contrat, elle ne se devine pas', () => {
    expect(() => labelDArt(racine, 'gabarit')).toThrow(/gabarit : 0 déclaration\(s\) `label:`/);
  });
});
