/**
 * Point de validation partagé (#176) : `validateDataset`/`schemaForFile`/`formatZodError` — la SOURCE
 * UNIQUE utilisée par la sauvegarde Codex (`CodexEdit.save`), le chargement DEV (`dev-validate.ts`) et
 * le contrat CI (`schema-contract.test.ts`). Le contrat CI couvre déjà « chaque JSON réel parse » ; ici
 * on verrouille le CONTRAT de la fonction : valide → null, invalide → message champ-par-champ, fichier
 * non registré → null (pas de blocage hors contrat).
 */
import { describe, it, expect } from 'vitest';
import { validateDataset, schemaForFile, formatZodError } from './validate';
import { schema as characteristicsSchema } from './defs/characteristics';

const VALID_CHAR = [
  { id: 'CC', abr: 'CC', label: 'Capacité de Combat', type: 'roll', desc: 'x', source: { book: 'livre-de-base', page: 33 } },
];

describe('validateDataset — point de validation partagé (#176)', () => {
  it('une donnée conforme au schéma → null (pas de blocage)', () => {
    expect(validateDataset('characteristics.json', VALID_CHAR)).toBeNull();
  });

  it('une clé inconnue → message ACTIONNABLE champ-par-champ (refus)', () => {
    const bad = [{ ...VALID_CHAR[0], inventedField: 'poison' }];
    const err = validateDataset('characteristics.json', bad);
    expect(err).not.toBeNull();
    expect(err).toContain('characteristics.json');
  });

  it('un champ requis manquant → chemin du champ dans le message', () => {
    const bad = [{ abr: 'CC', label: 'x', type: 'roll', desc: 'x' }]; // pas de `source`
    const err = validateDataset('characteristics.json', bad);
    expect(err).not.toBeNull();
    expect(err).toContain('0.source');
  });

  it('un fichier NON registré → null (un dataset hors contrat ne bloque pas)', () => {
    expect(validateDataset('fichier-inexistant.json', { anything: true })).toBeNull();
    expect(schemaForFile('fichier-inexistant.json')).toBeUndefined();
  });

  it('schemaForFile résout le schéma registré par nom de fichier', () => {
    expect(schemaForFile('characteristics.json')).toBe(characteristicsSchema);
  });

  it('formatZodError énumère chaque issue en « chemin: message »', () => {
    const res = characteristicsSchema.safeParse([{ abr: 'CC' }]);
    expect(res.success).toBe(false);
    if (!res.success) {
      const msg = formatZodError('characteristics.json', res.error);
      expect(msg.startsWith('characteristics.json — JSON invalide contre son schéma :')).toBe(true);
      expect(msg).toContain('\n  - ');
    }
  });
});
