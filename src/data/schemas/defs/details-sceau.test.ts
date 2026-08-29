/**
 * #1525 — le sceau des surcharges par espèce de `details.texts` : `bySpecies` est keyé par
 * `raceKeySchema` (`details.ts`, champ `bySpecies`). L'atelier ne propose que ces 7 clés ; le SCHÉMA doit refuser
 * toute autre clé AU CHARGEMENT (une surcharge d'espèce inconnue serait chargée et jamais rendue).
 */
import { describe, expect, it } from 'vitest';
import { schema } from './details';
import detailsJson from '../../details.json';
import { raceKeySchema } from '../grammaire/valeurs';

type Details = { texts: { nom: { all: string; bySpecies: Record<string, string> } } };
const clone = (): Details => structuredClone(detailsJson) as unknown as Details;

describe('details.json — les surcharges par espèce sont SCELLÉES par raceKeySchema', () => {
  it('m0 TÉMOIN : le document RÉEL parse, et une clé DU SCEAU est acceptée', () => {
    expect(schema.safeParse(detailsJson).success).toBe(true);
    const doc = clone();
    doc.texts.nom.bySpecies[raceKeySchema.options[0]] = 'texte';
    expect(schema.safeParse(doc).success).toBe(true);
  });

  const refusees = ['orque', 'humain2', 'Humain', ''];
  for (const cle of refusees) {
    it(`refuse la clé hors sceau « ${cle} »`, () => {
      const doc = clone();
      doc.texts.nom.bySpecies[cle] = 'texte';
      expect(schema.safeParse(doc).success).toBe(false);
    });
  }
});
