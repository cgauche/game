/**
 * Point de validation partagé (#176) : `validateDataset`/`schemaForFile`/`formatZodError` — la SOURCE
 * UNIQUE utilisée par la sauvegarde Codex (`CodexEdit.save`), le chargement DEV (`dev-validate.ts`) et
 * le contrat CI (`schema-contract.test.ts`). Le contrat CI couvre déjà « chaque JSON réel parse » ; ici
 * on verrouille le CONTRAT de la fonction : valide → null, invalide → message champ-par-champ, fichier
 * non registré → erreur NOMMANT le fichier et le registre à peupler (la porte est STRICTE : un document
 * hors registre ne passe pas en silence).
 */
import { describe, it, expect } from 'vitest';
import { validateDataset, validateDocument, schemaForFile, formatZodError } from './validate';
import { schema as characteristicsSchema } from './defs/characteristics';
import { projetSchema } from './defs-scenes/projet';
import areneProjet from '../../scenes/arene/arene-projet.json';

const VALID_CHAR = [
  { id: 'capacite-de-combat', abr: 'CC', label: 'Capacité de Combat', nature: 'roll', desc: 'x', source: { book: 'livre-de-base', page: 33 } },
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
    const bad = [{ abr: 'CC', label: 'x', nature: 'roll', desc: 'x' }]; // pas de `source`
    const err = validateDataset('characteristics.json', bad);
    expect(err).not.toBeNull();
    expect(err).toContain('0.source');
  });

  it('un fichier NON registré → erreur NOMMANT le fichier et le registre à peupler', () => {
    const err = validateDataset('fichier-inexistant.json', { anything: true });
    expect(err).toContain('fichier-inexistant.json');
    expect(err).toContain('aucun schéma registré');
    expect(err).toContain('defs-scenes/');
    expect(schemaForFile('fichier-inexistant.json')).toBeUndefined();
  });

  it('un document de la racine src/scenes est registré par son CHEMIN relatif', () => {
    expect(schemaForFile('arene/arene-projet.json')).toBe(projetSchema);
    expect(validateDataset('arene/arene-projet.json', areneProjet)).toBeNull();
  });

  it('validateDocument — porte par SCHÉMA (le seam n\'a pas de nom de fichier)', () => {
    expect(validateDocument(projetSchema, areneProjet, 'Projet')).toBeNull();
    const err = validateDocument(projetSchema, { ...(areneProjet as object), schema: 2 }, 'Projet');
    expect(err).toContain('Projet — JSON invalide');
    expect(err).toContain('schema');
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
