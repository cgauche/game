/**
 * CLIQUET GÉNÉRIQUE (#1548) — un champ dont la donnée RÉELLE porte des OBJETS (ou des tableaux) ne peut
 * jamais être classé en liste de scalaires (`stringList`/`numberList`) par l'inférence de formulaire.
 * Un tel classement rend un `<input>` par élément avec `value={item}`, soit « [object Object] » à
 * l'écran et un ÉCRASEMENT de l'objet par une chaîne au premier caractère saisi.
 *
 * Le scan est GÉNÉRIQUE : il rejoue la projection réelle de `CodexEdit` (`editableEntries` +
 * `dedicatedFieldKeys` + `refFieldCfg`) sur TOUTES les catégories éditables, et compare le kind inféré
 * à la forme MESURÉE des éléments — aucune liste de cas en dur.
 */
import { describe, it, expect } from 'vitest';
import { CODEX } from './registry';
import { inferFields } from './editFields';
import { refFieldCfg } from './RefField';
import { isEditableCategory, editableEntries, dedicatedFieldKeys } from './CodexEdit';

/** Formes des ÉLÉMENTS d'un champ-tableau, à travers toutes les entrées (`[]` n'en produit aucune). */
function formesDesElements(entries: Record<string, unknown>[], key: string): Set<string> {
  const formes = new Set<string>();
  for (const e of entries) {
    const v = e[key];
    if (!Array.isArray(v)) continue;
    for (const x of v) formes.add(x === null ? 'null' : Array.isArray(x) ? 'tableau' : typeof x);
  }
  return formes;
}

describe('Codex — une liste d’OBJETS n’est jamais classée liste de scalaires (#1548)', () => {
  const editable = CODEX.filter((c) => isEditableCategory(c.key));

  it('toutes les catégories éditables sont couvertes (au moins une)', () => {
    expect(editable.length).toBeGreaterThan(0);
  });

  for (const cat of editable) {
    it(`${cat.key} : aucun champ-liste ne ment sur la forme de ses éléments`, () => {
      const handled = dedicatedFieldKeys(cat.key);
      const entries = editableEntries(cat.key) as Record<string, unknown>[];
      const menteurs = inferFields(entries)
        .filter((f) => !handled.has(f.key) && !refFieldCfg(cat.key, f.key))
        .filter((f) => f.kind === 'stringList' || f.kind === 'numberList')
        .map((f) => ({ f, formes: formesDesElements(entries, f.key) }))
        .filter(({ formes }) => formes.has('object') || formes.has('tableau'))
        .map(({ f, formes }) => `${cat.key}.${f.key} (kind=${f.kind}, éléments={${[...formes].join(',')}})`);
      expect(menteurs, `champs rendus en <input> alors que la donnée porte des objets : ${menteurs.join(' ; ')}`).toEqual([]);
    });
  }
});
