/**
 * #1825 — ce que le SCHÉMA de `raw.manifest.json` tient au parse, sur le document RÉEL.
 *
 * UNE règle, DEUX portées : une entrée de FICHE (`id` sans `#`) couvre tous les topics de sa fiche,
 * sa portée large n'est bornée que par la vie de son ticket, `ticket` y est donc obligatoire.
 * Ici c'est la FORME de l'`id` qui la dit (le schéma ne connaît pas les fiches de `docs/raw/`) ;
 * la RÉSOLUTION contre les fiches réelles — id connu, non ambigu, et la même exigence de ticket —
 * vit dans `validerDette` (`scripts/raw/build-implemente.mjs`), gardée par
 * `scripts/raw/build-implemente.test.mjs`. Les deux portées sont mutées séparément.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './raw-manifest';
import manifestJson from '../../raw.manifest.json';

type Entree = { id: string; label: string; type: string; ticket?: string; bloque?: string };
const clone = (): Entree[] => structuredClone(manifestJson) as unknown as Entree[];
/** Une entrée de TOPIC réelle, servant de gabarit (enveloppe complète : id, label, type). */
const gabarit = (): Entree => {
  const e = clone().find((x) => x.id.includes('#'));
  expect(e, 'aucune entrée de topic au manifest — la fixture ne mesure rien').toBeDefined();
  return e!;
};
const messages = (doc: unknown): string[] => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('raw.manifest.json — une entrée de FICHE porte un ticket, dit par la FORME de son id', () => {
  it('témoin : le document RÉEL parse', () => {
    expect(schema.safeParse(manifestJson).success).toBe(true);
  });

  it('entrée de FICHE (id sans #) avec `bloque` seul → REFUSÉE, en nommant la règle', () => {
    const doc = clone();
    doc.push({ ...gabarit(), id: 'magie', label: 'Atlas RAW — Magie (règles)', bloque: 'plus tard', ticket: undefined });
    expect(messages(doc).join(' ')).toMatch(/entrée de fiche \(id sans #\) : ticket requis/);
  });

  it('entrée de FICHE avec `ticket` → ADMISE', () => {
    const doc = clone();
    doc.push({ ...gabarit(), id: 'magie', label: 'Atlas RAW — Magie (règles)', ticket: '#1900', bloque: undefined });
    expect(schema.safeParse(doc).success).toBe(true);
  });

  it('entrée de TOPIC avec `bloque` seul → ADMISE : elle nomme un blocage sur UN topic, pas une couverture', () => {
    const doc = clone();
    doc.push({ ...gabarit(), id: 'magie#seconde-vue-fixture', label: 'Fixture', bloque: 'attente VF', ticket: undefined });
    expect(schema.safeParse(doc).success).toBe(true);
  });

  it('une entrée sans ticket NI bloque reste refusée, quelle que soit la forme de l’id', () => {
    const doc = clone();
    doc.push({ ...gabarit(), id: 'magie#vide-fixture', label: 'Fixture', ticket: undefined, bloque: undefined });
    expect(messages(doc).join(' ')).toMatch(/ticket ou bloque requis/);
  });
});
