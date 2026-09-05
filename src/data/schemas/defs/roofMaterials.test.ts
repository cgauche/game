/**
 * #1686 — `couverture` n'a qu'UNE graphie : le champ vaut `true`, ou il est ABSENT. `z.boolean()`
 * laissait entrer `couverture: false`, deuxième façon d'écrire « ne couvre pas » que rien ne
 * distinguerait de l'absence à la lecture (`roofMaterial(id).couverture` est falsy dans les deux
 * cas) — deux graphies pour un état, c'est la divergence que le schéma doit refuser AU PARSE.
 * Le pendant POSITIF (le `plan` vu du dessus ne porte pas le champ, les trois couvertures le
 * portent) est tenu par `src/gameIso/catalog/roofs/roofs.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './roofMaterials';
import roofMaterialsJson from '../../roofMaterials.json';

type Entree = { id: string; couverture?: unknown };
const clone = (): Entree[] => structuredClone(roofMaterialsJson) as unknown as Entree[];

describe('roofMaterials.json — `couverture` est `true` ou ABSENTE, jamais `false`', () => {
  it('m0 TÉMOIN : le document RÉEL parse', () => {
    expect(schema.safeParse(roofMaterialsJson).success).toBe(true);
  });

  it('`couverture: false` est REFUSÉ au parse (deuxième graphie de l’absence)', () => {
    const doc = clone();
    const plan = doc.find((e) => e.couverture === undefined)!;
    expect(plan, 'aucune entrée sans `couverture` — la fixture ne mesure rien').toBeDefined();
    plan.couverture = false;
    expect(schema.safeParse(doc).success).toBe(false);
  });

  it('`couverture: true` reste accepté sur une entrée qui ne la portait pas', () => {
    const doc = clone();
    doc.find((e) => e.couverture === undefined)!.couverture = true;
    expect(schema.safeParse(doc).success).toBe(true);
  });
});
