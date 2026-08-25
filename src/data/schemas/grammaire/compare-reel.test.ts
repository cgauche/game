/**
 * `kind: 'compare'` — la grammaire parse la POPULATION RÉELLE des deux racines (#1466 T3-a).
 *
 * `compareValueSchema` (`mecanique.ts`) est une union : un membre trop étroit rend rouge une
 * Condition authorée, un membre trop large (un `z.any()` de confort) rend le schéma inerte sans
 * qu'aucun test de forme ne le voie. On mesure donc la population entière : chaque `compare`
 * réellement authoré sous `src/data` et `src/scenes` est reparsé par `conditionSchema` (la branche
 * `compare` de l'union `Condition` — la porte publique par laquelle cette valeur est atteinte),
 * et le COMPTE est asserté pour que l'ajout d'une forme neuve passe par ici.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { conditionSchema } from './mecanique';

/** Nombre de `compare` authorés dans les deux racines, MESURÉ (2026-08-24) : 29 sous `src/data`,
 *  0 sous `src/scenes` — le scan couvre quand même les deux, pour que la première Condition
 *  authorée EN SCÈNE entre par ici. Le compte évolue avec la donnée : s'il change, vérifier que les
 *  nouvelles occurrences sont VERTES ci-dessous, puis le recaler — jamais l'assouplir en
 *  `toBeGreaterThan`. */
const COMPARE_AUTHORES = 29;

const fichiersJson = (racine: string): string[] => {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) out.push(p);
    }
  };
  walk(racine);
  return out;
};

/** Toutes les valeurs `{ kind: 'compare', … }` d'un document, à toute profondeur, avec leur chemin. */
const comparesDe = (valeur: unknown, chemin: string, dans: { chemin: string; noeud: unknown }[]): void => {
  if (Array.isArray(valeur)) {
    valeur.forEach((v, i) => comparesDe(v, `${chemin}[${i}]`, dans));
    return;
  }
  if (!valeur || typeof valeur !== 'object') return;
  const obj = valeur as Record<string, unknown>;
  if (obj.kind === 'compare') dans.push({ chemin, noeud: obj });
  for (const [k, v] of Object.entries(obj)) comparesDe(v, `${chemin}.${k}`, dans);
};

const POPULATION = (() => {
  const trouves: { chemin: string; noeud: unknown }[] = [];
  for (const racine of ['src/data', 'src/scenes']) {
    for (const f of fichiersJson(racine)) comparesDe(JSON.parse(readFileSync(f, 'utf8')), f, trouves);
  }
  return trouves;
})();

describe('grammaire — les `compare` RÉELLEMENT authorés parsent contre la grammaire', () => {
  it(`les ${COMPARE_AUTHORES} \`compare\` des deux racines sont trouvés (le scan mord)`, () => {
    expect(POPULATION.length).toBe(COMPARE_AUTHORES);
  });

  it('chacun parse contre `conditionSchema` — aucun rouge, chemin nommé sinon', () => {
    const rouges = POPULATION.flatMap(({ chemin, noeud }) => {
      const res = conditionSchema.safeParse(noeud);
      return res.success ? [] : [`${chemin} :: ${res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' | ')}`];
    });
    expect(rouges).toEqual([]);
  });
});
