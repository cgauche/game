/**
 * #1686 — ce que le SCHÉMA de `materials.json` tient au parse, sur le document RÉEL.
 *
 * Deux contrats, tous deux à mutation :
 *  - la DISJONCTION par domaine (`affinerEntree`) : chaque domaine EXIGE ses clés requises et REFUSE
 *    les clés d'un autre domaine, nommément — c'est ce qui remplace les trois schémas fusionnés ;
 *  - `couverture` n'a qu'UNE graphie : le champ vaut `true`, ou il est ABSENT. `z.boolean()` laissait
 *    entrer `couverture: false`, deuxième façon d'écrire « ne couvre pas » que rien ne distinguerait
 *    de l'absence à la lecture (`roofMaterial(id).couverture` est falsy dans les deux cas).
 * Le pendant POSITIF (le `plan` vu du dessus ne porte pas le champ, les trois couvertures le portent)
 * est tenu par `src/gameIso/catalog/roofs/roofs.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './materials';
import materialsJson from '../../materials.json';

type Entree = { id: string; domain: string; couverture?: unknown; [k: string]: unknown };
const clone = (): Entree[] => structuredClone(materialsJson) as unknown as Entree[];
const uneDe = (doc: Entree[], domaine: string): Entree => {
  const e = doc.find((x) => x.domain === domaine);
  expect(e, `aucune entrée de domaine « ${domaine} » — la fixture ne mesure rien`).toBeDefined();
  return e!;
};
/** Message(s) d'erreur du parse, à plat — la garde vérifie qu'ils NOMMENT le domaine et la clé. */
const refus = (doc: unknown): string[] => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('materials.json — un document, trois domaines, une disjonction gardée au parse', () => {
  it('m0 TÉMOIN : le document RÉEL parse', () => {
    expect(schema.safeParse(materialsJson).success).toBe(true);
  });

  it('une clé ÉTRANGÈRE à son domaine est refusée, en nommant le domaine et la clé', () => {
    const doc = clone();
    uneDe(doc, 'prop').N = '#a04836';
    expect(refus(doc).join(' ')).toMatch(/la clé « N » n’appartient pas au domaine « prop »/);
  });

  it('une clé REQUISE par le domaine est exigée, en nommant le domaine et la clé', () => {
    const doc = clone();
    delete uneDe(doc, 'relief').face;
    expect(refus(doc).join(' ')).toMatch(/le domaine « relief » EXIGE la clé « face »/);
  });

  it('un `domain` HORS périmètre est refusé (les cinq domaines de `MaterialRef` ne sont pas tous ici)', () => {
    const doc = clone();
    uneDe(doc, 'prop').domain = 'terrain';
    expect(schema.safeParse(doc).success).toBe(false);
  });

  it('`couverture: false` est REFUSÉ au parse (deuxième graphie de l’absence)', () => {
    const doc = clone();
    const plan = doc.find((e) => e.domain === 'roof' && e.couverture === undefined)!;
    expect(plan, 'aucune entrée de toit sans `couverture` — la fixture ne mesure rien').toBeDefined();
    plan.couverture = false;
    expect(schema.safeParse(doc).success).toBe(false);
  });

  it('`couverture: true` reste accepté sur une entrée de toit qui ne la portait pas', () => {
    const doc = clone();
    doc.find((e) => e.domain === 'roof' && e.couverture === undefined)!.couverture = true;
    expect(schema.safeParse(doc).success).toBe(true);
  });
});
