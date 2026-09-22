/**
 * `migrateDoc` NOMME la raison de son refus (`RaisonDeRefus`) : l'appelant la lit pour dire son refus,
 * il ne la devine pas. Une raison par cas, et une migration qui aboutit.
 */
import { describe, it, expect } from 'vitest';
import { migrateDoc, type MigrationMap } from './migrateDoc';

const CHAINE: MigrationMap = {
  1: (d) => ({ ...d, version: 2 }),
  2: (d) => ({ ...d, version: 3, deux: true }),
};

describe('migrateDoc — une issue, et un refus NOMMÉ', () => {
  it('un document à monter traverse la chaîne jusqu’à la cible', () => {
    const issue = migrateDoc({ version: 1 }, 3, CHAINE);
    expect(issue).toEqual({ ok: true, doc: { version: 3, deux: true } });
  });

  it.each([
    ['pas un objet', null, 3, CHAINE, { raison: 'non-objet' }],
    ['version absente', {}, 3, CHAINE, { raison: 'version-absente', version: undefined }],
    ['version non numérique', { version: '2' }, 3, CHAINE, { raison: 'version-absente', version: '2' }],
    ['version future', { version: 9 }, 3, CHAINE, { raison: 'version-future', version: 9 }],
    ['migrateur manquant', { version: 0 }, 3, CHAINE, { raison: 'migrateur-manquant', version: 0 }],
    ['migrateur immobile', { version: 1 }, 3, { 1: (d: Record<string, unknown>) => d }, { raison: 'migrateur-immobile', version: 1 }],
  ] as const)('%s → raison nommée', (_nom, doc, cible, chaine, attendu) => {
    expect(migrateDoc(doc, cible, chaine as MigrationMap)).toMatchObject({ ok: false, ...attendu });
  });

  it('un migrateur qui LÈVE : `migrateur-en-echec`, son message gardé', () => {
    const casse: MigrationMap = { 1: () => { throw new TypeError('illisible'); } };
    expect(migrateDoc({ version: 1 }, 2, casse)).toEqual({ ok: false, raison: 'migrateur-en-echec', version: 1, detail: 'illisible' });
  });
});
